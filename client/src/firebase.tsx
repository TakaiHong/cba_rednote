import { type PropsWithChildren, useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, type Auth, type User, getAuth, onIdTokenChanged, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const authRequired = import.meta.env.VITE_REQUIRE_FIREBASE_AUTH === "true";
const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
const configuredApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
const operatorApiBase = configuredApiBase || (window.location.hostname === "127.0.0.1" && window.location.port === "5173" ? "http://127.0.0.1:8787/api" : "/api");

let authInstance: Auth | undefined;

function firebaseAuth() {
  if (!configured) return undefined;
  if (!authInstance) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }
  return authInstance;
}

export async function getFirebaseIdToken() {
  const auth = firebaseAuth();
  if (!auth?.currentUser) return undefined;
  try {
    // Refresh before protected Worker calls so a restored browser session cannot
    // look signed in locally while sending an expired token to the API.
    return await auth.currentUser.getIdToken(true);
  } catch {
    await signOut(auth);
    return undefined;
  }
}

export function FirebaseAuthGate({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setUser(null);
      return;
    }
    return onIdTokenChanged(auth, (nextUser) => {
      if (!nextUser) {
        setUser(null);
        return;
      }

      // Do not show the dashboard until the browser session has both a usable
      // Firebase token and confirmed access to the protected Worker.
      void (async () => {
        try {
          const token = await nextUser.getIdToken(true);
          const response = await window.fetch(`${operatorApiBase}/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
            throw new Error(payload?.error ?? `Worker access check failed (${response.status}).`);
          }
          setUser(nextUser);
        } catch (reason) {
          await signOut(auth);
          setUser(null);
          setError(reason instanceof Error ? reason.message : "Unable to verify this operator account.");
        }
      })();
    });
  }, []);

  if (!authRequired) return <>{children}</>;
  if (!configured) {
    return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">CONFIGURATION REQUIRED</p><h1>运营台尚未连接 Firebase Auth</h1><p>请按部署文档填写 Firebase Web 配置后重新构建。</p></section></main>;
  }
  if (user === undefined) return <main className="auth-shell"><section className="auth-card"><p>正在检查登录状态...</p></section></main>;
  if (user) return <>{children}</>;

  return <main className="auth-shell"><section className="auth-card">
    <p className="eyebrow">NTU CBA CONTENT DESK</p>
    <h1>运营账号登录</h1>
    <p>仅白名单中的社团运营 Gmail 可进入。</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      setSubmitting(true);
      try {
        await signInWithPopup(firebaseAuth()!, new GoogleAuthProvider());
      } catch {
        setError("Google 登录未完成，或当前 Gmail 尚未被列入运营白名单。");
      } finally {
        setSubmitting(false);
      }
    }}>
      {error ? <p className="auth-error">{error}</p> : null}
      <button type="submit" disabled={submitting}>{submitting ? "登录中..." : "使用 Google 登录"}</button>
    </form>
  </section></main>;
}

export async function signOutFirebase() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
}
