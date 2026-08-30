# PeopleDesk — Internal Employee Management System

🔗 **Live App:** https://peopledesk-employee-management.vercel.app
🔗 **Backend API:** https://peopledesk-employee-management-2.onrender.com

## 1. Project Description

PeopleDesk lets an organization manage:

- **Employee records** — profile, designation, department, reporting manager, joining date, employment status
- **Attendance** — self-service check-in / check-out and history, plus a live "today" view for managers/admins
- **Leave requests** — employees submit requests; their manager (or an admin) approves or rejects them
- **Dashboards** — role-scoped stats (headcount, today's attendance, pending approvals)

Selected option: **Option D — Internal Employee Management System**, because it
maps directly onto the Employee Helpdesk system already built during my Aeologic
internship, letting me focus assignment time on the specific new workflows
(attendance, leave approval, manager-scoped visibility) rather than re-learning
a stack from scratch.

## 2. Features

| Area | Admin | Manager | Employee |
|---|---|---|---|
| View all employees | ✅ | Own reports only | ❌ (own profile via `/me`) |
| Create / edit / deactivate employees | ✅ | ❌ | ❌ |
| Manage departments | ✅ | View only | View only |
| Check in / check out | — | — | ✅ |
| View today's attendance | ✅ (all) | ✅ (own team) | own record only |
| View attendance history | any employee | own team | self |
| Submit leave request | — | — | ✅ |
| Approve / reject leave | ✅ (any) | ✅ (own team only) | ❌ |
| Dashboard | org-wide stats | team stats | personal stats |

## 3. Technology Stack

**Backend:** Node.js, Express, `node:sqlite` (Node's **built-in** SQLite
module — file-based, zero external DB server, and critically, zero native
compilation step), bcryptjs (password hashing), jsonwebtoken (auth).

**Frontend:** Vanilla HTML/CSS/JavaScript SPA (no build step required — open
and run). Talks to the backend purely over the documented REST API.

**Why this stack:** the assignment allows any comfortable stack. SQLite gives
real relational persistence, foreign keys, and constraints identical in spirit
to PostgreSQL/MySQL, but needs no server process. Using Node's *built-in*
`node:sqlite` (rather than a native-addon package like `better-sqlite3`)
means `npm install` never has to compile C++ against V8 — which avoids a
whole class of "works on my machine" failures across different OSes, Node
versions, and compiler toolchains during evaluation. The same schema (see
`docs/DATABASE.md`) maps directly onto PostgreSQL if the project grows past
MVP. A plain JS frontend avoids build tooling entirely while still
demonstrating clean state management, role-based UI, and API integration.

Key dependencies:
- `express` — HTTP server / routing
- `node:sqlite` — synchronous embedded SQL database, built into Node.js
  (requires Node **22.5+**; stable without a flag on modern Node versions)
- `bcryptjs` — password hashing (10 salt rounds)
- `jsonwebtoken` — stateless auth tokens
- `cors` — cross-origin requests from the static frontend
- `supertest` (dev) — HTTP assertions in automated tests

## 4. Architecture

```
┌─────────────────┐        HTTPS/JSON         ┌──────────────────────┐        SQL         ┌──────────────────┐
│   Frontend SPA   │  ────────────────────▶   │   Express REST API    │  ─────────────▶   │  SQLite database   │
│ (HTML/CSS/JS)     │  ◀────────────────────   │  (Node.js, JWT auth)   │  ◀─────────────   │ (employee_mgmt.db) │
└─────────────────┘                           └──────────────────────┘                    └──────────────────┘
     localStorage                              routes → middleware →                         WAL mode,
     stores JWT                                 controllers → db layer                        foreign keys ON
```

See `docs/ARCHITECTURE.md` for the full diagram and request-lifecycle notes.

## 5. Database Design

Entities: `users` → `employees` → `departments`, `attendance`, `leave_requests`.
Full ER diagram, relationships, and design decisions (e.g. why auth identity
and HR profile are separate tables) are in `docs/DATABASE.md`.

## 6. API Documentation

All endpoints, required roles, request/response shapes, and error cases are in
`docs/API.md`.

## 7. Local Setup

### Prerequisites
- **Node.js 22.5 or newer** and npm (required for the built-in `node:sqlite`
  module — check with `node --version`)
- A modern browser
- No external database server needed (SQLite file is created automatically)
- No native build tools (Python/Visual Studio Build Tools/etc.) needed — this
  project intentionally avoids native npm addons

### Backend

```bash
cd backend
npm install
cp .env.example .env       # defaults work out of the box for local dev
npm run seed                # creates data/employee_mgmt.db with sample data
npm start                   # runs on http://localhost:4000
```

### Frontend

The frontend is static — no build step. From the `frontend/` folder, serve it
with any static file server, for example:

```bash
cd frontend
python3 -m http.server 5500
# open http://localhost:5500 in a browser
```

(You can also just open `frontend/index.html` directly in a browser, but
serving it avoids any local-file CORS quirks in some browsers.)

By default the frontend calls the API at `http://localhost:4000/api`. To point
it elsewhere, set `window.PEOPLEDESK_API_BASE` before `js/api.js` loads (e.g.
add a small `<script>` in `index.html`).

### Environment Variables (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | API server port | `4000` |
| `JWT_SECRET` | Secret used to sign auth tokens — **change in production** | dev placeholder |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` |
| `DB_PATH` | Path to the SQLite file | `./data/employee_mgmt.db` |

## 8. Sample Test-User Credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Admin | admin@cruvels.test | Admin@123 |
| Manager | manager@cruvels.test | Manager@123 |
| Employee | harshita@cruvels.test | Employee@123 |
| Employee | jyoti@cruvels.test | Employee@123 |
| Employee (no manager, for edge-case testing) | aman@cruvels.test | Employee@123 |

## 9. How to Run Tests

```bash
cd backend
npm test
```

This runs 12 automated tests (Node's built-in test runner + supertest)
against an isolated SQLite test database (`data/test.db`, auto-created and
reset on each run — never touches your dev/demo data). Covers:

- Successful login and JWT issuance
- Login failure with wrong password / unknown email (generic error, no
  account-existence leak)
- Unauthenticated request rejected (401)
- Role-based access enforced **server-side** — an employee calling an
  admin/manager-only endpoint gets 403 even with a valid token
- Manager sees only their own direct reports, not the whole company
- Invalid leave date range rejected (400)
- Full leave workflow: employee submits → manager approves
- A manager **cannot** approve/reject another manager's team's leave request
  (403) — cross-team authorization boundary
- 404 for a non-existent employee id
- Full attendance workflow: check-in → duplicate check-in rejected (409) →
  check-out

## 10. Known Limitations

- Leave requests do not currently deduct from a leave balance (no
  balance/accrual tracking) — see Future Improvements.
- No password-reset flow; an admin must create/re-provision accounts.
- Attendance is check-in/check-out based, not integrated with any biometric
  or geolocation device.
- No file/document upload for employee records.
- No pagination yet on the employee/leave list endpoints — acceptable at MVP
  scale, would need addressing before large datasets.

## 11. Future Improvements

- Leave balance & accrual per leave type, enforced at request time
- Audit log of who changed what (especially employee edits, leave decisions)
- CSV export of attendance/leave for payroll
- Holiday calendar integration
- Email/notification on leave approval/rejection
- Pagination and search/filter on the employees and leave tables
- Migrate from SQLite to PostgreSQL for multi-instance/production deployment
  (schema is already written in a portable style — see `docs/DATABASE.md`)

## 12. Repository Structure

```
employee-mgmt-system/
├── backend/
│   ├── src/
│   │   ├── db/            # schema (init.js) + seed data (seed.js)
│   │   ├── middleware/     # JWT auth + role-based authorization
│   │   ├── routes/         # auth, employees, departments, attendance, leave, dashboard
│   │   └── server.js
│   ├── tests/
│   │   └── api.test.js     # 12 automated tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js          # API client
│       ├── ui.js           # shared UI helpers (toasts, modals, badges)
│       ├── app.js           # router + auth/session handling
│       └── views/           # dashboard, employees, attendance, leave, departments
└── docs/
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    └── API.md
```
