/**
 * Automated tests for the Employee Management System API.
 * Run with: npm test
 *
 * Uses a dedicated test SQLite DB (data/test.db) so it never touches
 * the dev/demo database. Re-seeds fresh data before the suite runs.
 */
process.env.DB_PATH = "./data/test.db";
process.env.JWT_SECRET = "test_secret";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

// Remove any stale test DB so each run starts clean
const dbFile = path.join(__dirname, "..", "data", "test.db");
for (const f of [dbFile, dbFile + "-wal", dbFile + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const bcrypt = require("bcryptjs");
const db = require("../src/db/init");
const app = require("../src/server");
const request = require("supertest");

// --- Seed minimal fixture data directly (independent of seed.js) ---
function seedFixtures() {
  const deptId = db.prepare("INSERT INTO departments (name) VALUES ('Engineering')").run().lastInsertRowid;

  const adminUser = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')")
    .run("admin@test.com", bcrypt.hashSync("Admin@123", 10));
  db.prepare("INSERT INTO employees (user_id, full_name, joining_date) VALUES (?, 'Test Admin', '2024-01-01')")
    .run(adminUser.lastInsertRowid);

  const mgrUser = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'manager')")
    .run("manager@test.com", bcrypt.hashSync("Manager@123", 10));
  const mgrEmp = db.prepare("INSERT INTO employees (user_id, full_name, department_id, joining_date) VALUES (?, 'Test Manager', ?, '2024-01-01')")
    .run(mgrUser.lastInsertRowid, deptId);

  const empUser = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'employee')")
    .run("employee@test.com", bcrypt.hashSync("Employee@123", 10));
  db.prepare("INSERT INTO employees (user_id, full_name, department_id, manager_id, joining_date) VALUES (?, 'Test Employee', ?, ?, '2024-06-01')")
    .run(empUser.lastInsertRowid, deptId, mgrEmp.lastInsertRowid);
}
seedFixtures();

async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

test("POST /api/auth/login - succeeds with correct credentials", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: "Admin@123" });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, "admin");
});

test("POST /api/auth/login - fails with wrong password (401, no info leak)", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: "WrongPassword" });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Invalid email or password");
});

test("POST /api/auth/login - fails with unknown email (401, same generic message)", async () => {
  const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.com", password: "whatever123" });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, "Invalid email or password");
});

test("GET /api/employees - rejects requests with no auth token (401)", async () => {
  const res = await request(app).get("/api/employees");
  assert.equal(res.status, 401);
});

test("GET /api/employees - forbidden for role=employee (403, RBAC enforced server-side)", async () => {
  const token = await loginAs("employee@test.com", "Employee@123");
  const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /api/employees - admin sees all employees", async () => {
  const token = await loginAs("admin@test.com", "Admin@123");
  const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
});

test("GET /api/employees - manager sees only their direct reports", async () => {
  const token = await loginAs("manager@test.com", "Manager@123");
  const res = await request(app).get("/api/employees").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].full_name, "Test Employee");
});

test("POST /api/leave - rejects invalid date range (start after end)", async () => {
  const token = await loginAs("employee@test.com", "Employee@123");
  const res = await request(app)
    .post("/api/leave")
    .set("Authorization", `Bearer ${token}`)
    .send({ leave_type: "casual", start_date: "2026-09-10", end_date: "2026-09-05", reason: "test" });
  assert.equal(res.status, 400);
});

test("POST /api/leave -> approve workflow: employee submits, manager approves", async () => {
  const empToken = await loginAs("employee@test.com", "Employee@123");
  const createRes = await request(app)
    .post("/api/leave")
    .set("Authorization", `Bearer ${empToken}`)
    .send({ leave_type: "sick", start_date: "2026-09-01", end_date: "2026-09-02", reason: "fever" });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.status, "pending");

  const mgrToken = await loginAs("manager@test.com", "Manager@123");
  const approveRes = await request(app)
    .put(`/api/leave/${createRes.body.id}/approve`)
    .set("Authorization", `Bearer ${mgrToken}`);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, "approved");
});

test("PUT /api/leave/:id/approve - a manager cannot approve another manager's team's request (403)", async () => {
  // Create a second manager with no reports, then try to approve the employee's leave (belongs to first manager's team)
  const deptId = db.prepare("SELECT id FROM departments LIMIT 1").get().id;
  const otherMgrUser = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'manager')")
    .run("other-manager@test.com", bcrypt.hashSync("Manager@123", 10));
  db.prepare("INSERT INTO employees (user_id, full_name, department_id, joining_date) VALUES (?, 'Other Manager', ?, '2024-01-01')")
    .run(otherMgrUser.lastInsertRowid, deptId);

  const empToken = await loginAs("employee@test.com", "Employee@123");
  const createRes = await request(app)
    .post("/api/leave")
    .set("Authorization", `Bearer ${empToken}`)
    .send({ leave_type: "casual", start_date: "2026-10-01", end_date: "2026-10-01" });

  const otherMgrToken = await loginAs("other-manager@test.com", "Manager@123");
  const res = await request(app)
    .put(`/api/leave/${createRes.body.id}/approve`)
    .set("Authorization", `Bearer ${otherMgrToken}`);
  assert.equal(res.status, 403);
});

test("GET /api/employees/:id - 404 for a non-existent employee id", async () => {
  const token = await loginAs("admin@test.com", "Admin@123");
  const res = await request(app).get("/api/employees/999999").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 404);
});

test("POST /api/attendance/checkin then checkout - full attendance workflow", async () => {
  const token = await loginAs("employee@test.com", "Employee@123");
  const checkin = await request(app).post("/api/attendance/checkin").set("Authorization", `Bearer ${token}`);
  assert.equal(checkin.status, 201);
  assert.ok(checkin.body.check_in);

  // Duplicate check-in should fail
  const dupe = await request(app).post("/api/attendance/checkin").set("Authorization", `Bearer ${token}`);
  assert.equal(dupe.status, 409);

  const checkout = await request(app).post("/api/attendance/checkout").set("Authorization", `Bearer ${token}`);
  assert.equal(checkout.status, 200);
  assert.ok(checkout.body.check_out);
});
