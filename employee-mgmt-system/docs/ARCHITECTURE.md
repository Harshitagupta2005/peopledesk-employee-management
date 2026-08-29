# Architecture

## Overview

```
                         ┌───────────────────────────────────────────┐
                         │              Browser (client)               │
                         │                                             │
                         │   ┌───────────────────────────────────┐    │
                         │   │      Frontend SPA (static JS)       │    │
                         │   │  index.html + css/ + js/            │    │
                         │   │  - app.js       (router, auth state)│    │
                         │   │  - api.js       (fetch wrapper)     │    │
                         │   │  - views/*.js   (per-page render)   │    │
                         │   │  JWT stored in localStorage         │    │
                         │   └───────────────────────────────────┘    │
                         └────────────────────┬────────────────────────┘
                                               │  HTTPS/JSON
                                               │  Authorization: Bearer <jwt>
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │           Express REST API (Node.js)        │
                         │                                             │
                         │  server.js                                  │
                         │   └─ middleware: cors, json body parser      │
                         │   └─ routes/                                 │
                         │       ├─ auth.js         POST /login          │
                         │       ├─ employees.js    CRUD + /me            │
                         │       ├─ departments.js                        │
                         │       ├─ attendance.js   checkin/checkout       │
                         │       ├─ leave.js        request/approve/reject │
                         │       └─ dashboard.js    role-scoped stats       │
                         │   └─ middleware/auth.js                          │
                         │       ├─ requireAuth   (verifies JWT)             │
                         │       └─ requireRole   (RBAC gate)                │
                         └────────────────────┬────────────────────────┘
                                               │  SQL (prepared statements,
                                               │  parameterized — no string
                                               │  concatenation)
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │      SQLite database (node:sqlite, built-in)   │
                         │      data/employee_mgmt.db                    │
                         │      WAL journal mode, foreign_keys = ON       │
                         │      users → employees → departments,          │
                         │              attendance, leave_requests         │
                         └───────────────────────────────────────────┘
```

No cache, queue, or object storage layer is used — the MVP's read/write
volume and lack of file uploads don't justify the added operational
complexity. If attendance check-ins needed to scale to thousands of
concurrent requests, a write-behind queue in front of the attendance table
would be the first addition.

## Request lifecycle (example: manager approves a leave request)

1. Frontend sends `PUT /api/leave/12/approve` with `Authorization: Bearer <jwt>`.
2. `requireAuth` middleware verifies the JWT signature and expiry, and attaches
   `{ id, role, employeeId }` to `req.user`.
3. `requireRole('admin', 'manager')` middleware rejects the request with 403
   if the caller's role isn't admin or manager — enforced **before** any
   database access, so an employee token can never reach the business logic.
4. The route handler loads the leave request, confirms it's still `pending`,
   and — if the caller is a manager (not admin) — checks that the request's
   employee actually reports to that manager. This is the authorization
   boundary that stops a manager from approving another team's leave.
5. On success, the row is updated with `status='approved'`, `reviewed_by`,
   and `reviewed_at`, and the updated record is returned as JSON.
6. The frontend re-renders the leave table and shows a success toast.

## Why JWT (stateless) rather than server-side sessions

The MVP has no need for server-side session revocation lists or shared
session storage across instances, and a stateless JWT keeps the backend
simple to run locally and to horizontally scale later without a session
store. The trade-off — tokens can't be instantly revoked before expiry — is
acceptable for an internal MVP with an 8-hour token lifetime; a production
version would add a short-lived access token + refresh token pair.

## Why the frontend is a plain JS SPA, not a framework

Given the "MVP, not a full ERP" guidance and that the same functional/RBAC
depth needed to be demonstrated as a framework app, a dependency-free SPA
keeps evaluator setup to "open two folders, run two commands" with zero
build step, while still exercising client-side routing, shared component
patterns (modals, toasts, tables), and clean separation between the API
client (`api.js`) and view logic (`views/*.js`).
