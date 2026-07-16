# Changes Summary

This file explains the fixes made in this part of the project.

## Docker and Compose

- Updated [docker-compose.yml](docker-compose.yml) so the backend waits for PostgreSQL health before starting.
- Added a backend healthcheck and made the frontend wait for the backend to become healthy.
- Corrected the frontend Vite env var from `VITE_APP_API_URL` to `VITE_API_URL`.
- Kept the container setup in dev mode, but tightened the Dockerfiles for cleaner builds.

## Backend Dockerfile

- Added `PYTHONDONTWRITEBYTECODE` and `PYTHONUNBUFFERED` for cleaner container behavior.
- Upgraded `pip` before installing dependencies.
- Added [backend/.dockerignore](backend/.dockerignore) so build context does not include caches, virtual environments, or local env files.

## Frontend Dockerfile

- Kept the Vite dev server container entrypoint.
- Made `npm install` quieter with `--no-audit` and `--no-fund`.

## Backend API fixes

- Fixed client search to use safe SQLAlchemy filters instead of string-built SQL.
- Fixed pagination so `page` works correctly in both clients and orders.
- Fixed order listing filters for `status`, `date_from`, and `date_to`.
- Validated that an order's client exists before create or update.
- Fixed `Order.total` so it returns `quantity * unit_price`.

## Validation

- `docker-compose config`
- `docker-compose build backend`
- `docker-compose build frontend`
- `docker-compose run --rm backend python -m compileall app`

All of these checks passed after the fixes.