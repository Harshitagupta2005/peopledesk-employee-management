const express = require("express");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const LEAVE_SELECT = `
  SELECT l.*, e.full_name AS employee_name, r.full_name AS reviewed_by_name
  FROM leave_requests l
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN employees r ON r.id = l.reviewed_by
`;

function isValidDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return !isNaN(s) && !isNaN(e) && s <= e;
}

// POST /api/leave - employee submits a leave request for themselves
router.post("/", requireAuth, (req, res) => {
  const employeeId = req.user.employeeId;
  if (!employeeId) return res.status(400).json({ error: "No employee profile linked to this account" });

  const { leave_type, start_date, end_date, reason } = req.body || {};
  if (!leave_type || !start_date || !end_date) {
    return res.status(400).json({ error: "leave_type, start_date and end_date are required" });
  }
  if (!["sick", "casual", "earned", "unpaid"].includes(leave_type)) {
    return res.status(400).json({ error: "leave_type must be one of sick, casual, earned, unpaid" });
  }
  if (!isValidDateRange(start_date, end_date)) {
    return res.status(400).json({ error: "Invalid date range: start_date must be on or before end_date" });
  }

  const result = db.prepare(`
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(employeeId, leave_type, start_date, end_date, reason || null);

  const row = db.prepare(`${LEAVE_SELECT} WHERE l.id = ?`).get(result.lastInsertRowid);
  res.status(201).json(row);
});

// GET /api/leave - admin: all, manager: team's requests, employee: own requests
router.get("/", requireAuth, (req, res) => {
  const { role, employeeId } = req.user;

  if (role === "admin") {
    return res.json(db.prepare(`${LEAVE_SELECT} ORDER BY l.created_at DESC`).all());
  }
  if (role === "manager") {
    return res.json(
      db.prepare(`${LEAVE_SELECT} WHERE e.manager_id = ? ORDER BY l.created_at DESC`).all(employeeId)
    );
  }
  // employee: own only
  if (!employeeId) return res.status(400).json({ error: "No employee profile linked to this account" });
  return res.json(
    db.prepare(`${LEAVE_SELECT} WHERE l.employee_id = ? ORDER BY l.created_at DESC`).all(employeeId)
  );
});

// PUT /api/leave/:id/approve - admin or the requester's manager
router.put("/:id/approve", requireAuth, requireRole("admin", "manager"), (req, res) => {
  const id = Number(req.params.id);
  const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id);
  if (!leave) return res.status(404).json({ error: "Leave request not found" });
  if (leave.status !== "pending") {
    return res.status(409).json({ error: `Leave request is already ${leave.status}` });
  }

  const { role, employeeId } = req.user;
  if (role === "manager") {
    const emp = db.prepare("SELECT manager_id FROM employees WHERE id = ?").get(leave.employee_id);
    if (!emp || emp.manager_id !== employeeId) {
      return res.status(403).json({ error: "Forbidden: you can only review requests from your own team" });
    }
  }

  db.prepare(`
    UPDATE leave_requests SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?
  `).run(employeeId, id);

  res.json(db.prepare(`${LEAVE_SELECT} WHERE l.id = ?`).get(id));
});

// PUT /api/leave/:id/reject - admin or the requester's manager
router.put("/:id/reject", requireAuth, requireRole("admin", "manager"), (req, res) => {
  const id = Number(req.params.id);
  const leave = db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id);
  if (!leave) return res.status(404).json({ error: "Leave request not found" });
  if (leave.status !== "pending") {
    return res.status(409).json({ error: `Leave request is already ${leave.status}` });
  }

  const { role, employeeId } = req.user;
  if (role === "manager") {
    const emp = db.prepare("SELECT manager_id FROM employees WHERE id = ?").get(leave.employee_id);
    if (!emp || emp.manager_id !== employeeId) {
      return res.status(403).json({ error: "Forbidden: you can only review requests from your own team" });
    }
  }

  db.prepare(`
    UPDATE leave_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?
  `).run(employeeId, id);

  res.json(db.prepare(`${LEAVE_SELECT} WHERE l.id = ?`).get(id));
});

module.exports = router;
