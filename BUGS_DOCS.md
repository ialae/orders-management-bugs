# BUGS_DOCS.md

This file tracks each fix as it is completed. For every bug, I recorded the problem, how I discovered it, the concrete code change, and how I approached the bug and implemented its fix.

---

## Group 1 — Backend: Core business logic

## 1) Order total calculation

### Discovery
While testing order creation, the total displayed in the UI looked incorrect for multi-quantity orders. Inspecting the model revealed that `total` was calculated using addition instead of multiplication.

### Problem
The `Order.total` property was adding `unit_price` and `quantity` instead of computing the line-item amount.

### Approach
Use the business rule implied by the UI and order semantics: total should be `quantity * unit_price`.

### Fix
In [backend/app/models.py](backend/app/models.py), the property now multiplies instead of adds:

```python
@property
def total(self) -> float:
    return float(self.unit_price) * self.quantity
```

### Files modified
- `backend/app/models.py`

---

## 2) Orders pagination offset

### Discovery
When clicking page 2 in the orders list, the first page of results was never visible and it was being skipped entirely. Tracing the offset calculation revealed `page * page_size` instead of `(page - 1) * page_size`.

### Problem
The orders list endpoint was using `page * page_size` as its offset, which caused page 1 to skip the first batch of records.

### Approach
Translate the 1-based page number used by the UI into a zero-based database offset.

### Fix
In [backend/app/routers/orders.py](backend/app/routers/orders.py), the offset now subtracts 1 before multiplying by `page_size`:

```python
items = (
    query.order_by(Order.id.asc())
    .offset((page - 1) * page_size)
    .limit(page_size)
    .all()
)
```

### Files modified
- `backend/app/routers/orders.py`

---

## 3) Orders status and date filtering

### Discovery
While testing the orders page filters, selecting a status from the dropdown had no effect on the results. Additionally, entering a date range from January to March returned orders from a completely different time period, revealing that the date comparisons were reversed.

### Problem
The orders list endpoint accepted a `status` filter but never applied it. The date filters were also reversed: `date_from` was treated like an upper bound and `date_to` like a lower bound.

### Approach
Apply every supplied filter explicitly and use the expected range semantics: `date_from` should be the lower bound and `date_to` should be the upper bound.

### Fix
In [backend/app/routers/orders.py](backend/app/routers/orders.py), the query now applies status and uses the correct date comparisons:

```python
if client_id is not None:
    query = query.filter(Order.client_id == client_id)
if status is not None:
    query = query.filter(Order.status == status)
if date_from is not None:
    query = query.filter(Order.order_date >= date_from)
if date_to is not None:
    query = query.filter(Order.order_date <= date_to)
```

### Files modified
- `backend/app/routers/orders.py`

---

## 4) Client pagination page size

### Discovery
While testing the clients list API with different `page_size` values, noticed the response always returned 10 items regardless of the requested size. The `.limit(10)` was hardcoded instead of using the parameter.

### Problem
The clients list endpoint accepted a `page_size` parameter but always used `.limit(10)` instead of respecting the caller's requested size.

### Approach
Use the `page_size` parameter value in the limit clause so the API returns the requested number of rows.

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), the query now uses the parameter:

```python
total = query.count()
items = (
    query.order_by(Client.created_at.desc())
    .offset((page - 1) * page_size)
    .limit(page_size)
    .all()
)
```

### Files modified
- `backend/app/routers/clients.py`

---

## 5) Invalid order client references

### Discovery
While testing order creation via the API, sent a request with a `client_id` that didn't exist in the database. The order was created successfully instead of returning an error, leaving a broken foreign key reference.

### Problem
The order create and update endpoints accepted any `client_id` from the payload without checking whether that client actually existed.

### Approach
Use the existing client-existence helper before writing an order so the API fails fast with a clear client-side error when the foreign key target is missing.

### Fix
In [backend/app/routers/orders.py](backend/app/routers/orders.py), both order write paths now validate the client first:

```python
@router.post("", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    _ensure_client_exists(db, payload.client_id)
    order = Order(**payload.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_client_exists(db, payload.client_id)

    for key, value in payload.model_dump().items():
        setattr(order, key, value)
```

### Files modified
- `backend/app/routers/orders.py`

---

## 6) Client update persistence

### Discovery
Updated a client's phone number through the form, saved it, and navigated back to the client list but the phone field was still the old value. Checking the update route showed it only persisted `name` and `email`, silently discarding `phone` and `address`.

### Problem
The client update route only wrote `name` and `email`, so edits to `phone` and `address` were silently dropped even though the form and schema included them.

### Approach
Persist every field exposed by the client update form so the backend matches the UI contract.

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), the update route now stores the full payload:

```python
client.name = payload.name
client.email = payload.email
client.phone = payload.phone
client.address = payload.address
```

### Files modified
- `backend/app/routers/clients.py`

---

## 7) Invalid order quantities and floating-point prices

### Discovery
While testing the order form, entered a quantity of 0 and a negative price and both were accepted by the API and stored. Additionally, noticed that order totals had rounding discrepancies when summed, suggesting floating-point storage for monetary values.

### Problem
The order API accepted zero and negative quantities/prices. It also stored money as a binary `Float`, which can introduce rounding errors in order totals. The database had no matching constraints, so a request that bypassed the frontend could persist invalid values.

### Approach
Enforce the same business invariant at both boundaries: request validation rejects invalid input early, while database constraints protect the data if another code path bypasses the API. Store price and total values as fixed precision decimals rather than floating point numbers.

### Fix
In [backend/app/schemas.py](backend/app/schemas.py), `quantity` uses `Field(gt=0)`, `unit_price` is a `Decimal` with `gt=Decimal("0")`, `max_digits=12`, and `decimal_places=2`. `OrderOut.total` uses the same decimal type with matching precision.

In [backend/app/models.py](backend/app/models.py), `unit_price` uses `Numeric(12, 2)` instead of `Float`. The `orders` table defines `CheckConstraint("quantity > 0")` and `CheckConstraint("unit_price > 0")`. The `total` property returns `unit_price * quantity` (decimal * integer = exact decimal).

### Files modified
- `backend/app/schemas.py`
- `backend/app/models.py`

