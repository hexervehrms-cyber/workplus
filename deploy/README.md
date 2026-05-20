# Deployment stack (Docker · NGINX · CI)

## Quick start (local)

1. Copy `backend/.env.example` → `backend/.env` and set `MONGODB_URI`, `JWT_SECRET`, SMTP.
2. Run:

```bash
docker compose up --build
```

- API: http://localhost:5000  
- Web (NGINX): http://localhost:8080  

## Production path

| Layer | Recommendation |
|--------|----------------|
| Containers | Docker images from `backend/Dockerfile` and `frontend/Dockerfile` |
| Orchestration | Kubernetes (GKE/EKS/AKS) or managed Render/Railway for API |
| Edge | Cloudflare (DNS, TLS, WAF, CDN for static assets) |
| Reverse proxy | NGINX Ingress or `deploy/nginx-frontend.conf` pattern |
| CI/CD | GitHub Actions (`.github/workflows/ci.yml`) |
| IaC | Terraform for cloud resources (VPC, cluster, secrets) — add per cloud |

## Render (current)

Keep API on Render; set `FRONTEND_URL`, `CORS_ORIGIN`, Redis `REDIS_URL`, and SMTP env vars.  
Frontend on Vercel with `VITE_API_URL` pointing to the Render API.

## Health

- API: `GET /health` or root health route if configured  
- After deploy: test employee check-in → break → end break → hours this week updates
