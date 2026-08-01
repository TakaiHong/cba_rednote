# Firebase Hosting + Cloudflare Worker/D1 Deployment

This is the active public deployment path for the NTU CBA content desk.

- **Firebase Hosting** serves the React dashboard.
- **Firebase Authentication** protects the dashboard with an operator Google account.
- **Cloudflare Worker + Cloudflare D1** in the CBA account stores posts, review history, publishing URLs, and run logs.
- **DeepSeek** is called only by the Worker and its key is kept as a Cloudflare secret.
- The Worker creates one draft at **09:15 Singapore time** for human review.
- Xiaohongshu publishing is manual-only. The cloud application never stores a creator login or clicks Publish.

## Deliberate v1 boundary

The public deployment does **not** enable cloud file uploads. It creates a low-cost sticky-note cover preview directly in the post record, so the dashboard preview works without R2. Use the local workspace when a real PNG/JPG upload or the local PNG cover exporter is needed.

## 1. Create Firebase (no billing account)

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project, or add Firebase to the existing `ntu-cba-rednote` Google Cloud project.
2. Keep the project on the **Spark** plan. Do not link a Cloud Billing account.
3. Add a **Web app** and copy the Firebase Web configuration values.
4. Go to **Authentication > Sign-in method**, enable **Google**. A user is created automatically the first time that Google account signs in.

The frontend Firebase web API key is not a secret; it identifies the Firebase project. The DeepSeek key remains a Worker secret and must never be placed in the frontend environment file or Git.

## 2. Deploy the Worker and D1 in Cloudflare

The Worker is `ntu-cba-content-api` and its logical D1 binding is `DB`. The schema is created by the Worker on its first authenticated request. Runtime values are set in the Cloudflare Worker dashboard, never committed to Git.

For command-line deployment, create a scoped Cloudflare API Token in **My Profile > API Tokens** and set it only in the local PowerShell session:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<token created in the Cloudflare dashboard>"
```

The token needs **Account > Workers Scripts: Edit** and **Account > D1: Edit** for the CBA Cloudflare account. Do not paste the token into this repository or chat. Once authentication is available, confirm the D1 database ID in `worker/wrangler.toml` and deploy:

```powershell
npm.cmd run worker:deploy
```

Set these Worker variables and secrets in the Cloudflare dashboard:

```text
FIREBASE_PROJECT_ID=ntu-cba-rednote
FIREBASE_WEB_API_KEY=<Firebase web API key>
ALLOWED_FIREBASE_EMAILS=<operator Gmail address>
DEEPSEEK_API_KEY=<key>
```

The production Worker API base is `https://ntu-cba-content-api.ntucba2025.workers.dev/api`.

## 3. Deploy Firebase Hosting

Copy `client/.env.production.example` to `client/.env.production.local`. Fill in the Web app configuration and set `VITE_API_BASE` to the Worker URL plus `/api`.

Copy `.firebaserc.example` to `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`.

```powershell
npx.cmd firebase-tools login
npx.cmd firebase-tools deploy --only hosting
```

Open `https://your-project-id.web.app`, sign in with the Firebase operator account, generate one draft, create a sticky-note cover, approve it, then save it to the publishing list.

## 4. Migrate existing local posts

The one-time migration route is protected by a separate Sites secret and never removes the local JSON files. Codex performs this step after the Worker has been deployed, using the configured migration token. The route is not part of the dashboard API.

## Verification checklist

1. `GET https://<worker-domain>/api/health` returns `ok: true`.
2. The Hosting URL shows the Firebase Google sign-in screen before any dashboard content.
3. A non-operator Firebase account receives `403` from the API.
4. A generated draft persists after a page refresh.
5. A generated sticky-note cover appears in the preview.
6. Marking a post as published requires a valid `xiaohongshu.com` URL.
7. The final Xiaohongshu Publish action remains entirely manual.