---

## 8) Bound and validate list pagination

### Discovery
Sent a request to the clients list endpoint with `page=-1` and `page_size=0`, which caused a 500 Internal Server Error from the database due to invalid SQL OFFSET/LIMIT values. There was no input validation on the pagination parameters.

### Problem
Both list endpoints accepted `page` and `page_size` without validation. Negative or zero values for either parameter would produce invalid SQL (negative `OFFSET`/`LIMIT`), causing a 500 response. Large `page_size` values could return too many rows and exhaust server memory.

### Approach
I added Pydantic constraints at the API boundary so invalid values are rejected with a clear 422 response before reaching the database layer.

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), both pagination parameters now use `Query` with bounds:

```python
page: int = Query(1, ge=1),
page_size: int = Query(10, ge=1, le=100),
```

In [backend/app/routers/orders.py](backend/app/routers/orders.py), the same constraints are applied to the orders list endpoint.

### Files modified
- `backend/app/routers/clients.py`
- `backend/app/routers/orders.py`

---

## 9) Sort orders list by date descending

### Discovery
Created several orders and noticed the most recent one always appeared at the bottom of the list. The default sort was `id ASC`, which puts the oldest orders first and it's the opposite of what users expect.

### Problem
Orders were sorted by `id ASC`, meaning the oldest orders appeared first and newly created orders were always at the bottom of the table. This is the opposite of what users expect — they almost always want to see the most recent activity first.

### Approach
Change the default sort order to `order_date DESC, id DESC` so that recent orders appear at the top, with newest ID breaking ties on the same date.

### Fix
In [backend/app/routers/orders.py](backend/app/routers/orders.py:42), changed the query sort from `Order.id.asc()` to `Order.order_date.desc(), Order.id.desc()`.

### Files modified
- `backend/app/routers/orders.py`

---

## 10) `update_order` silently resets status to pending

### Discovery
Updated an order's product name via PUT without including `status` in the request body. The order's status silently changed from "shipped" back to "pending" because `OrderUpdate` inherited a default `status=OrderStatus.pending` from `OrderBase`.

### Problem
`OrderUpdate` inherited from `OrderBase` where `status: OrderStatus = OrderStatus.pending`. Pydantic fills in `pending` when `status` is omitted from the request body. The update loop then blindly assigns all fields including `status`. A shipped or cancelled order was silently reverted to `pending` on any edit.

### Approach
Create a dedicated `OrderUpdate` schema with all fields optional (no defaults). In the router, only apply fields that were explicitly provided in the request body using `model_dump(exclude_unset=True)`.

### Fix
In [backend/app/schemas.py](backend/app/schemas.py):
- Replaced `class OrderUpdate(OrderBase): pass` with a standalone `OrderUpdate(BaseModel)` where every field is `None` by default.
- Kept the `product_name` validator (now guards against `isinstance(value, str)` before stripping).

In [backend/app/routers/orders.py](backend/app/routers/orders.py):
- Changed `payload.model_dump()` to `payload.model_dump(exclude_unset=True)` so only fields the caller explicitly sent are applied.
- Moved the `_ensure_client_exists` check inside an `if "client_id" in updates` guard, since `client_id` is now optional.

### Files modified
- `backend/app/schemas.py`
- `backend/app/routers/orders.py`

---

## 11) `update_client` erases optional fields when omitted

### Discovery
Updated a client's name via PUT without including `phone` or `address` in the request body. After saving, the client's phone and address were wiped to null because `ClientUpdate` defaulted optional fields to `None` and the router assigned all fields unconditionally.

### Problem
`ClientUpdate` inherited from `ClientBase` where `phone` and `address` default to `None`. The router explicitly assigned all fields (`client.phone = payload.phone`), so any PUT omitting phone/address would wipe them to `null`.

### Approach
Same pattern as E1: create a dedicated `ClientUpdate` schema with all fields optional (no defaults). Switch the router from field-by-field assignment to a loop with `exclude_unset=True`.

### Fix
In [backend/app/schemas.py](backend/app/schemas.py):
- Replaced `class ClientUpdate(ClientBase): pass` with a standalone `ClientUpdate(BaseModel)` where every field is `None` by default.
- Copied the validators from `ClientBase` (now guard with `isinstance(value, str)` before processing).

In [backend/app/routers/clients.py](backend/app/routers/clients.py):
- Replaced the four explicit assignments (`client.name = payload.name`, etc.) with a loop over `payload.model_dump(exclude_unset=True)`.

### Files modified
- `backend/app/schemas.py`
- `backend/app/routers/clients.py`

---

## Group 2 — Backend: Data validation & integrity

## 12) Client search safety and logic

### Discovery
While reviewing the client search implementation, noticed the raw SQL interpolation and that searching by just a name or just an email returned no results and the query required both to match simultaneously.

### Problem
The clients search query was interpolating raw user input into SQL and required both the name and email to match at the same time. That made the search fragile and incorrect for the UI's "name or email" behavior.

### Approach
Replace the raw SQL text fragment with parameterized SQLAlchemy filtering and match either field using `OR`.

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), the search now uses `or_` and `ilike` with a bound pattern:

```python
if search:
    pattern = f"%{search}%"
    query = query.filter(or_(Client.name.ilike(pattern), Client.email.ilike(pattern)))
```

### Files modified
- `backend/app/routers/clients.py`

---

## 13) Client email uniqueness

### Discovery
While testing client creation, submitted two clients with the same email address via the API. Both were created without error, even though the backend code already had a conflict handler for duplicate emails that was never being triggered.

### Problem
The client model did not enforce email uniqueness at the database level, even though the API already treated duplicate emails as a conflict case.

### Approach
Make email uniqueness a schema rule so the database enforces the invariant instead of relying only on application code.

### Fix
In [backend/app/models.py](backend/app/models.py), the `Client.email` column is now marked unique:

```python
email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
```

### Files modified
- `backend/app/models.py`

---

## 14) Validate and normalize client/order text input

### Discovery
Created a client with a name of `"   "` (spaces only) and it was accepted. Also created two clients with `John@Example.com` and `john@example.com` and both were stored as separate records despite being the same email address, since the unique constraint was case sensitive.

