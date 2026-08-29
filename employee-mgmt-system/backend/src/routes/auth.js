const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/init");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());

  // Use a generic error message for both "no such user" and "wrong password"
  // so we don't leak which emails are registered.
  if (!user || !user.is_active) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const employee = db.prepare("SELECT id FROM employees WHERE user_id = ?").get(user.id);

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: employee ? employee.id : null,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, employeeId: payload.employeeId },
  });
});

module.exports = router;
