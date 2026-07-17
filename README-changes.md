# Changes Summary

This file explains the fixes made in this part of the project.

The goal of these changes was to make the app start reliably, keep the container setup predictable, and tighten the backend so it behaves safely with invalid input, risky defaults, and overly loose request handling.

## Docker and Compose

- Updated [docker-compose.yml](docker-compose.yml) so the backend waits for PostgreSQL health before starting. This avoids startup races where the API tries to connect before the database is ready.
- Added a backend healthcheck and made the frontend wait for the backend to become healthy. This makes the container chain more reliable because the UI only starts once the API is actually responding.
- Corrected the frontend Vite env var from `VITE_APP_API_URL` to `VITE_API_URL`. The app only reads the Vite-prefixed variable, so the old name silently left the frontend pointing at the wrong configuration.
- Kept the container setup in dev mode, but tightened the Dockerfiles for cleaner builds. The result is still easy to run locally, but with less noise and a smaller chance of build-time surprises.

## Backend Dockerfile

- Added `PYTHONDONTWRITEBYTECODE` and `PYTHONUNBUFFERED` for cleaner container behavior. These settings stop Python from creating unnecessary bytecode files and make logs appear immediately in container output.
- Upgraded `pip` before installing dependencies. That reduces the risk of hitting old packaging bugs during image builds.
- Added [backend/.dockerignore](backend/.dockerignore) so build context does not include caches, virtual environments, or local env files. Keeping those files out of the image makes builds faster and reduces accidental leakage of local state.
- Disabled Uvicorn access logs in the backend container so the repeated healthcheck requests do not spam the terminal output. That keeps the logs readable while leaving the healthcheck itself in place.

## Frontend Dockerfile

- Kept the Vite dev server container entrypoint. That preserves the current local-development workflow instead of switching the app to a production static server.
- Made `npm install` quieter with `--no-audit` and `--no-fund`. Those flags do not change behavior, but they reduce unnecessary output when the container is built.

## Frontend Security Fixes

- Removed the raw HTML rendering from the clients table and let React render the name as plain text instead. That closes the XSS-style risk from trusting server data as HTML.

## Frontend Quality Fixes

- Made the API base URL explicit by requiring `VITE_API_URL` instead of silently falling back to a hardcoded localhost value. That keeps configuration intentional and avoids accidental environment drift.
- Fixed the navigation links so only the active route is highlighted. The old code marked every link as active, which made the UI misleading.
- Corrected pagination to use `Math.ceil` so the last partial page is counted properly.
- Removed the hook lint suppressions by memoizing the data loaders and using them in the effects directly. That keeps dependency handling honest instead of bypassing the lint rule.
- Tightened the filter reset and delete flows so they clear the full filter state and surface request errors instead of failing silently.

## Frontend Form Hardening

- Synced the client and order forms with backend limits by adding explicit field lengths and matching numeric bounds. That keeps the browser-side validation aligned with the server and reduces avoidable round-trips.
- Added effect-driven form state resets so the modal forms stay in sync if their source values change while the component is mounted.

## Backend API fixes

- Fixed client search to use safe SQLAlchemy filters instead of string-built SQL. This prevents injection-prone query building and lets the ORM handle escaping properly.
- Fixed pagination so `page` works correctly in both clients and orders. The earlier offset math could skip the first page or return the wrong slice of data.
- Fixed order listing filters for `status`, `date_from`, and `date_to`. Those filters now match the UI labels and return the expected records.
- Validated that an order's client exists before create or update. That protects the database from orphaned references and gives the user a clear validation error.
- Fixed `Order.total` so it returns `quantity * unit_price`. The old logic produced the wrong amount, which would confuse both the UI and any downstream calculations.

## Backend Hardening

- Switched startup to a FastAPI lifespan handler instead of the older startup event. That is the cleaner modern pattern and keeps initialization logic in one place.
- Made automatic seeding opt-in through `AUTO_SEED` instead of running it on every startup. That keeps normal runs deterministic and avoids unexpected data population outside local development.
- Added `extra="forbid"` to the request schemas so unexpected fields are rejected instead of being silently accepted.
- Added validation for invalid order date ranges so `date_from` cannot be after `date_to`.
- Narrowed backend CORS so it only allows the frontend origin and a minimal set of methods/headers. That reduces the chance of accidentally exposing the API too broadly.
- Removed the embedded fallback database URL so the backend now requires `DATABASE_URL` from the environment.
- Added `pool_pre_ping=True` to the SQLAlchemy engine so stale database connections are detected before use.
- Kept database write handling explicit with `IntegrityError` handling on order writes, so failures return a controlled API response instead of leaking an unhandled exception.

## Validation

- `docker-compose config`
- `docker-compose build backend`
- `docker-compose build frontend`
- `docker-compose run --rm backend python -m compileall app`

These checks confirmed that the compose file still renders correctly, both images build cleanly, and the backend code compiles in the container environment after the stricter backend changes.