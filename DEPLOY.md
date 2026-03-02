# Deploy to Render

## Backend (Web Service)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Connect your GitHub repo: `https://github.com/vikramsankhala/Personal-Assistant`
4. Render will detect `render.yaml` and create:
   - **vpa-backend** (Python Web Service)
   - **vpa-db** (PostgreSQL, free tier)

5. After deploy, copy the backend URL (e.g. `https://vpa-backend.onrender.com`)

## Frontend (Static Site)

1. **New** → **Static Site**
2. Connect the same repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `out`
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = your backend URL (e.g. `https://vpa-backend.onrender.com`)
   - `OUTPUT_MODE` = `static` (enables static export)

## Troubleshooting: "Name or service not known"

If the backend fails with `socket.gaierror: Name or service not known`, the internal database hostname isn't resolving. Try:

1. **Use external URL**: In Render Dashboard → vpa-backend → Environment → Add `DATABASE_EXTERNAL_URL` and paste the **External** connection string from your database's Connect menu (not Internal).
2. **Check regions**: Ensure vpa-backend and vpa-db are in the same region (e.g. Oregon).

## Optional: Redis (for Celery)

For async transcription jobs, add a Redis instance and set `REDIS_URL` and `CELERY_BROKER_URL` in the backend env vars.
