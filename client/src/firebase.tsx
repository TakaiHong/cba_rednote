import { type PropsWithChildren, useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, type User, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const authRequired = import.meta.env.VITE_REQUIRE_FIREBASE_AUTH === "true";
const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

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
  return auth?.currentUser ? auth.currentUser.getIdToken() : undefined;
}

export function FirebaseAuthGate({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(auth, setUser);
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
    <p>仅已授权的社团运营成员可进入。</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      setSubmitting(true);
      try {
        await signInWithEmailAndPassword(firebaseAuth()!, email.trim(), password);
      } catch {
        setError("邮箱或密码不正确，或该账号尚未在 Firebase Auth 中创建。");
      } finally {
        setSubmitting(false);
      }
    }}>
      <label>运营邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      {error ? <p className="auth-error">{error}</p> : null}
      <button type="submit" disabled={submitting}>{submitting ? "登录中..." : "登录运营台"}</button>
    </form>
  </section></main>;
}

export async function signOutFirebase() {
  const auth = firebaseAuth();
  if (auth) await signOut(auth);
}
