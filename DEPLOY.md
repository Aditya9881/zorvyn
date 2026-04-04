# Deployment Guide

Instructions for deploying the Zorvyn financial dashboard backend to cloud platforms using the production Docker image.

---

## Prerequisites

- Docker image built and tested locally (`docker compose up -d`)
- A GitHub repository with CI passing
- Account on [Render](https://render.com) or [Fly.io](https://fly.io)

---

## Option 1: Deploy to Render

Render supports Docker-based deployments with persistent disks for SQLite.

### Step 1: Create a New Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repository
3. Select **Docker** as the runtime environment

### Step 2: Configure Environment

| Setting | Value |
|---|---|
| **Name** | `zorvyn-api` |
| **Region** | Closest to your users |
| **Instance Type** | Starter ($7/mo) or Free |
| **Docker Build Context** | `.` (root) |
| **Dockerfile Path** | `./Dockerfile` |

### Step 3: Set Environment Variables

In the Render dashboard, add these environment variables:

```
NODE_ENV=production
PORT=3000
DB_PATH=/data/zorvyn.db
ACCESS_TOKEN_SECRET=<generate-a-strong-secret>
REFRESH_TOKEN_SECRET=<generate-a-different-strong-secret>
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

> [!CAUTION]
> **Never use the development secrets in production.** Generate cryptographically secure secrets:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### Step 4: Add Persistent Disk

SQLite requires a persistent disk to survive deploys:

1. Go to **Disks** → **Add Disk**
2. **Name:** `zorvyn-data`
3. **Mount Path:** `/data`
4. **Size:** 1 GB (sufficient for most use cases)

### Step 5: Deploy

Click **Create Web Service**. Render will build the Docker image and deploy.

Verify: `https://zorvyn-api.onrender.com/api/v1/health`

---

## Option 2: Deploy to Fly.io

Fly.io provides edge deployment with persistent volumes.

### Step 1: Install the Fly CLI

```bash
# macOS
brew install flyctl

# Login
fly auth login
```

### Step 2: Launch the App

```bash
cd zorvyn

# Initialize (use existing Dockerfile)
fly launch --name zorvyn-api --no-deploy

# This creates a fly.toml — edit if needed
```

### Step 3: Create a Persistent Volume

```bash
# Create a 1GB volume in your preferred region
fly volumes create zorvyn_data --size 1 --region iad
```

### Step 4: Configure fly.toml

Update the generated `fly.toml`:

```toml
app = "zorvyn-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"
  DB_PATH = "/data/zorvyn.db"

[mounts]
  source = "zorvyn_data"
  destination = "/data"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/api/v1/health"
  timeout = "5s"
```

### Step 5: Set Secrets

```bash
fly secrets set ACCESS_TOKEN_SECRET=$(openssl rand -hex 64)
fly secrets set REFRESH_TOKEN_SECRET=$(openssl rand -hex 64)
fly secrets set ACCESS_TOKEN_EXPIRY=15m
fly secrets set REFRESH_TOKEN_EXPIRY=7d
```

### Step 6: Deploy

```bash
fly deploy
```

Verify: `https://zorvyn-api.fly.dev/api/v1/health`

---

## Post-Deployment Checklist

- [ ] Health check returns `{ "status": "ok" }`
- [ ] Swagger docs accessible at `/api-docs`
- [ ] Registration + login flow works
- [ ] Transaction CRUD returns dollar string amounts
- [ ] Persistent disk survives redeploy (check data after `fly deploy`)
- [ ] Rate limiting is active on `/auth/login`
- [ ] HTTPS is enforced (no HTTP access)
- [ ] Environment secrets are not exposed in logs

---

## Production Scaling Notes

| Concern | Current | When to Upgrade |
|---|---|---|
| **Database** | SQLite (file-based) | > 100 concurrent write users → PostgreSQL |
| **Token Store** | In-memory Map | Multi-instance deployment → Redis |
| **Rate Limiting** | In-memory store | Multi-instance deployment → Redis |
| **Audit Logs** | SQLite table | > 1M entries → External logging (ELK, CloudWatch) |
| **File Storage** | Local persistent disk | Geographic distribution → S3/R2 |
