# Bug Fixes

Each entry: what was wrong, why it was wrong, how the fix addresses the root cause.

---

## Configuration

### 1. Backend could start before Postgres was ready

`docker-compose.yml` defined a healthcheck on `db`, but `backend` used the short
`depends_on: [db]` form — which only waits for the *container* to start, not for Postgres
to accept connections. The healthcheck was declared and then never consumed, so on a cold
`docker compose up` the backend often raced the database and crashed on startup (only
recovering because of `restart: unless-stopped`).

**Fix:** long-form `depends_on` with `condition: service_healthy`. Startup now shows
`db Waiting → db Healthy → backend Starting`, so the race is gone by construction rather
than being papered over by the restart policy.

### 2. Frontend API URL env var never reached the app

Compose set `VITE_APP_API_URL`, but `src/api.js` reads `import.meta.env.VITE_API_URL`.
The names didn't match, so the variable was always undefined and the app silently fell
through to its hardcoded `http://localhost:8000` default. It *looked* fine locally and
would break the moment the API lived anywhere else.

**Fix:** renamed the compose variable to `VITE_API_URL` so configuration is actually wired
to the code that reads it.

---

## Backend / logic

### 3. `status` filter on orders was accepted and ignored

`list_orders` declared a `status: OrderStatus | None` query parameter, documented it in
OpenAPI — and never applied it to the query. Picking a status in the UI returned unfiltered
results.

**Fix:** added the missing `query.filter(Order.status == status)`.

### 4. Date range filters were inverted

`date_from` filtered `order_date <= date_from` and `date_to` filtered `order_date >= date_to`
— both backwards. Asking for "from January to March" returned everything *outside* that
window, and any sane range returned nothing at all.

**Fix:** flipped both comparisons to `>= date_from` / `<= date_to`.

### 5. Orders pagination skipped the entire first page

Offset was `page * page_size` with a 1-based `page`, so page 1 skipped records 1–10. The
first ten orders were unreachable through the UI, and the last page was always short.

**Fix:** `(page - 1) * page_size`, matching the 1-based `page` the API and frontend both use.

### 6. Clients pagination ignored `page_size`

`list_clients` accepted `page_size`, used it to compute the offset, then called `.limit(10)`
with a hardcoded literal. Offset and limit disagreed, so any non-default page size produced
overlapping or skipped rows.

**Fix:** `.limit(page_size)` so the same value drives both halves of the pagination.

### 7. Client search required the term in name **and** email

The search predicate was `name ILIKE %q% AND email ILIKE %q%`. Since a person's name is
rarely a substring of their email, a search box labelled "Search by name or email" matched
almost nothing.

**Fix:** `or_(...)` — matches either field, which is what the UI promises.

### 8. `GET /api/clients/{id}` returned nothing instead of 404

Unlike every sibling endpoint, `get_client` never checked whether the lookup succeeded. For
a missing id it returned `None`, which then failed `response_model` validation and surfaced
as a 500 — an internal error for what is an ordinary "not found".

**Fix:** raise `HTTPException(404)`, consistent with the other handlers.

### 9. Orders could be created against clients that don't exist

`_ensure_client_exists` was defined in `routers/orders.py` and never called. `create_order`
inserted straight from the payload, so a bad `client_id` fell through to a raw Postgres
foreign-key violation and a 500.

**Fix:** call the existing guard in `create_order` — and in `update_order`, which had the
same hole. A client that doesn't exist is a client error, so it returns 400 with a message
the UI can display.

### 10. Order total was addition, not multiplication

`Order.total` returned `unit_price + quantity`. Every total in the app and API was wrong —
subtly enough to look plausible in a table.

**Fix:** `unit_price * quantity`, rounded to 2 decimals for currency.
Verified: 22 × 365.53 = 8041.66.

### 11. Duplicate client emails were possible despite a 409 handler