### Problem
Client name, email, and order product_name had no length limits matching the database columns. Leading/trailing whitespace was accepted and stored as-is. Blank-only strings (e.g., `"   "`) passed validation for required fields. Email uniqueness was case-sensitive at the database level, so `John@Example.com` and `john@example.com` were treated as distinct clients despite being the same email address.

### Approach
Add Pydantic `max_length` constraints matching database column sizes. Add `field_validator` decorators to strip whitespace and reject blank values on required text fields. Normalize email to lowercase before storage so the existing `unique=True` constraint effectively enforces case-insensitive uniqueness.

### Fix
In [backend/app/schemas.py](backend/app/schemas.py):
- `ClientBase.name` has `max_length=255` and a `field_validator` that strips whitespace and rejects blank values.
- `ClientBase.email` has `max_length=255` and a `field_validator` that strips whitespace, rejects blanks, and lowercases the value.
- `ClientBase.address` has `max_length=500` matching the database column.
- `OrderBase.product_name` has `max_length=255` and a `field_validator` that strips whitespace and rejects blank values.

A shared `_strip_and_reject_blank` helper avoids duplicating the stripping logic across validators.

### Files modified
- `backend/app/schemas.py`

---

## 15) Validate order date filter ranges

### Discovery
On the Orders page, set the date range from March 2024 to January 2024 (inverted range) and got an empty table with no explanation. The API accepted the impossible range and returned zero results without any error message.

### Problem
The orders list endpoint accepted any combination of date_from and date_to without validating them against each other. When a user set date_from after date_to (e.g., from=2024-06-01, to=2024-01-01), the filter resulted in an empty set because no date can satisfy both conditions simultaneously. The user saw an empty table with no explanation.

### Approach
Reject the range at the API boundary with a clear error before the query executes. Additionally, prevent the invalid range at the frontend by adding min/max constraints to the date inputs.

### Fix
In [backend/app/routers/orders.py](backend/app/routers/orders.py), added a guard clause before the filter logic:

```python
if date_from is not None and date_to is not None and date_from > date_to:
    raise HTTPException(
        status_code=422,
        detail="date_from must not be later than date_to",
    )
```

In [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx), the From input has `max={dateTo || undefined}` and the To input has `min={dateFrom || undefined}` so the browser prevents selecting an invalid range before the request is sent.

### Files modified
- `backend/app/routers/orders.py`
- `frontend/src/pages/OrdersPage.jsx`

---

## 16) Added optional indicators to client form

### Discovery
While reviewing the client form UI for consistency, noticed that required fields (name, email) and optional fields (phone, address) all looked the same. Users had no way to tell which fields were optional without submitting an empty form.

### Problem
Phone and Address fields in the client form had no indication they were optional.

### Approach
Add "(optional)" to the label text.

### Fix
In [frontend/src/components/ClientForm.jsx](frontend/src/components/ClientForm.jsx), changed "Phone" to "Phone (optional)" and "Address" to "Address (optional)".

### Files modified
- `frontend/src/components/ClientForm.jsx`

---

## 17) LIKE wildcard characters unescaped in client search

### Discovery
Searched for "100%" in the client search expecting to match client names containing "100%", but the query matched many unrelated results because `%` and `_` were interpreted as SQL LIKE wildcards.

