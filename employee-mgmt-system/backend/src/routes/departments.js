const express = require("express");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/departments - any authenticated user
router.get("/", requireAuth, (req, res) => {
  const departments = db.prepare("SELECT * FROM departments ORDER BY name").all();
  res.json(departments);
});

// POST /api/departments - admin only
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  try {
    const result = db
      .prepare("INSERT INTO departments (name, description) VALUES (?, ?)")
      .run(name.trim(), description || null);
    const dept = db.prepare("SELECT * FROM departments WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(dept);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "A department with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create department" });
  }
});

module.exports = router;