Both `create_client` and `update_client` catch `IntegrityError` and return
*"A client with this email already exists"* — but `Client.email` was declared
`index=True` without `unique=True`. There was no constraint to violate, so the handler was
unreachable and duplicates saved happily.

**Fix:** added `unique=True` to the column, and normalize emails to lowercase in the schema
so `CaseTest@` and `casetest@` can't coexist — emails are case-insensitive in practice, and a
case-sensitive constraint would only half-close the hole. The existing error handling now
works as written. (Requires `docker compose down -v` to pick up on an existing volume, since
`create_all` does not alter live tables.)

### 12. Client updates silently dropped phone and address

`update_client` assigned only `name` and `email`, even though `ClientUpdate` carries all
four fields. Editing a client through the form wiped nothing but saved nothing either for
those two fields — the values just didn't change, with no error.

**Fix:** iterate over the validated payload like `update_order` already does, so the schema
is the single source of truth for what's updatable.

### 13. No bounds on pagination parameters

`page` and `page_size` were plain `int`s. `page=0` produced a negative offset, and
`page_size=100000` let any caller pull the whole table in one request.

**Fix:** `Query(ge=1)` on `page` and `Query(ge=1, le=100)` on `page_size` for both list
endpoints — rejected at the edge with a 422 rather than reaching the database.

### 14. No validation on order quantity and price

`quantity` and `unit_price` accepted zero and negatives. The frontend checked for this, but
the API is the actual boundary — anything hitting it directly could store nonsense that then
propagated into totals.

**Fix:** `Field(gt=0)` on both, plus a non-empty constraint on `product_name` and
`Client.name`. Names are stripped before the length check so whitespace-only input
(`" "`) is rejected rather than sneaking past `min_length=1`. The frontend check stays
as fast feedback; the backend now enforces it.

---

## Security

### 15. SQL injection in client search

The search filter interpolated user input directly into raw SQL:

```python
text(f"clients.name ILIKE '%{search}%' AND clients.email ILIKE '%{search}%'")
```

Anything typed into the search box was executed as SQL. A quote in the input was enough to
break out of the string literal — this is a full injection point on an unauthenticated
endpoint.