### Problem
Searching for `%` or `_` in the client search field matches unintended rows (`%` matches any sequence, `_` matches any single character).

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), escaped `%` and `_` (and `\` itself as a safety measure) before building the ILIKE pattern, with `escape="\\"` passed to the ILIKE call.

### Files modified
- `backend/app/routers/clients.py`

---

## Group 3 — Backend: Error handling & transactions

## 18) Transaction-safety and deliberate error handling

### Discovery
While reviewing the order creation endpoint, noticed that if `db.commit()` threw an exception (e.g., a constraint violation), the SQLAlchemy session was left in a failed state with no rollback. Subsequent requests on the same session would have failed unpredictably.

### Problem
Several write paths did not wrap `db.commit()` in try/except blocks. If a commit failed (e.g., database constraint violation, connection loss), the SQLAlchemy session was left in a failed state without rollback. The orders create, update, and delete paths had no error handling at all. The clients create and update paths caught `IntegrityError` but would let any other exception escape without rolling back.

### Approach
Wrap every `db.commit()` in a try/except block that rolls back the transaction on failure before re-raising. For the clients create/update paths, keep the existing `IntegrityError` → 409 translation and add a generic `Exception` fallback.

### Fix
In [backend/app/routers/orders.py](backend/app/routers/orders.py), all three mutation endpoints now wrap commit with rollback:

```python
try:
    db.commit()
except Exception:
    db.rollback()
    raise
```

In [backend/app/routers/clients.py](backend/app/routers/clients.py), the delete endpoint uses the same pattern. The create and update endpoints now have an additional `except Exception` fallback after the existing `except IntegrityError` to ensure rollback on unexpected failures.

### Files modified
- `backend/app/routers/orders.py`
- `backend/app/routers/clients.py`

---

## 19) Missing 404 for get client by id

### Discovery
Requested a client by a non-existent ID via the API and received a `null` response body with a 200 status instead of a proper not-found error.

### Problem
The client detail endpoint returned whatever `db.get(...)` produced, which meant missing records were returned as `None` instead of a proper not-found response.

### Approach
Check the lookup result and raise an explicit 404 when the client does not exist.

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), the endpoint now fails fast for missing clients:

```python
@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client
```

### Files modified
- `backend/app/routers/clients.py`

---

## Group 4 — Backend: Security

## 20) Prevent deleting clients with existing orders

### Discovery
Deleted a client that had several associated orders, and noticed that all the orders silently disappeared from the database. The cascade relationship on the Client model was set to `all, delete-orphan`, causing unintended data loss.

### Problem
Deleting a client with orders silently destroyed all associated order records due to the `cascade="all, delete-orphan"` relationship on the Client model. The delete endpoint had no guard to prevent this, so a single click could erase order history without warning.

### Approach
Adopt a restrict policy: clients with orders cannot be deleted. The API checks for existing orders before attempting deletion and returns a 409 Conflict with a count of associated orders. The cascade on the model is removed to document the intent and provide a second layer of protection.

### Fix
In [backend/app/routers/clients.py](backend/app/routers/clients.py), the delete endpoint now checks for existing orders before proceeding:

```python
order_count = db.query(Order).filter(Order.client_id == client_id).count()
if order_count > 0:
    raise HTTPException(
        status_code=409,
        detail=f"Client has {order_count} order(s). Remove them before deleting the client.",
    )
```

In [backend/app/models.py](backend/app/models.py), the cascade on the Client-Order relationship is changed from `"all, delete-orphan"` to no cascade, preventing accidental deletion through the relationship.

In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx), the `confirmDelete` function now catches errors (including the 409) and displays them in the confirmation dialog. The error is cleared when the dialog is dismissed.

### Files modified
- `backend/app/routers/clients.py`
- `backend/app/models.py`
- `frontend/src/pages/ClientsPage.jsx`

---

## 21) Remove hardcoded placeholder secret

### Discovery
While reviewing `main.py` for security concerns, found a hardcoded `SECRET_KEY` variable assigned a placeholder value. Although it wasn't being used anywhere, having a committed secret string sets a dangerous precedent.

### Problem
`main.py` contained a hardcoded `SECRET_KEY = "dev-secret-please-change-12345"` that was never consumed anywhere in the application. A committed placeholder secret sets a bad security precedent and could be mistaken for a required credential.

### Approach
Remove the unused variable from source. Add a `.env.example` file documenting the variable for future use, and a comment in `main.py` pointing to it.

### Fix
In [backend/app/main.py](backend/app/main.py), the `SECRET_KEY` assignment is replaced with a comment noting the variable is reserved for future use.

Created [.env.example](.env.example) at the project root documenting the available environment variable.

### Files modified
- `backend/app/main.py`
- `.env.example` (new)

---

## 22) Restrict CORS to trusted frontend origins

### Discovery
While reviewing the CORS configuration in `main.py`, noticed the API was configured with `allow_origins=["*"]` and `allow_credentials=True`. This wildcard policy with credentials is a security anti-pattern that allows any website to make authenticated requests to the API.

### Problem
The API allowed any origin (`*`) with credentials enabled and unrestricted methods/headers. This exposes the API to cross-origin requests from untrusted domains. While the app has no authentication yet, the wildcard policy is a security anti-pattern that should not be the default.

### Approach
Replace the wildcard policy with an environment-configured allowlist defaulting to `http://localhost:5173` (the Vite dev server). Disable credentials since the app does not use cookies or auth headers. Restrict methods and headers to the minimum the API uses.

### Fix
In [backend/app/main.py](backend/app/main.py), the CORS middleware now reads allowed origins from `CORS_ORIGINS` env var (comma-separated, defaulting to `http://localhost:5173`):

```python
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
```

Updated [.env.example](.env.example) to document the new variable.

### Files modified
- `backend/app/main.py`
- `.env.example`

---

## Group 5 — Backend: Seed / data setup

## 23) Seed guard checks Order table instead of Client

### Discovery
Deleted all orders to test the app with an empty dataset, then restarted the server. The seed function ran again and created duplicate clients on top of the existing ones, because it only checked `Order.count()` before deciding to seed.

### Problem
`seed_if_empty` returns early if `Order.count() > 0`. If orders are deleted but clients remain, re-running startup creates duplicate clients.

### Fix
In [backend/app/seed.py](backend/app/seed.py), changed `db.query(Order).count()` to `db.query(Client).count()` so the seed only runs when there are no clients at all.

### Files modified
- `backend/app/seed.py`

---

## Group 6 — Frontend: UI/UX

## 24) Clients pagination display

### Discovery
Navigated to the clients page with more than 10 clients and noticed the footer showed "Page 1 of 1" despite there being multiple pages of data. The `Math.floor` in the pagination component was undercounting the total pages.

### Problem
The clients page was hardcoded to show 10 rows per page, and the shared pagination component used `Math.floor`, which caused the footer to undercount pages. That made the table show a misleading `Page 1 of 1` summary for a larger total.

### Approach
Keep the client page size fixed at 10 rows and round page counts up so partially filled pages are still counted.

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx), the page uses a fixed `PAGE_SIZE` constant:

```javascript
const PAGE_SIZE = 10
```

The loader and footer now use that constant:

```javascript
const data = await clientsApi.list({ search, page, page_size: PAGE_SIZE })
...
<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
```

In [frontend/src/components/Pagination.jsx](frontend/src/components/Pagination.jsx), the page count now rounds up:

```javascript
const totalPages = Math.max(1, Math.ceil(total / pageSize))
```

### Files modified
- `frontend/src/pages/ClientsPage.jsx`
- `frontend/src/components/Pagination.jsx`

---

## 25) Clear filters behavior

### Discovery
On the Orders page, selected a client and status filter, then clicked "Clear filters". The date fields reset but the client and status dropdowns remained set, leaving the table in a partially filtered state.

### Problem
The Orders page "Clear filters" button only reset the date fields, so the client and status filters stayed active even though the UI implied a full reset.

### Approach
Reset every filter state variable along with the page number so the button actually clears the entire filter set.

### Fix
In [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx), the reset handler now clears client, status, and date filters:

```javascript
function resetFilters() {
    setPage(1)
    setClientFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
}
```

### Files modified
- `frontend/src/pages/OrdersPage.jsx`

---

## 26) Navigation active state

### Discovery
Navigated to the Clients page and noticed both the "Clients" and "Orders" nav links appeared highlighted simultaneously. Inspecting the NavBar component showed that `className="active"` was hardcoded on both `NavLink` elements.

### Problem
The NavBar component assigned `className="active"` to both navigation links statically, so both tabs appeared highlighted at all times regardless of the current route. This broke the visual feedback that should indicate which page the user is currently viewing.

### Approach
Replace the static class assignment with a function-based className that uses React Router's `isActive` flag to dynamically determine whether to apply the active class based on the current route.

### Fix
In [frontend/src/components/NavBar.jsx](frontend/src/components/NavBar.jsx), both NavLink components now use the `isActive` callback:

