# GCP Production Deployment

Recommended architecture: Cloud Run runs the Docker service; Firestore stores posts and run logs; Cloud Storage stores covers and uploaded images; Cloud Scheduler calls the daily generation endpoint. Xiaohongshu login, preflight, and final publishing remain on the operator's local browser. The cloud deployment never stores a login session or starts publishing automation.

## One-time setup

1. Create or select a Google Cloud project and enable Cloud Run, Cloud Build, Firestore, Cloud Storage, Cloud Scheduler, and Secret Manager APIs.
2. Create a Firestore Native database in a region close to the operating team.
3. Create a private Cloud Storage bucket, such as `<project-id>-ntu-cba-assets`.
4. Give the Cloud Run runtime service account Firestore read/write, Storage Object Admin, and Secret Manager Secret Accessor permissions.
5. Create `dashboard-password`, `deepseek-api-key`, and `scheduler-token` in Secret Manager. Never place secrets in Git, `.env.example`, or Cloud Build logs.

## Cloud Run configuration

Build the GitHub repository with its `Dockerfile` and deploy it as a Cloud Run service. Set these environment variables:

```text
NODE_ENV=production
CLOUD_RUNTIME=true
PERSISTENCE_PROVIDER=firestore
ASSET_STORAGE_PROVIDER=gcs
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_STORAGE_BUCKET=<project-id>-ntu-cba-assets
DASHBOARD_USERNAME=operator
MAX_COST_CNY_PER_POST=0.5
DAILY_CRON=15 9 * * *
```

Map these Secret Manager values:

```text
DASHBOARD_PASSWORD=dashboard-password:latest
DEEPSEEK_API_KEY=deepseek-api-key:latest
CLOUD_SCHEDULER_TOKEN=scheduler-token:latest
```

The Cloud Run service is publicly reachable, while the dashboard is protected by `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` Basic Auth. Use `/api/health` as the health check.

## Migrate local data

On a machine with Google Application Default Credentials:

```powershell
$env:PERSISTENCE_PROVIDER = "firestore"
$env:FIREBASE_PROJECT_ID = "<project-id>"
npm.cmd run gcp:migrate
```

The script writes `data/ntu-cba/posts.json` to the Firestore `ntu-cba-posts` collection and `data/run-log.json` to `ntu-cba-run-logs`. It does not delete the local JSON files.

## Daily generation

Create a daily Cloud Scheduler HTTP `POST` job for:

```text
https://<cloud-run-domain>/api/jobs/daily-generate
```

Set `Authorization: Bearer <scheduler-token>` as the request header. This route bypasses dashboard Basic Auth but only accepts the dedicated Scheduler token. Cloud Runtime disables the in-process Node cron to prevent duplicate generation after scaling or restarts.

## Go-live checks

1. Open `/api/health` and confirm the service responds.
2. Open the root URL and enter the dashboard credentials.
3. Create a draft, verify sources, generate or upload a cover, and save it to the publishing list.
4. Restart the Cloud Run revision and confirm the post and cover still exist.
5. Publish manually in Xiaohongshu Creator Center, then paste the published URL back into the dashboard.
