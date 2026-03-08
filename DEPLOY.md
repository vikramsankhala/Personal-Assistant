# Deploy to Render

## Single URL (Frontend + Backend)

One deployment serves both the web app and API at the same URL.

**Render Web Service settings:**
- **Root Directory:** (empty)
- **Docker Build Context Directory:** `.`
- **Dockerfile Path:** `./Dockerfile`
- **Environment:** `DATABASE_EXTERNAL_URL` = your Postgres External URL
- **Environment:** `ANTHROPIC_API_KEY` or `GROQ_API_KEY` — enables Assistant on cloud (Anthropic from [claude.ai](https://console.anthropic.com), Groq free at [groq.com](https://console.groq.com))

The root `Dockerfile` builds the frontend and backend together. Visit your service URL for the app; `/api` and `/docs` for the API.

---

## Backend Only (Web Service)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. **New** → **Blueprint**
3. Connect your GitHub repo: `https://github.com/vikramsankhala/Personal-Assistant`
4. Render will detect `render.yaml` and create **vpa-db** (PostgreSQL) and **vpa-backend**
5. **When prompted for `DATABASE_EXTERNAL_URL`**: Open your database's page → **Connect** → copy the **External** URL (not Internal) → paste it
6. After deploy, copy the backend URL (e.g. `https://vpa-backend.onrender.com`)

> **If deploy failed with "Name or service not known"**: Add `DATABASE_EXTERNAL_URL` manually: vpa-backend → Environment → Add Variable → paste the External URL from vpa-db Connect menu → Save (triggers redeploy)

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

The internal database hostname often fails to resolve on Render. **Fix**: Add `DATABASE_EXTERNAL_URL`:

1. vpa-db → **Connect** (top right) → copy **External** URL
2. vpa-backend → **Environment** → Add Variable: `DATABASE_EXTERNAL_URL` = (paste the URL)
3. **Save** (triggers redeploy)

## Optional: Redis (for Celery)

For async transcription jobs, add a Redis instance and set `REDIS_URL` and `CELERY_BROKER_URL` in the backend env vars.