```javascript
<NavLink to="/clients" className={({ isActive }) => (isActive ? 'active' : '')}>
  Clients
</NavLink>
<NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
  Orders
</NavLink>
```

### Files modified
- `frontend/src/components/NavBar.jsx`

---

## 27) Client deletion confirmation dialog

### Discovery
Accidentally clicked the Delete button on a client row and the client was immediately removed with no confirmation prompt. The Orders page already had a confirmation dialog for deletes, but the Clients page did not.

### Problem
The clients page allowed users to immediately delete a client when clicking the Delete button, without any confirmation prompt. This could lead to accidental data loss for users performing a mistaken click.

### Approach
Reuse the existing `ConfirmDialog` component to require explicit confirmation before deleting a client, matching the same behavior already used for order deletions.

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx):
- Added `ConfirmDialog` import.
- Introduced `deletingClient` state to track the pending deletion target.
- Changed the Delete button to set `deletingClient` instead of deleting immediately.
- Rendered `ConfirmDialog` when `deletingClient` is set.
- Implemented `confirmDelete()` to remove the client only after the user confirms.

### Files modified
- `frontend/src/pages/ClientsPage.jsx`

---

## 28) Show client-list request errors and add retry

### Discovery
Simulated an API failure on the Clients page and saw an empty table with "No clients found" — the error state was stored but never rendered. There was no way to tell whether the table was empty because of no data or because of a failed request.

### Problem
The Clients page stored API errors in state but never rendered them. When the API failed, users saw an empty table with "No clients found" and no indication that something went wrong. There was no way to retry the failed request without navigating away.

### Approach
Render the error message above the table (matching the pattern already used by the Orders page) and add a Retry button that re-invokes the load function.

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx):
- Added an error banner before the table that displays the error message with a Retry button.
- Changed the empty-state condition to `clients.length === 0 && !error` so it only shows "No clients found" when there is no error.

### Files modified
- `frontend/src/pages/ClientsPage.jsx`

---

## 29) Separate order-list and client-option request state

### Discovery
On the Orders page, the client options dropdown for the order form was empty. Checking the network tab showed the options request had failed, but the error was displayed as a banner over the entire page even though the orders list itself loaded fine. The two requests shared the same `error` state.

### Problem
The client options fetch (`/api/clients/options`) shared the same `error` state as the orders list fetch. If the options request failed, the error was displayed over the entire orders page even if the orders list itself loaded successfully. Additionally, the OrderForm dropdown had no loading state so users saw an empty dropdown with no way to tell if options were still loading or unavailable.

### Approach
Give the client options their own `optionsLoading` and `optionsError` state, independent of the orders list. Show a loading message in the dropdown while options are loading, and display errors inline.

### Fix
In [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx):
- Added `optionsLoading` and `optionsError` state.
- The client options fetch uses its own state instead of setting the shared `error`.
- `optionsLoading`, `optionsError`, and `clientOptions` are passed to OrderForm.

In [frontend/src/components/OrderForm.jsx](frontend/src/components/OrderForm.jsx):
- Accepts new `optionsLoading` and `optionsError` props.
- Shows "Loading clients..." text while options are loading.
- Displays error inline if options fail to load.
- Hides the select dropdown entirely while loading to prevent confusion.

### Files modified
- `frontend/src/pages/OrdersPage.jsx`
- `frontend/src/components/OrderForm.jsx`

---

## 30) Handle save/delete pending and failure states

### Discovery
Double-clicked the Save button on the ClientForm and the API was called twice, creating a duplicate client. Also tested deleting an order when the API was down and got an unhandled promise rejection with no user feedback.

### Problem
Multiple gaps in mutation UX: the ClientForm save button was not disabled during submission (double-click risk), the ConfirmDialog had no loading or error state, and the OrdersPage delete handler did not catch errors (unhandled rejection).

### Approach
Disable submit buttons while requests are in flight so duplicate submissions are prevented. Give ConfirmDialog a loading state and error display. Add proper error handling to the OrdersPage delete flow.

### Fix
In [frontend/src/components/ClientForm.jsx](frontend/src/components/ClientForm.jsx), the Save button now uses `disabled={saving}`.

In [frontend/src/components/ConfirmDialog.jsx](frontend/src/components/ConfirmDialog.jsx), added `loading` and `error` props. The Delete button shows "Deleting..." and is disabled while loading. Errors are displayed above the confirmation message.

In [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx):
- Added `deleting` and `deleteError` state.
- `handleDelete` now catches errors and manages loading state.
- ConfirmDialog receives `loading` and `error` props.

In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx):
- Added `deleting` state managed around the API call.
- ConfirmDialog receives `loading` and `error` props.

### Files modified
- `frontend/src/components/ClientForm.jsx`
- `frontend/src/components/ConfirmDialog.jsx`
- `frontend/src/pages/OrdersPage.jsx`
- `frontend/src/pages/ClientsPage.jsx`

---

## 31) Clamp pagination after mutations

### Discovery
Deleted the last order on page 3 of 3 and was left on a blank page with "No orders found" and "Page 3 of 2". The page state was not being adjusted after the deletion reduced the total page count.

### Problem
After deleting the last item on the last page, the re-fetch returns 0 items because the current page no longer exists. The page state is stuck beyond the valid range, leaving the user on an empty page with no way to navigate back.

### Approach
After any mutation triggers a re-fetch, check if the response is empty for a page > 1. If so, decrement the page and let the `useEffect` re-trigger the fetch on the valid page.

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx) and [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx), added a guard after the stale-response check:

```javascript
if (data.items.length === 0 && data.page > 1) {
  setPage(data.page - 1)
  return
}
```

When the response is empty but there are earlier pages, we bump back by one page. `setPage` triggers the `useEffect` dependency, which re-calls `loadClients`/`loadOrders` with the corrected page.

### Files modified
- `frontend/src/pages/ClientsPage.jsx`
- `frontend/src/pages/OrdersPage.jsx`

---

## 32) Refine empty states

### Discovery
Applied a filter on the Orders page that matched nothing and saw "No orders found." which is the same message shown when the database is genuinely empty. There was no way to distinguish between "no data exists" and "your filters returned nothing".

