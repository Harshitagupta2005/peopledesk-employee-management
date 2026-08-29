# Database Design

Engine: SQLite via Node's built-in `node:sqlite` module (no native compilation
required), WAL journal mode, `PRAGMA foreign_keys = ON`.
Schema source of truth: `backend/src/db/init.js`.

The schema uses only portable SQL (types, constraints, foreign keys) so it
maps directly to PostgreSQL/MySQL with minimal changes if the project needs
to scale past MVP (see README §11).

## ER Diagram

```
┌───────────────────┐        ┌──────────────────────┐
│      users          │        │     departments        │
├───────────────────┤        ├──────────────────────┤
│ id            PK    │        │ id               PK     │
│ email         UNIQUE │        │ name             UNIQUE  │
│ password_hash        │        │ description              │
│ role   (admin/mgr/    │        │ created_at                │
│         employee)      │        └───────────┬──────────────┘
│ is_active               │                    │
│ created_at                │                    │ 1
└───────────┬───────────────┘                    │
            │ 1                                   │
            │                                      │ *
            │ 1                          ┌─────────▼──────────┐
┌───────────▼───────────┐        │      employees        │
│      employees          │◀───────┤────────────────────────┤
├────────────────────────┤ *      │ id                PK     │
│ id                PK      │        │ user_id      FK → users  │  (1:1 with users)
│ user_id      FK → users   │        │ full_name                  │
│ full_name                    │        │ designation                 │
│ designation                   │        │ department_id FK → departments│
│ department_id  FK → departments│        │ manager_id    FK → employees  │ (self-referencing)
│ manager_id    FK → employees   │◀───────┤ joining_date                    │
│   (self-reference: an           │  *     │ employment_status (active/    │
│    employee's manager is         │        │   inactive)                    │
│    itself an employee row)        │        │ created_at                       │
│ joining_date                        │        └──────────┬───────────────────────┘
│ employment_status                    │                   │ 1
│ created_at                              │                   │
└──────────────┬──────────┬────────────┘                   │
               │ 1        │ 1                                │
               │          │                                    │
               │ *        │ *                                  │
┌──────────────▼──┐   ┌───▼──────────────────┐                │
│   attendance       │   │   leave_requests        │                │
├──────────────────┤   ├────────────────────────┤                │
│ id           PK     │   │ id                 PK     │                │
│ employee_id FK      │   │ employee_id       FK       │                │
│ date                  │   │ leave_type (sick/casual/    │                │
│ check_in                │   │   earned/unpaid)              │                │
│ check_out                │   │ start_date / end_date          │                │
│ status (present/          │   │ reason                            │                │
│   absent/half_day/          │   │ status (pending/approved/          │                │
│   on_leave)                   │   │   rejected)                           │                │
│ UNIQUE(employee_id, date)       │   │ reviewed_by  FK → employees ───────────────────┘
│ created_at                        │   │ reviewed_at
└──────────────────────────────────┘   │ created_at
                                        └────────────────────────┘
```

## Entities & relationships

- **users** — authentication identity only (email, hashed password, role,
  active flag). Kept separate from `employees` on purpose (see Design
  Decisions below).
- **departments** — simple lookup table; an employee optionally belongs to one.
- **employees** — the HR profile. 1:1 with `users` (`user_id UNIQUE`). Has a
  **self-referencing** `manager_id` — a manager is just another employee row,
  which is what lets "who reports to whom" be modeled with a single table
  instead of a separate hierarchy table.
- **attendance** — one row per employee per date (`UNIQUE(employee_id, date)`
  prevents double check-in rows), tracks check-in/check-out timestamps.
- **leave_requests** — a date range + type + status, with `reviewed_by`
  pointing at the employee (manager/admin) who approved/rejected it.

## Important design decisions

1. **`users` and `employees` are separate tables.** Authentication concerns
   (credentials, role, account active/inactive) are distinct from HR profile
   data (designation, department, manager, joining date). This keeps the
   password hash and login logic isolated from HR data, and makes it trivial
   to deactivate a login (`users.is_active`) independently of an HR record
   status, or vice versa.
2. **Self-referencing `manager_id` on `employees`** avoids a separate
   `org_chart` table and lets a single `WHERE manager_id = ?` query answer
   "who's on my team" — the core query behind manager-scoped visibility.
3. **Soft delete, not hard delete, for employees.** `DELETE /api/employees/:id`
   sets `employment_status = 'inactive'` and `users.is_active = 0` rather than
   removing rows. This preserves attendance/leave history for audit purposes
   and avoids foreign-key cascade surprises.
4. **`ON DELETE CASCADE` on attendance/leave → employees, `ON DELETE SET NULL`
   on department_id/manager_id** — if a department is ever hard-deleted, its
   employees aren't orphaned into an invalid state; they just lose the
   department label. If an employee row itself is hard-deleted (rare, admin
   tooling only), their attendance/leave history is cleaned up with them.
5. **CHECK constraints on enum-like columns** (`role`, `employment_status`,
   `attendance.status`, `leave_type`, `leave_requests.status`) push basic data
   integrity into the database layer, not just app-level validation.

## Indexes

- `idx_employees_department`, `idx_employees_manager` — support the two most
  common employee list filters (by department, by manager/team).
- `idx_attendance_employee_date` — supports both the per-employee history
  query and the `UNIQUE(employee_id, date)` constraint's lookup path.
- `idx_leave_employee`, `idx_leave_status` — support "my requests" and
  "pending requests to review" queries respectively.

## Seed data

`backend/src/db/seed.js` creates 3 departments, 1 admin, 1 manager, 3
employees (two reporting to the manager, one with no manager assigned to
exercise that edge case), a few days of attendance history, and 3 leave
requests in different states (pending/approved). Run with `npm run seed`.
