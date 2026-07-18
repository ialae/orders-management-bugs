# Changes Summary

This file explains the fixes made in this part of the project.

The goal of these changes was to make the app start reliably, keep the container setup predictable, and tighten the backend so it behaves safely with invalid input, risky defaults, and overly loose request handling.

## Docker and Compose

- Updated [docker-compose.yml](docker-compose.yml) so the backend waits for PostgreSQL health before starting. This avoids startup races where the API tries to connect before the database is ready.
- Added a backend healthcheck and made the frontend wait for the backend to become healthy. This makes the container chain more reliable because the UI only starts once the API is actually responding.
- Corrected the frontend Vite env var from `VITE_APP_API_URL` to `VITE_API_URL`. The app only reads the Vite-prefixed variable, so the old name silently left the frontend pointing at the wrong configuration.
- Externalized the main compose variables with defaults and added [.env.example](.env.example). That keeps the local setup easy to run while making the config easier to override without editing the compose file.
- Strengthened [/.gitignore](.gitignore) so caches, build artifacts, editor folders, and local env files stay out of the repository while [.env.example](.env.example) remains tracked as the documented template.
- The final config cleanup also kept the ignore/template files in sync with the Docker and compose changes, so the repository only tracks the expected example and build inputs.
- Allowed the backend CORS policy to accept the frontend dev server on either `localhost` or the Docker network IP range used by Vite. That fixes the browser-side `Failed to fetch` issue without loosening the API for unrelated origins.
- Kept the container setup in dev mode, but tightened the Dockerfiles for cleaner builds. The result is still easy to run locally, but with less noise and a smaller chance of build-time surprises.
- Fixed missing `AUTO_SEED` environment variable in [docker-compose.yml](docker-compose.yml). The backend reads `AUTO_SEED` to decide whether to seed the database on startup, but it was not set in the compose file. This caused the database to remain empty on first run unless the variable was manually exported. Added `AUTO_SEED: ${AUTO_SEED:-true}` to the backend service environment so seeding happens automatically by default.

## Backend Dockerfile

- Added `PYTHONDONTWRITEBYTECODE` and `PYTHONUNBUFFERED` for cleaner container behavior. These settings stop Python from creating unnecessary bytecode files and make logs appear immediately in container output.
- Upgraded `pip` before installing dependencies. That reduces the risk of hitting old packaging bugs during image builds.
- Added [backend/.dockerignore](backend/.dockerignore) so build context does not include caches, virtual environments, or local env files. Keeping those files out of the image makes builds faster and reduces accidental leakage of local state.
- Disabled Uvicorn access logs in the backend container so the repeated healthcheck requests do not spam the terminal output. That keeps the logs readable while leaving the healthcheck itself in place.

## Frontend Dockerfile

- Kept the Vite dev server container entrypoint. That preserves the current local-development workflow instead of switching the app to a production static server.
- Switched the container install step to `npm ci` with `--no-audit` and `--no-fund` now that a lockfile exists. That makes the build reproducible and keeps the dependency tree aligned with the checked-in lockfile.
- Added [frontend/package-lock.json](frontend/package-lock.json) so the frontend dependencies resolve deterministically instead of changing with each install.

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
- Normalized submitted form values before sending them to the API, which keeps whitespace-only edits and accidental spacing from slipping into the stored data.
- Broke the form handling into small, predictable steps for initialization, validation, normalization, and submit. That makes the code easier to reason about and maintain without changing the user flow.

## Frontend UX Fixes

- Added a confirmation dialog before deleting a client in [ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx). The delete button previously removed the client (and all its orders via cascade) immediately without any warning. The fix uses the existing `ConfirmDialog` component (already used in OrdersPage) to ask "Are you sure you want to delete {name}? This will also delete all their orders." before proceeding. This also required refactoring `handleDelete` to read from `deletingClient` state instead of taking a direct parameter, matching the pattern already established in OrdersPage.

- Fixed the Save button in [ClientForm.jsx](frontend/src/components/ClientForm.jsx) to be disabled while the save operation is in progress. The OrderForm already had `disabled={saving}` on its submit button, but ClientForm was missing this attribute. This prevented potential double-submits that could create duplicate records or cause race conditions.

