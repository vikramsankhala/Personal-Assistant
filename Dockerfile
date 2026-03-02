# Unified VPA - Frontend + Backend in one container
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV OUTPUT_MODE=static
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# System deps for audio
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Backend
COPY backend/requirements.txt ./
RUN python -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
RUN mkdir -p uploads data

# Frontend static files
COPY --from=frontend-builder /app/frontend/out ./static

ENV PATH="/opt/venv/bin:$PATH"
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
