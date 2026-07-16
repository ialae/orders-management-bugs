# Docker Changes Summary

This file documents the container-related changes made in this part of the bug-fix pass.

## `docker-compose.yml`

- The backend now waits for PostgreSQL to become healthy before starting.
- The frontend now waits for the backend API healthcheck instead of only waiting for the container to start.
- The frontend environment variable was corrected from `VITE_APP_API_URL` to `VITE_API_URL` so Vite can read it.
- A backend healthcheck was added so Compose can confirm the API is actually ready.

## `backend/Dockerfile`

- Added `PYTHONDONTWRITEBYTECODE=1` to avoid generating `.pyc` files in the container.
- Added `PYTHONUNBUFFERED=1` so logs appear immediately in container output.
- Upgraded `pip` before installing dependencies.

## `frontend/Dockerfile`

- Kept the dev-server container workflow, but made the dependency install quieter with `--no-audit` and `--no-fund`.

## `backend/.dockerignore`

- Added ignore rules for caches, virtual environments, local env files, and other build-noise files.

## Validation

- `docker-compose config`
- `docker-compose build backend`
- `docker-compose build frontend`

All of those checks completed successfully after the Docker updates.