**Fix:** replaced the raw `text()` with SQLAlchemy column expressions
(`Client.name.ilike(pattern)`), which bind the value as a parameter. The input can no longer
be parsed as SQL regardless of its contents. LIKE wildcards (`%`, `_`, `\`) are also escaped
so they match literally — without that, `search=%` matches every row, which is a correctness
bug rather than a security one but breaks the same feature. Verified: `' OR '1'='1` and `%`
both return 0 results instead of the whole table.

### 16. Stored XSS in the clients table

`ClientsPage` rendered names with `dangerouslySetInnerHTML={{ __html: client.name }}`.
Client names are user-supplied and stored, so a name containing markup executed in the
browser of every user who opened the page.

**Fix:** render as normal JSX text (`{client.name}`), restoring React's automatic escaping.
There was no reason for HTML in a name field.

### 17. Debug mode and a hardcoded secret in production config

`main.py` defined `SECRET_KEY = "dev-secret-please-change-12345"` at module level and
constructed the app with `debug=True`. The key was unused leftover — a committed credential
regardless — and debug mode leaks stack traces and internal paths to clients on any error.

**Fix:** deleted the dead secret and dropped `debug=True`. Any real secret belongs in the
environment, not the repo.

### 18. CORS allowed every origin *with* credentials

`allow_origins=["*"]` combined with `allow_credentials=True` lets any website on the
internet make authenticated cross-origin calls to this API on behalf of a logged-in user.

**Fix:** origins now come from an `ALLOWED_ORIGINS` env var, defaulting to
`http://localhost:5173` and set explicitly in compose. Verified: the frontend origin gets
the CORS header, an arbitrary origin does not.

---

## Frontend / UX

### 19. "Clear filters" only cleared half the filters

`resetFilters` on the orders page reset the date range but left the client and status
dropdowns set — while the dropdowns still visibly displayed their old values. The table
stayed filtered after the user explicitly asked for it not to be.

**Fix:** reset all four filter states.

### 20. Deleting a client had no confirmation

The orders page routes deletes through `ConfirmDialog`; the clients page called the API
directly from `onClick`. The same destructive action behaved differently on two screens —
and client deletes are the *more* destructive of the two, since `cascade="all, delete-orphan"`
takes all of that client's orders with them.

**Fix:** routed client deletion through the same `ConfirmDialog`, with a message that
mentions the cascade so the consequence is visible before confirming.

### 21. The last page of results was unreachable

`Pagination` computed `Math.floor(total / pageSize)`. With 38 orders at 10 per page that
gives 3 pages instead of 4, and the "Next" button disabled itself before the last 8 records.

**Fix:** `Math.ceil` — a partial page is still a page.

### 22. Client form could be double-submitted

`ClientForm` received a `saving` prop, used it for the button *label*, but never set
`disabled`. The order form does both. Nothing stopped a second click during an in-flight
request, which meant duplicate client creation.

**Fix:** `disabled={saving}`, matching `OrderForm`.

### 23. Delete failures vanished silently

Both pages' delete handlers were `async` with no `try/catch`. A failed request became an
unhandled promise rejection: nothing in the UI changed, no error appeared, and the row
stayed put — leaving the user to guess whether it worked.

**Fix:** wrapped both in `try/catch` that surfaces the message through the existing error
banner.

### 24. Search fired a request per keystroke

The clients page called the API on every `search` change. Typing a 10-character name sent
10 requests, and out-of-order responses could leave stale results on screen.

**Fix:** 300 ms debounce — `search` drives the input, a debounced value drives the fetch.

### 25. Client form sent server-owned fields back to the API

`ClientForm` seeded its state with the raw client object, so `id` and `created_at` were
included in the PUT body. Harmless today only because Pydantic ignores unknown fields — it
is still the form claiming ownership of fields it doesn't own.

**Fix:** a `toFormValues` normalizer that picks exactly the four editable fields, mirroring
the pattern `OrderForm` already uses.

### 26. Email field wasn't associated with its label

The email input used a sibling `<span className="field-label">` instead of a wrapping
`<label>` like every other field. No programmatic label association — clicking the text
doesn't focus the input, and screen readers don't announce it.

**Fix:** wrapped it in a `<label>`, consistent with the rest of the form.

---

## Verification

Full stack rebuilt from a clean volume (`docker compose down -v && docker compose up --build`)
and exercised end-to-end. The "after" column is measured; the "before" column is what the
original code does by inspection (only some were reproduced against the running app before
fixing):

| Check | Before | After |
|---|---|---|
| Cold start ordering | backend races db | `db Healthy` → `backend Starting` |
| `total` for 22 × 365.53 | 387.53 | 8041.66 |
| `?status=shipped` | 38 results, mixed | 14 results, all `shipped` |
| `?date_from=2026-01-01&date_to=2026-03-31` | inverted / empty | 2 results in range |
| page 1 / page 2 ids | `[11..15]` / `[16..20]` | `[1..5]` / `[6..10]`, no overlap |
| `?page_size=3` on clients | 10 rows | 3 rows |
| `search=Anas` | 0 hits | 1 hit |
| `search=' OR '1'='1` | injection | 0 hits, parameterized |
| `GET /api/clients/99999` | 500 | 404 |
| `POST` order, bad `client_id` | 500 | 400 |
| `POST` order, `quantity=0` | 201 | 422 |
| `?page=0` / `?page_size=100000` | accepted | 422 |
| Duplicate client email | 201 | 409 |
| Duplicate email, different case | 201 | 409 |
| `search=%` (LIKE wildcard) | all rows | 0 hits, matched literally |
| `name="  "` (whitespace-only) | 201 | 422 |
| CORS from `evil.example` | allowed | no header |