### Problem
The empty state messages were identical regardless of context. "No clients found." / "No orders found." was shown both when the database was empty and when filters/search returned no results. Users had no way to tell if their filter was too restrictive or if there was genuinely no data.

### Approach
Detect whether filters are active and show a context-appropriate message:
- When filters are active → "No [clients/orders] match your [search/filters]."
- When no filters are active → "No clients yet." / "No orders yet."

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx): if `search` is non-empty, show "No clients match your search." otherwise "No clients yet."

In [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx): if any filter is active (`clientFilter`, `statusFilter`, `dateFrom`, `dateTo`), show "No orders match your filters." otherwise "No orders yet."

### Files modified
- `frontend/src/pages/ClientsPage.jsx`
- `frontend/src/pages/OrdersPage.jsx`

---

## 33) Scale the client selector

### Discovery
Seeded the database with thousands of clients and opened the Orders page and the client dropdown fetched every client in a single unbounded request and rendered an unusably long list that lagged the browser.

### Problem
The Orders page loaded ALL clients into two `<select>` elements (filter bar + order form). With thousands of clients, the API response was unbounded and the dropdowns were unusably large and slow.

### Approach
Create a `ClientSearch` component that searches clients as the user types, with debounced API calls. Replace both `<select>` instances in OrdersPage and OrderForm.

### Fix
Created [frontend/src/components/ClientSearch.jsx](frontend/src/components/ClientSearch.jsx):
- Text input with debounced search (300ms delay)
- Fetches from `clientsApi.list({ search, page_size: 20 })`
- Dropdown with results, click to select
- Handles `value` prop changes (e.g., when editing an existing order, fetches the client name by ID)
- Clears input when `value` becomes empty (e.g., reset filters)
- Accepts `inputRef` for initial focus in the form
- Click-outside closes the dropdown

Updated [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx):
- Removed `clientsApi.options()` call and `clientOptions`/`optionsLoading`/`optionsError` state
- Replaced the client filter `<select>` with `ClientSearch`

Updated [frontend/src/components/OrderForm.jsx](frontend/src/components/OrderForm.jsx):
- Removed `clientOptions`, `optionsLoading`, `optionsError` props
- Replaced the client `<select>` with `ClientSearch`

Added CSS in [frontend/src/index.css](frontend/src/index.css):
- `.client-search` — relative positioning for dropdown
- `.client-search > input` — styled like other inputs
- `.client-search-dropdown` — absolute positioned, z-indexed above modal
- `.client-search-option` — hover, active, and disabled states
- `.filter-search-wrapper` — width constraint in the filter bar

### Files modified
- `frontend/src/components/ClientSearch.jsx` (new)
- `frontend/src/pages/OrdersPage.jsx`
- `frontend/src/components/OrderForm.jsx`
- `frontend/src/index.css`

---

## 34) Post-save refresh errors silently swallowed

### Discovery
While tracing through the save flow in the frontend, noticed that `setShowForm(false)` ran before `await loadClients()`. Realized that if the refresh failed, the form was already unmounted and the error had nowhere to go.

### Problem
In both ClientsPage and OrdersPage, `setShowForm(false)` was called *before* `await loadClients()`/`loadOrders()`. If the save succeeded but the subsequent list refresh failed, the error was lost because:
1. The form had already unmounted (setShowForm already ran)
2. The error from loadClients propagated to the form's catch block
3. But the form was no longer rendered, so the error was never displayed

The user saw the form close and had no indication that the list data was stale.

### Approach
Swap the order: refresh the list *first*, then close the form only if the refresh succeeds. If the refresh fails, the error propagates to the form's catch block and is displayed there.

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx) and [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx), moved `setShowForm(false)` after `await loadClients()`/`await loadOrders()`.

### Files modified
- `frontend/src/pages/ClientsPage.jsx`
- `frontend/src/pages/OrdersPage.jsx`

---

## 35) OrderForm `min="0"` on unit price contradicts JS validation

### Discovery
While reading through OrderForm's JSX, noticed the unit price input had `min="0"` but the validation just below it rejected `<= 0`. The two layers disagreed on what values are valid.

### Problem
HTML `min="0"` on the unit price input allows 0, but JS validation (`Number(form.unit_price) <= 0`) rejects it.

### Fix
Changed `min="0"` to `min="0.01"` in [frontend/src/components/OrderForm.jsx](frontend/src/components/OrderForm.jsx).

### Files modified
- `frontend/src/components/OrderForm.jsx`

---

## 36) ClientSearch no request deduplication

### Discovery
While looking at the ClientSearch component, realized there was no mechanism to cancel in-flight requests. Typing quickly would fire multiple overlapping requests, and a slow stale response could overwrite newer results.

### Problem
When typing quickly in ClientSearch, multiple search requests fire in parallel. A stale (slower) response can arrive after a newer one and overwrite `results` with outdated data. The user sees wrong results.

### Fix
Added an `AbortController` in `search()`, so when a new search starts, the previous in-flight request is aborted. Also updated `clientsApi.list` in `api.js` to accept an optional `options` parameter (forwarded to `request` → `fetch`), so the `signal` is passed through.

### Files modified
- `frontend/src/components/ClientSearch.jsx`
- `frontend/src/api.js`

---

## 37) No 404 catch-all route

### Discovery
Navigated to `/xyz` in the browser and saw only the navbar with a blank page. No error message, no indication the page didn't exist.

### Problem
Navigating to `/settings` or any unknown path renders a blank page with just the navbar. No feedback that the page doesn't exist.

### Fix
Added a `NotFoundPage` component and a `<Route path="*">` catch-all in `App.jsx` that renders it.

### Files modified
- `frontend/src/App.jsx`
- `frontend/src/pages/NotFoundPage.jsx`

---

## Group 7 — Frontend: Display & formatting

## 38) Unsafe client name rendering

### Discovery
While auditing the ClientsPage component, noticed `dangerouslySetInnerHTML` being used to render the client name field. This would allow arbitrary HTML injection if a client name contained a script tag.

### Problem
The clients table cell rendered the name field using `dangerouslySetInnerHTML`, which interpreted user-supplied text as raw HTML instead of escaping it. This created an injection vulnerability where malicious content in a client name could execute in the browser.

