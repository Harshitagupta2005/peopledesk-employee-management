const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const EMPLOYEE_SELECT = `
  SELECT e.id, e.full_name, e.designation, e.department_id, d.name AS department_name,
         e.manager_id, m.full_name AS manager_name, e.joining_date, e.employment_status,
         u.email, u.role, u.is_active
  FROM employees e
  JOIN users u ON u.id = e.user_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.manager_id
`;

// GET /api/employees - admin: all, manager: own team, employee: forbidden (use /me)
router.get("/", requireAuth, (req, res) => {
  const { role, employeeId } = req.user;

  if (role === "admin") {
    const rows = db.prepare(`${EMPLOYEE_SELECT} ORDER BY e.full_name`).all();
    return res.json(rows);
  }

  if (role === "manager") {
    const rows = db
      .prepare(`${EMPLOYEE_SELECT} WHERE e.manager_id = ? ORDER BY e.full_name`)
      .all(employeeId);
    return res.json(rows);
  }

  return res.status(403).json({ error: "Forbidden: employees may only view their own profile via /api/employees/me" });
});

// GET /api/employees/me - any authenticated user views their own profile
router.get("/me", requireAuth, (req, res) => {
  if (!req.user.employeeId) {
    return res.status(404).json({ error: "No employee profile linked to this account" });
  }
  const row = db.prepare(`${EMPLOYEE_SELECT} WHERE e.id = ?`).get(req.user.employeeId);
  if (!row) return res.status(404).json({ error: "Employee not found" });
  res.json(row);
});

// GET /api/employees/:id - admin: any, manager: own reports, employee: self only
router.get("/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`${EMPLOYEE_SELECT} WHERE e.id = ?`).get(id);
  if (!row) return res.status(404).json({ error: "Employee not found" });

  const { role, employeeId } = req.user;
  const isSelf = employeeId === id;
  const isManagerOfEmployee = role === "manager" && row.manager_id === employeeId;

  if (role !== "admin" && !isSelf && !isManagerOfEmployee) {
    return res.status(403).json({ error: "Forbidden: you cannot view this employee's record" });
  }

  res.json(row);
});

// POST /api/employees - admin only. Creates a linked user account + employee profile.
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const {
    email, password, full_name, designation, department_id,
    manager_id, joining_date, role,
  } = req.body || {};

  if (!email || !password || !full_name || !joining_date) {
    return res.status(400).json({ error: "email, password, full_name and joining_date are required" });
  }
  if (!["admin", "manager", "employee"].includes(role)) {
    return res.status(400).json({ error: "role must be one of admin, manager, employee" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const createTxn = () => {
    const passwordHash = bcrypt.hashSync(password, 10);
    const userResult = db
      .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)")
      .run(email.toLowerCase().trim(), passwordHash, role);

    const empResult = db
      .prepare(`
        INSERT INTO employees (user_id, full_name, designation, department_id, manager_id, joining_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(userResult.lastInsertRowid, full_name, designation || null, department_id || null, manager_id || null, joining_date);

    return empResult.lastInsertRowid;
  };

  try {
    const newId = db.runInTransaction(createTxn);
    const row = db.prepare(`${EMPLOYEE_SELECT} WHERE e.id = ?`).get(newId);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create employee: " + err.message });
  }
});

// PUT /api/employees/:id - admin only
router.put("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  const { full_name, designation, department_id, manager_id, joining_date, employment_status } = req.body || {};

  if (manager_id && Number(manager_id) === id) {
    return res.status(400).json({ error: "An employee cannot be their own manager" });
  }
  if (employment_status && !["active", "inactive"].includes(employment_status)) {
    return res.status(400).json({ error: "employment_status must be active or inactive" });
  }

  db.prepare(`
    UPDATE employees
    SET full_name = COALESCE(?, full_name),
        designation = COALESCE(?, designation),
        department_id = COALESCE(?, department_id),
        manager_id = ?,
        joining_date = COALESCE(?, joining_date),
        employment_status = COALESCE(?, employment_status)
    WHERE id = ?
  `).run(
    full_name || null, designation || null, department_id || null,
    manager_id !== undefined ? manager_id : existing.manager_id,
    joining_date || null, employment_status || null, id
  );

  const row = db.prepare(`${EMPLOYEE_SELECT} WHERE e.id = ?`).get(id);
  res.json(row);
});

// DELETE /api/employees/:id - admin only. Soft delete (deactivate), not a hard delete.
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Employee not found" });

  db.prepare("UPDATE employees SET employment_status = 'inactive' WHERE id = ?").run(id);
  db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(existing.user_id);

  res.json({ message: "Employee deactivated successfully" });
});

module.exports = router;
