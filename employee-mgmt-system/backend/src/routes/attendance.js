const express = require("express");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function canViewEmployee(req, employeeId) {
  const { role, employeeId: myId } = req.user;
  if (role === "admin") return true;
  if (myId === employeeId) return true;
  if (role === "manager") {
    const emp = db.prepare("SELECT manager_id FROM employees WHERE id = ?").get(employeeId);
    return emp && emp.manager_id === myId;
  }
  return false;
}

// POST /api/attendance/checkin - employee checks themself in for today
router.post("/checkin", requireAuth, (req, res) => {
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: "No employee profile linked to this account" });

  const date = todayStr();
  const existing = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND date = ?").get(employeeId, date);
  if (existing && existing.check_in) {
    return res.status(409).json({ error: "Already checked in today" });
  }

  const now = new Date().toISOString();
  if (existing) {
    db.prepare("UPDATE attendance SET check_in = ?, status = 'present' WHERE id = ?").run(now, existing.id);
  } else {
    db.prepare("INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?, ?, ?, 'present')")
      .run(employeeId, date, now);
  }
  const row = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND date = ?").get(employeeId, date);
  res.status(201).json(row);
});

// POST /api/attendance/checkout - employee checks themself out for today
router.post("/checkout", requireAuth, (req, res) => {
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: "No employee profile linked to this account" });

  const date = todayStr();
  const existing = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND date = ?").get(employeeId, date);
  if (!existing || !existing.check_in) {
    return res.status(400).json({ error: "You must check in before checking out" });
  }
  if (existing.check_out) {
    return res.status(409).json({ error: "Already checked out today" });
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE attendance SET check_out = ? WHERE id = ?").run(now, existing.id);
  const row = db.prepare("SELECT * FROM attendance WHERE id = ?").get(existing.id);
  res.json(row);
});

// GET /api/attendance/employee/:id - view attendance history for an employee (self, manager of, or admin)
router.get("/employee/:id", requireAuth, (req, res) => {
  const employeeId = Number(req.params.id);
  if (!canViewEmployee(req, employeeId)) {
    return res.status(403).json({ error: "Forbidden: you cannot view this employee's attendance" });
  }
  const rows = db
    .prepare("SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 90")
    .all(employeeId);
  res.json(rows);
});

// GET /api/attendance/today - admin/manager: today's attendance overview
router.get("/today", requireAuth, requireRole("admin", "manager"), (req, res) => {
  const date = todayStr();
  const { role, employeeId } = req.user;

  let rows;
  if (role === "admin") {
    rows = db.prepare(`
      SELECT a.*, e.full_name FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.date = ?
      ORDER BY e.full_name
    `).all(date);
  } else {
    rows = db.prepare(`
      SELECT a.*, e.full_name FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.date = ? AND e.manager_id = ?
      ORDER BY e.full_name
    `).all(date, employeeId);
  }
  res.json(rows);
});

module.exports = router;