### Approach
Switch from `dangerouslySetInnerHTML` to direct text rendering so React's default escaping protects against injection.

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx), the name cell now renders as plain text:

```javascript
<td>{client.name}</td>
```

### Files modified
- `frontend/src/pages/ClientsPage.jsx`

---

## 39) Frontend API env var mismatch

### Discovery
Deployed the app with docker-compose and set a custom `VITE_APP_API_URL` to point the frontend at a different backend. The frontend continued connecting to `localhost:8000`, the compose variable name didn't match what the code actually reads.

### Problem
The frontend code reads the environment variable `VITE_API_URL`, but docker-compose was setting `VITE_APP_API_URL`. Because the names didn't match, the compose configuration had no effect and the frontend would always fall back to the hardcoded local URL, making it impossible to override the backend address via environment configuration.

### Approach
Align the environment variable names so they match exactly between docker-compose and the frontend code.

### Fix
In [docker-compose.yml](docker-compose.yml), updated the frontend service environment to use the correct variable name:

```yaml
environment:
  VITE_API_URL: http://localhost:8000
```

### Files modified
- `docker-compose.yml`

---

## 40) Correct date-only and currency display

### Discovery
Viewed an order created on January 1st from a UTC+ negative timezone and the date showed December 31st — `new Date("2024-01-01")` was interpreted as midnight UTC, shifting the day backward. Also noticed order totals displayed as `$1234.56` instead of `$1,234.56`.

### Problem
Two display bugs:
1. **Date shifting**: `new Date(order_date).toLocaleDateString()` interprets the `YYYY-MM-DD` string as midnight UTC, so users in negative timezones see the previous day's date.
2. **Fragile currency formatting**: `$...toFixed(2)` hardcodes the `$` symbol and does not apply locale grouping (e.g. `1234.56` instead of `1,234.56`).

### Approach
Create a small `format.js` utility module with two helpers and replace all inline formatting.

### Fix
Created [frontend/src/format.js](frontend/src/format.js):
- `formatDate(dateStr)` — returns the raw string unchanged, since the API already returns `YYYY-MM-DD` in the correct format.
- `formatCurrency(amount)` — uses `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` for locale-aware grouping and currency symbol.

Updated [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx) and [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx) to use both helpers instead of inline `new Date()` and template-literal formatting.

### Files modified
- `frontend/src/format.js` (new)
- `frontend/src/pages/ClientsPage.jsx`
- `frontend/src/pages/OrdersPage.jsx`

---

## 41) OrderForm `product_name` not trimmed before sending

### Discovery
Read through the OrderForm payload construction and noticed `product_name` was sent as-is without trimming. Leading/trailing spaces would be stored in the database.

### Problem
Leading/trailing whitespace in product names was sent to and stored in the database.

### Fix
Added `.trim()` to `payload.product_name` in `OrderForm.handleSubmit`.

### Files modified
- `frontend/src/components/OrderForm.jsx`

---

## 42) No request timeout in api.js

### Discovery
While reviewing the `request` function in api.js, noticed that `fetch` was called without any timeout mechanism. If the backend hung, the UI would wait forever with no way to recover.

### Problem
If the backend hangs or is unreachable (e.g., server down, network issue), every `fetch` call hangs indefinitely. The user sees no feedback and the UI just stays in a loading state forever.

### Fix
Added a `signalWithTimeout` helper that creates an AbortController with a 30s timeout. It also respects an external signal (used by ClientSearch dedup). If either the timeout or the external signal fires, the request is aborted.

The `request` function now applies this timeout signal to every request. If a timeout occurs, `fetch` throws an `AbortError` which propagates as a regular error to the caller.

### Files modified
- `frontend/src/api.js`

---

## Group 8 — Frontend: CSS & visual polish

## 43) Made the tables and controls responsive

### Discovery
Resized the browser window to a narrow width and the orders table overflowed the viewport with no horizontal scroll. The filter bar controls got squished into illegibility and the navbar links overlapped.

### Problem
On narrow screens, tables overflow with no scroll, filter bar controls get squished, navbar breaks poorly, and `white-space: nowrap` on cells prevents text wrapping.

### Approach
Add a `@media (max-width: 600px)` breakpoint and targeted CSS changes.

### Fix
In [frontend/src/index.css](frontend/src/index.css):
- `.table-wrapper`: added `overflow-x: auto` for horizontal scroll on narrow screens.
- `td`: on mobile, `white-space: normal` so text wraps within cells.
- `.navbar`: on mobile, stacks vertically with `flex-direction: column`.
- `.filter-bar`: on mobile, stacks controls vertically with full-width inputs.

### Files modified
- `frontend/src/index.css`

---

## 44) Comprehensive responsive overhaul

### Discovery
After the initial mobile CSS fixes (entry 31), tested on a 375px-wide viewport and found that the page header button overflowed, action buttons were squeezed, modal buttons broke on very small screens, and the "Clear filters" button was not full-width on mobile.

### Problem
The initial mobile breakpoint changes (entry 31) were insufficient. Multiple elements still had misalignment on narrow screens: page header button could overflow, action cells squeezed, modal buttons overflowed on very small screens (`< 400px`), pagination text broke poorly, the filter bar's "Clear filters" button wasn't full-width, and the container padding was wasteful on mobile.

### Approach
Review every layout element and add responsive rules where needed. Use two breakpoints: `600px` for most mobile adjustments, `400px` for the modal action buttons.

### Fix
In [frontend/src/index.css](frontend/src/index.css), added the following responsive rules:
- `.container`: at `<= 600px`, reduce side padding from 24px to 12px.
- `.page-header`: at `<= 600px`, `flex-wrap: wrap` so the heading and button don't overflow.
- `.filter-bar`: at `<= 600px`, `.btn` elements also become `width: 100%` (catches "Clear filters").
- `.actions-cell`: at `<= 600px`, `flex-wrap: wrap` with reduced `gap: 8px`.
- `.pagination`: always `flex-wrap: wrap` so the "Page X of Y" text wraps cleanly.
- `.modal`: at `<= 600px`, reduce padding from 24px to 16px for more content space.
- `.modal-actions`: at `<= 400px`, `flex-direction: column-reverse` with full-width buttons (primary action at bottom, easier to tap on small screens).
- `.filter-dates`: new wrapper to keep From/To date inputs side by side on mobile.

