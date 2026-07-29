# Firebase Hosting + Cloudflare Worker Deployment

This is the active public deployment path for the NTU CBA content desk.

- **Firebase Hosting** serves the React dashboard.
- **Firebase Authentication** protects the dashboard with an operator email and password.
- **Cloudflare Worker + D1** stores posts, review history, publishing URLs, and run logs.
- **DeepSeek** is called only by the Worker and its key is kept as a Cloudflare secret.
- The Worker creates one draft at **09:15 Singapore time** for human review.
- Xiaohongshu publishing is manual-only. The cloud application never stores a creator login or clicks Publish.

## Deliberate v1 boundary

The public deployment does **not** enable cloud file uploads. It creates a low-cost sticky-note cover preview directly in the post record, so the dashboard preview works without Cloudflare R2 or a storage subscription. Use the local workspace when a real PNG/JPG upload or the local PNG cover exporter is needed.

## 1. Create Firebase (no billing account)

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project, or add Firebase to the existing `ntu-cba-rednote` Google Cloud project.
2. Keep the project on the **Spark** plan. Do not link a Cloud Billing account.
3. Add a **Web app** and copy the Firebase Web configuration values.
4. Go to **Authentication > Sign-in method**, enable **Email/Password**.
5. Go to **Authentication > Users**, add the operator email and a strong password. Copy that user's **UID**.

The frontend Firebase web API key is not a secret; it identifies the Firebase project. The DeepSeek key remains a Worker secret and must never be placed in the frontend environment file or Git.

## 2. Create Cloudflare D1

Install no global software. From this repository, log in to the free Cloudflare account:

```powershell
npx wrangler login
npx wrangler d1 create ntu-cba-rednote
```

Copy the returned database ID into `worker/wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`. Replace `REPLACE_WITH_FIREBASE_PROJECT_ID` with the Firebase project ID.

Initialize the schema:

```powershell
npx wrangler d1 execute ntu-cba-rednote --remote --file worker/schema.sql
```

## 3. Add Worker secrets and deploy the API

Run each command and paste the value only into the terminal prompt:

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put FIREBASE_WEB_API_KEY
npx wrangler secret put ALLOWED_FIREBASE_UIDS
npm.cmd run worker:deploy
```

For `ALLOWED_FIREBASE_UIDS`, paste the Firebase operator UID from step 1. This is an allow-list: an otherwise valid Firebase user cannot access the content API unless their UID is listed.

Copy the Worker URL printed after deployment, such as `https://ntu-cba-rednote-api.<subdomain>.workers.dev`. Set the following values in `worker/wrangler.toml` and deploy once more:

```toml
FIREBASE_PROJECT_ID = "your-project-id"
ALLOWED_ORIGIN = "https://your-project-id.web.app"
```

## 4. Deploy Firebase Hosting

Copy `client/.env.production.example` to `client/.env.production.local`. Fill in the Web app configuration and set `VITE_API_BASE` to the Worker URL plus `/api`.

Copy `.firebaserc.example` to `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`.

```powershell
npx firebase-tools login
npm.cmd run firebase:deploy
```

Open `https://your-project-id.web.app`, sign in with the Firebase operator account, generate one draft, create a sticky-note cover, approve it, then save it to the publishing list.

## 5. Migrate existing local posts

The migration never removes local files. First generate a SQL import file:

```powershell
npm.cmd run d1:migration:export
npx wrangler d1 execute ntu-cba-rednote --remote --file .tmp/d1-migration.sql
```

## Verification checklist

1. `GET https://<worker-domain>/api/health` returns `ok: true`.
2. The Hosting URL shows the Firebase email/password screen before any dashboard content.
3. A non-operator Firebase account receives `403` from the API.
4. A generated draft persists after a page refresh.
5. A generated sticky-note cover appears in the preview.
6. Marking a post as published requires a valid `xiaohongshu.com` URL.
7. The final Xiaohongshu Publish action remains entirely manual.