- Fixed the `clientFilter` type mismatch in [OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx). The filter value was sent to the API as a string (the native type of `<select>` values in React), but the backend expects an integer for the `client_id` query parameter. Added `Number(clientFilter)` conversion when building the API request params so the filter works correctly.

- Fixed the status badge colors in [index.css](frontend/src/index.css) where the `shipped` status was styled with red/danger colors (`#fee2e2` background, `#991b1b` text) and `cancelled` was styled with green/success colors (`#d1fae5` background, `#065f46` text). Swapped them so that "Shipped" (a positive/completed state) uses green and "Cancelled" (a negative/terminal state) uses red, matching user expectations.

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

## Backend Logic Fixes

- Fixed `update_client` in [clients.py](backend/app/routers/clients.py) to properly update `phone` and `address` fields. The original code only updated `name` and `email`, silently ignoring the other two fields. When a client was edited through the UI, phone number and address changes would appear to succeed (HTTP 200 returned) but the database was never updated. Added `client.phone = payload.phone` and `client.address = payload.address` to the update logic so all four fields are persisted.

- Fixed `create_order` and `update_order` in [orders.py](backend/app/routers/orders.py) to return orders with a populated `client_name`. After `db.refresh(order)`, SQLAlchemy's `refresh()` only loads the scalar attributes of the model but does not eagerly load relationships. Since `client_name` is a `@property` that accesses `self.client.name`, it returned an empty string when the `client` relationship was not loaded. Added a `joinedload(Order.client)` query after the refresh to ensure the client relationship is available for the response serialization. Without this fix, newly created or updated orders would show an empty client name in the UI until the page was manually refreshed.

- Made the `phone` field unique in [models.py](backend/app/models.py) to prevent duplicate phone numbers, matching the existing `email` uniqueness behavior. Added `unique=True` to the `Client.phone` column definition. This required updating the seed logic in [seed.py](backend/app/seed.py) to track used phone numbers in a set and regenerate on collision, ensuring all 18 seeded clients get distinct phone values. Also updated the `IntegrityError` error messages in `create_client` and `update_client` in [clients.py](backend/app/routers/clients.py) from `"A client with this email already exists"` to `"A client with this email or phone already exists"` so the user understands that either field could have caused the conflict.

## Configuration Fixes

- Fixed the `__pycache__` gitignore pattern in [.gitignore](.gitignore). The original entry was `_pycache__/` (missing one leading underscore), which did not match the actual `__pycache__/` directories that Python creates. This meant compiled bytecode caches were tracked by Git despite being listed in the ignore file. Corrected the pattern to `__pycache__/` so these build artifacts are properly excluded from version control.

## Second Pass — Additional Bug Fixes

A second audit of the codebase found eight more bugs that were missed in the first pass. The changes below describe each one, why it was wrong, and how it was fixed.

### Backend Query Fix

- Fixed `list_orders` in [orders.py](backend/app/routers/orders.py) so that `count()` is no longer called on a query that already has `joinedload` applied. When `joinedload` is present, SQLAlchemy wraps the entire query in a subquery to compute the count, which is both inefficient and can produce an inaccurate total in edge cases involving duplicate rows from the join. The fix splits the query into two steps: a base query with only the filter conditions is used for `count()`, then `options(joinedload(Order.client))` is applied to that same base query when fetching the actual page of results.

- Fixed the seed guard in [seed.py](backend/app/seed.py) to check `Client.count()` instead of `Order.count()`. The original guard skipped seeding if any orders existed, but if all orders were deleted while clients remained in the database, the condition would be `False` and the seed would re-run. It would then attempt to insert clients with emails and phone numbers that are already in the database, crashing with an `IntegrityError` on the unique constraints. Checking the client count is the correct sentinel because clients are the root entities the seed creates first — if any exist, the database has already been seeded.

### Frontend Error Handling Fixes