### Files modified
- `frontend/src/index.css`

---

## 45) Correct form labels and native input constraints

### Discovery
Clicked the "Email" text label in the ClientForm and the input did not receive focus, the label was a `<span>` instead of a `<label>` element. Also noticed that typing `1.5` in the quantity field of the OrderForm was accepted client-side but rejected by the backend's integer constraint.

### Problem
Two issues:
1. The Email field in ClientForm was wrapped in a `<span>` instead of `<label>`, so clicking "Email" text did not focus the input.
2. The Quantity input in OrderForm had no `step="1"` attribute, so users could type decimal values that the backend rejects for integer-only quantities.

### Approach
Replace the Email span with a proper `<label>`. Add `step="1"` to the quantity input.

### Fix
In [ClientForm.jsx](frontend/src/components/ClientForm.jsx), the Email field was already fixed in a previous rewrite (now uses `<label>` wrapping).

In [OrderForm.jsx](frontend/src/components/OrderForm.jsx), added `step="1"` to the quantity `<input>`.

### Files modified
- `frontend/src/components/OrderForm.jsx`

---

## 46) No `:focus-visible` styles

### Discovery
Tabbed through the page using keyboard and saw no visual indicator of which element was focused. Keyboard-only users would have no way to navigate efficiently.

### Problem
Keyboard-only users could not see which element has focus. No `:focus-visible` outlines anywhere.

### Fix
Added a global `:focus-visible` rule for buttons, inputs, selects, textareas, and links which uses a 2px primary-color outline with offset.

### Files modified
- `frontend/src/index.css`

---

## 47) Table row hover effect invisible

### Discovery
Hovered over a table row and barely noticed any visual change. The `#f9fafb` color was nearly identical to the page background, making the hover highlight effectively invisible.

### Problem
`tbody tr:hover` used `#f9fafb` which is barely distinguishable from the white background. The hover highlight was effectively invisible.

### Fix
Changed to `#eef2ff`, a light indigo tint that's clearly noticeable.

### Files modified
- `frontend/src/index.css`

---

## 48) Missing hover states on buttons

### Discovery
Inspected button styles and noticed `.btn-secondary`, `.btn-danger`, and `.btn-link` had no `:hover` rules. Users got no visual feedback when hovering these buttons, inconsistent with `.btn-primary` which had a hover state.

### Problem
`.btn-secondary`, `.btn-danger`, and `.btn-link` had no `:hover` styles. Users got no visual feedback when hovering these buttons.

### Fix
Added hover states:
- `.btn-secondary:hover` → darker gray (`#d1d5db`)
- `.btn-danger:hover` → darker red (`#b91c1c`)
- `.btn-link:hover` → underline

### Files modified
- `frontend/src/index.css`

---

## Group 9 — Frontend: Accessibility

## 49) Make dialogs accessible

### Discovery
Opened a modal dialog and tried pressing Escape to close it and nothing happened. Clicking the overlay background also did nothing. Additionally, tabbing into the dialog did not move focus to the first input, and the page behind the modal continued to scroll.

### Problem
Three accessibility gaps in modal dialogs:
1. **No keyboard dismissal** — pressing Escape does not close any dialog.
2. **No overlay click dismissal** — clicking the background behind the dialog does not close it (except for ConfirmDialog after C2).
3. **Body scrolls behind modal** — when a dialog is open, the page behind it can still be scrolled.
4. **No screen reader cues** — dialogs lack `role="dialog"`, `aria-modal`, and `aria-label`.
5. **No initial focus** — when a dialog opens, focus is not moved into it.

### Approach
For all three dialogs (ClientForm, OrderForm, ConfirmDialog), add the same set of accessibility improvements: `role="dialog"` + `aria-modal="true"` + `aria-label`, Escape key handler, overlay click handler, body scroll lock via `useEffect`, and focus the first focusable element on mount.

### Fix
[ConfirmDialog.jsx](frontend/src/components/ConfirmDialog.jsx), [ClientForm.jsx](frontend/src/components/ClientForm.jsx), and [OrderForm.jsx](frontend/src/components/OrderForm.jsx) all updated with:

```jsx
useEffect(() => {
  document.body.style.overflow = 'hidden'
  firstInputRef.current?.focus()
  return () => { document.body.style.overflow = '' }
}, [])

function handleKeyDown(e) {
  if (e.key === 'Escape' && !saving) onCancel()
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget && !saving) onCancel()
}
```

The dialog container has `role="dialog"`, `aria-modal="true"`, and `aria-label={title}`.

### Files modified
- `frontend/src/components/ConfirmDialog.jsx`
- `frontend/src/components/ClientForm.jsx`
- `frontend/src/components/OrderForm.jsx`

---

## Group 10 — Frontend: Stale state / race conditions

## 50) Prevent stale filter/search responses

### Discovery
On the Clients page, typed a search query quickly and noticed that the results flickered and a slower earlier response arrived after a faster later one and overwrote the correct results with outdated data.

### Problem
When a user changed search or filters quickly, multiple API requests could be in flight simultaneously. Because network responses arrive out of order, an older (slower) response could overwrite newer (correct) data. The user would see results that didn't match their current filter/search input.

### Approach
Track a monotonically increasing request counter. Increment it before each request, and discard the response if the counter has changed (meaning a newer request was already sent).

### Fix
In [frontend/src/pages/ClientsPage.jsx](frontend/src/pages/ClientsPage.jsx) and [frontend/src/pages/OrdersPage.jsx](frontend/src/pages/OrdersPage.jsx), added a `useRef(0)` counter. Each `loadClients`/`loadOrders` call captures the current counter value, and the response handlers check it before applying state updates:

```javascript
const id = ++requestId.current
// ... await fetch ...
if (id !== requestId.current) return
// apply data
```

The guard is repeated for the success path, the error path, and the finally block to prevent stale loading indicators.

### Files modified
- `frontend/src/pages/ClientsPage.jsx`
- `frontend/src/pages/OrdersPage.jsx`
