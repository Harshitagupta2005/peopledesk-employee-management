const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/dashboard - stats scoped by role
router.get("/", requireAuth, (req, res) => {
  const { role, employeeId } = req.user;
  const date = todayStr();

  if (role === "admin") {
    const employeeCount = db.prepare("SELECT COUNT(*) c FROM employees WHERE employment_status = 'active'").get().c;
    const departmentBreakdown = db.prepare(`
      SELECT d.name, COUNT(e.id) as count
      FROM departments d LEFT JOIN employees e ON e.department_id = d.id AND e.employment_status = 'active'
      GROUP BY d.id ORDER BY d.name
    `).all();
    const todaysAttendance = db.prepare("SELECT COUNT(*) c FROM attendance WHERE date = ? AND status = 'present'").get(date).c;
    const pendingLeave = db.prepare("SELECT COUNT(*) c FROM leave_requests WHERE status = 'pending'").get().c;

    return res.json({
      scope: "admin",
      employeeCount,
      departmentBreakdown,
      todaysAttendance,
      pendingLeave,
    });
  }

  if (role === "manager") {
    const teamCount = db.prepare("SELECT COUNT(*) c FROM employees WHERE manager_id = ? AND employment_status = 'active'").get(employeeId).c;
    const todaysAttendance = db.prepare(`
      SELECT COUNT(*) c FROM attendance a JOIN employees e ON e.id = a.employee_id
      WHERE a.date = ? AND a.status = 'present' AND e.manager_id = ?
    `).get(date, employeeId).c;
    const pendingLeave = db.prepare(`
      SELECT COUNT(*) c FROM leave_requests l JOIN employees e ON e.id = l.employee_id
      WHERE l.status = 'pending' AND e.manager_id = ?
    `).get(employeeId).c;

    return res.json({ scope: "manager", teamCount, todaysAttendance, pendingLeave });
  }

  // employee scope
  if (!employeeId) return res.status(400).json({ error: "No employee profile linked to this account" });

  const myAttendanceThisMonth = db.prepare(`
    SELECT COUNT(*) c FROM attendance WHERE employee_id = ? AND status = 'present' AND date >= date('now', 'start of month')
  `).get(employeeId).c;
  const myPendingLeave = db.prepare(`
    SELECT COUNT(*) c FROM leave_requests WHERE employee_id = ? AND status = 'pending'
  `).get(employeeId).c;
  const todayRecord = db.prepare("SELECT * FROM attendance WHERE employee_id = ? AND date = ?").get(employeeId, date);

  return res.json({
    scope: "employee",
    myAttendanceThisMonth,
    myPendingLeave,
    checkedInToday: !!(todayRecord && todayRecord.check_in),
    checkedOutToday: !!(todayRecord && todayRecord.check_out),
  });
});

module.exports = router;