- Fixed `handleSave` in [ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx) to catch and surface API errors instead of silently dropping them. The function had a `try/finally` with no `catch` block. When the API returned an error — for example a 409 Conflict for a duplicate email or phone number — the exception was swallowed, the modal closed, and the user received no feedback. Added a `catch` block that sets the page-level error state, and a `setError('')` call at the start of each save attempt to clear any previous message. The same silent-error pattern was present in `handleSave` in [OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx) and was fixed there too.

- Added the missing error banner to the JSX in [ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx). The component tracked an `error` state and set it in `loadClients()` and `handleDelete()`, but there was no corresponding `{error && <div>...</div>}` render in the template. Every error the component produced — network failures, delete errors, server rejections — was invisible to the user. Added the banner below the filter bar, matching the pattern already in place in `OrdersPage`.

- Fixed a race condition in [OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx) where an error from `clientsApi.options()` was immediately overwritten. When the options fetch failed it called `setError(err.message)`, but `loadOrders()` always runs immediately after and calls `setError('')` at the start of its `try` block. This cleared the error before the user could see it, leaving the client dropdown empty with no indication of why. The fix introduces a dedicated `clientsError` state for the options fetch so the two error sources no longer share the same state variable and cannot overwrite each other.

### Frontend Date Display Fix

- Fixed the `order_date` display in [OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx) to parse date strings as local time instead of UTC. The API returns `order_date` as a date-only string such as `"2024-03-15"`. Passing this string directly to `new Date()` causes the browser to parse it as UTC midnight. In any timezone behind UTC — for example UTC−5 — midnight UTC is the previous evening in local time, so the rendered date appears one day earlier than the actual order date. The fix appends `'T00:00:00'` to the date string before constructing the `Date` object, which forces the browser to interpret it as local midnight and display the correct calendar date regardless of timezone.

### Frontend Form Fixes

- Fixed [ClientForm.jsx](frontend/src/components/ClientForm.jsx) to send `null` instead of an empty string for the `phone` and `address` fields when they are left blank. The schema on both the backend model and the Pydantic schema declares these fields as nullable — `str | None` in Python, `unique=True, nullable=True` in the database. Sending an empty string `""` passes Pydantic validation because there is no `min_length` constraint on these optional fields, and it gets stored in the database as a real non-null value. This directly breaks the `unique` constraint on `Client.phone`: PostgreSQL does not allow two rows with the same non-null value, so the second client created without a phone number would receive a 409 Conflict response. Converting empty input to `null` matches the column semantics and allows any number of clients to omit their phone number.

- Fixed the default `order_date` in [OrderForm.jsx](frontend/src/components/OrderForm.jsx) to use the user's local date instead of the UTC date. The original code used `new Date().toISOString().slice(0, 10)`, which returns the current date in UTC. For users in UTC+1 or later, after midnight UTC but before their local midnight, this produces tomorrow's date as the default. For users west of UTC, a similar edge case can produce yesterday's date. Replaced with an explicit construction using `getFullYear()`, `getMonth()`, and `getDate()`, which read from the local timezone and always reflect the correct calendar date for the user.

### Routing Fix

- Added a wildcard catch-all route to [App.jsx](frontend/src/App.jsx). Without it, navigating to any path that the router did not recognise — such as `/settings` or a mistyped URL — rendered an empty `<main>` element with no message, redirect, or user feedback. Added `<Route path="*">` that redirects to `/clients`, matching the same behaviour as the root `"/"` redirect and ensuring the application always lands in a valid state.

### Configuration Documentation Fix

- Added `AUTO_SEED` to [.env.example](.env.example) and added explanatory comments to all variable groups. `AUTO_SEED` was read by [main.py](backend/app/main.py) and declared in [docker-compose.yml](docker-compose.yml) but was absent from `.env.example`, making it invisible to anyone setting up the project from the template. The fix adds the variable with a comment explaining its purpose. The other variables in the file — including `FRONTEND_ORIGIN` and `FRONTEND_ORIGIN_REGEX` — were also given inline comments so their role and when to override them is clear without having to trace through the source code.

## Validation

- `docker-compose config`
- `docker-compose build backend`
- `docker-compose build frontend`
- `docker-compose run --rm backend python -m compileall app`

These checks confirmed that the compose file still renders correctly, both images build cleanly, and the backend code compiles in the container environment after the stricter backend changes.