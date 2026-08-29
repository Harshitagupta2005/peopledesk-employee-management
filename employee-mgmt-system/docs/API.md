# API Documentation

Base URL: `http://localhost:4000/api`

All endpoints except `/auth/login` and `/health` require:
`Authorization: Bearer <jwt>`

Roles: `admin`, `manager`, `employee`. Authorization is enforced **server-side**
in every route (see `backend/src/middleware/auth.js`) — the frontend hiding a
button is not the security boundary.

Standard error shape: `{ "error": "human readable message" }`

---

## Auth

### `POST /auth/login`
Public. Authenticates a user and returns a JWT.

**Request body**
```json
{ "email": "admin@cruvels.test", "password": "Admin@123" }
```

**Response `200`**
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "email": "admin@cruvels.test", "role": "admin", "employeeId": 1 }
}
```

**Errors**
- `400` — missing email/password
- `401` — invalid credentials (same generic message whether the email exists
  or the password is wrong, to avoid leaking which emails are registered)

---

## Employees

### `GET /employees`
Role: `admin` (all employees) or `manager` (only their direct reports).
`employee` role → `403` (use `/employees/me` instead).

**Response `200`** — array of:
```json
{
  "id": 3, "full_name": "Harshita Gupta", "designation": "Software Engineer",
  "department_id": 1, "department_name": "Engineering",
  "manager_id": 2, "manager_name": "Rahul Verma",
  "joining_date": "2024-07-01", "employment_status": "active",
  "email": "harshita@cruvels.test", "role": "employee", "is_active": 1
}
```

### `GET /employees/me`
Role: any authenticated user. Returns the caller's own employee profile.
`404` if the account has no linked employee profile (e.g. a bare admin login).

### `GET /employees/:id`
Role: `admin` (any), `manager` (only if `:id` is a direct report), `employee`
(only if `:id` is themself). Otherwise `403`. `404` if not found.

### `POST /employees`
Role: `admin` only. Creates a linked `users` row + `employees` row in a single
transaction.

**Request body**
```json
{
  "email": "new.hire@cruvels.test", "password": "TempPass123",
  "full_name": "New Hire", "role": "employee",
  "designation": "QA Engineer", "department_id": 1,
  "manager_id": 2, "joining_date": "2026-09-01"
}
```

**Response `201`** — the created employee (same shape as `GET /employees`).

**Errors**
- `400` — missing required field, invalid role, password < 8 chars
- `409` — email already registered

### `PUT /employees/:id`
Role: `admin` only. Partial update — omitted fields are left unchanged.

**Request body** (all optional): `full_name, designation, department_id, manager_id, joining_date, employment_status`

**Errors**
- `400` — `manager_id` equal to the employee's own id (can't manage yourself)
- `400` — invalid `employment_status`
- `404` — employee not found

### `DELETE /employees/:id`
Role: `admin` only. **Soft delete** — sets `employment_status = 'inactive'`
and disables the linked login (`users.is_active = 0`). History is preserved.

**Response `200`**: `{ "message": "Employee deactivated successfully" }`

---

## Departments

### `GET /departments`
Role: any authenticated user.

### `POST /departments`
Role: `admin` only.

**Request body**: `{ "name": "Engineering", "description": "..." }`

**Errors**: `400` missing name · `409` duplicate name

---

## Attendance

### `POST /attendance/checkin`
Role: any authenticated employee-linked account. Marks the caller present for
today.

**Errors**: `409` — already checked in today.

### `POST /attendance/checkout`
Role: same as above. Requires an existing check-in for today.

**Errors**: `400` — no check-in yet today · `409` — already checked out.

### `GET /attendance/employee/:id`
Role: `admin` (any), `manager` (own reports), `employee` (self only). Returns
last 90 attendance records, most recent first.

### `GET /attendance/today`
Role: `admin` (whole company) or `manager` (own team only). Today's records
with employee names attached.

---

## Leave Requests

### `POST /leave`
Role: any authenticated employee-linked account. Submits a request for
themselves, status starts as `pending`.

**Request body**
```json
{ "leave_type": "sick", "start_date": "2026-09-02", "end_date": "2026-09-03", "reason": "Fever" }
```
`leave_type` ∈ `sick | casual | earned | unpaid`

**Errors**: `400` — missing fields, invalid `leave_type`, or `start_date` after `end_date`.

### `GET /leave`
Role-scoped: `admin` → all requests · `manager` → own team's requests ·
`employee` → own requests only.

### `PUT /leave/:id/approve`
Role: `admin` (any pending request) or `manager` (only if the requester
reports to them).

**Errors**
- `404` — not found
- `409` — request is not `pending` (already reviewed)
- `403` — a manager attempting to review a request from outside their team

### `PUT /leave/:id/reject`
Same rules and errors as `approve`, sets `status = 'rejected'`.

---

## Dashboard

### `GET /dashboard`
Role-scoped response shape:

**Admin** (`scope: "admin"`):
```json
{ "scope": "admin", "employeeCount": 5, "departmentBreakdown": [{ "name": "Engineering", "count": 3 }], "todaysAttendance": 2, "pendingLeave": 2 }
```

**Manager** (`scope: "manager"`):
```json
{ "scope": "manager", "teamCount": 2, "todaysAttendance": 2, "pendingLeave": 1 }
```

**Employee** (`scope: "employee"`):
```json
{ "scope": "employee", "myAttendanceThisMonth": 12, "myPendingLeave": 1, "checkedInToday": true, "checkedOutToday": false }
```

---

## Misc

### `GET /health`
Public. `{ "status": "ok", "time": "<ISO timestamp>" }` — useful for
confirming the backend is reachable before debugging further.

## Notes on error handling & status codes used throughout

| Code | Meaning here |
|---|---|
| 400 | Validation failure (missing/malformed input, invalid enum value, bad date range) |
| 401 | Missing/invalid/expired token, or wrong credentials on login |
| 403 | Authenticated, but role/ownership doesn't permit this action |
| 404 | Resource does not exist |
| 409 | Conflict with current state (duplicate email/department, already checked in, already reviewed) |
| 500 | Unexpected server error (caught by the central error handler in `server.js`) |

No endpoint returns `password_hash` or any other sensitive field — all
`SELECT`s explicitly list columns rather than `SELECT *` on `users`.
