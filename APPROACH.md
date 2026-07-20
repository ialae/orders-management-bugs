# Approach

How I found and fixed the bugs. Full per-bug write-up is in [`BUGFIXES.md`](BUGFIXES.md).

## Methodology — reproduce first, then fix (red → green)

I worked test-first: for each suspected bug I **reproduced the broken behavior
before touching the code**, then fixed the root cause, then re-ran the same check
to confirm it turned green. Verification ran against the live stack with `curl`
against the API and manual exercise of the UI — e.g.

```
# RED  — bug is live
curl 'localhost:8000/api/clients?search=%25'   # → 18 rows (wildcard matches all)
# GREEN — after the fix
curl 'localhost:8000/api/clients?search=%25'   # → 0 rows (matched literally)
```

Every fix is backed by a before/after check; the table at the bottom of
`BUGFIXES.md` records them. (A committed `pytest` suite is the natural next step —
called out there as the one remaining gap.)

## Skills used to find the bugs

| Skill | What it caught |
|---|---|
| `code-review` (high effort, multi-angle) | The initial sweep — logic, pagination, filter, and calculation bugs across the diff |
| `security-review` (OWASP, confidence-gated) | Confirmed the SQLi / XSS / CORS / debug fixes; **demoted** the wildcard issue from security to correctness |
| `frontend-security` | Grep sweeps for XSS sinks, secrets, unsafe DOM — confirmed clean post-fix |
| `code-review-and-quality` (five-axis) | Found the three fixes that stopped one step short of their own claim |

The second pass mattered: it downgraded one finding I'd overstated and surfaced
two I'd missed, which became the `LIKE`-wildcard, email-case, and whitespace fixes.

## Fixed bugs (all 26)

Numbered as in [`BUGFIXES.md`](BUGFIXES.md), which has the root-cause detail for each.

| # | Area | Bug |
|---|---|---|
| 1 | Config | Backend could start before Postgres was ready (`depends_on` ignored the healthcheck) |
| 2 | Config | Frontend API-URL env var name mismatch — never reached the app |
| 3 | Backend | `status` filter accepted but silently ignored |
| 4 | Backend | Date-range filters inverted |
| 5 | Backend | Orders pagination skipped the entire first page |
| 6 | Backend | Clients pagination ignored `page_size` (hardcoded `limit(10)`) |
| 7 | Backend | Search required the term in name **and** email |
| 8 | Backend | `GET /api/clients/{id}` returned nothing instead of 404 |
| 9 | Backend | Orders could be created against non-existent clients |
| 10 | Backend | Order total was addition, not multiplication |
| 11 | Backend | Duplicate emails possible despite a 409 handler (now case-insensitive) |
| 12 | Backend | Client updates silently dropped phone and address |
| 13 | Backend | No bounds on pagination parameters |
| 14 | Backend | No validation on order quantity and price (and whitespace-only names) |
| 15 | Security | SQL injection in client search (raw f-string → parameterized) |
| 16 | Security | Stored XSS via `dangerouslySetInnerHTML` |
| 17 | Security | `debug=True` + hardcoded secret |
| 18 | Security | `CORS *` with credentials enabled |
| 19 | Frontend | "Clear filters" only cleared half the filters |
| 20 | Frontend | No confirmation on client delete (cascades to their orders) |
| 21 | Frontend | Last page of results was unreachable (`floor` → `ceil`) |
| 22 | Frontend | Client form could be double-submitted |
| 23 | Frontend | Delete failures vanished silently |
| 24 | Frontend | Search fired a request per keystroke |
| 25 | Frontend | Client form sent server-owned fields back to the API |
| 26 | Frontend | Email field wasn't associated with its label |
