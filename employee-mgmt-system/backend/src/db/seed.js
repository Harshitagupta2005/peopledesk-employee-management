require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./init");

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

function seed() {
  console.log("Seeding database...");

  // Clear existing data (dev convenience only)
  db.exec(`
    DELETE FROM leave_requests;
    DELETE FROM attendance;
    DELETE FROM employees;
    DELETE FROM users;
    DELETE FROM departments;
  `);

  const insertDept = db.prepare("INSERT INTO departments (name, description) VALUES (?, ?)");
  const engDept = insertDept.run("Engineering", "Software development and infrastructure");
  const hrDept = insertDept.run("Human Resources", "People operations and HR");
  const salesDept = insertDept.run("Sales", "Business development and sales");

  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)"
  );
  const insertEmployee = db.prepare(`
    INSERT INTO employees (user_id, full_name, designation, department_id, manager_id, joining_date, employment_status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `);

  // Admin / HR
  const adminUser = insertUser.run("admin@cruvels.test", hash("Admin@123"), "admin");
  const adminEmp = insertEmployee.run(
    adminUser.lastInsertRowid, "Priya Sharma", "HR Administrator", hrDept.lastInsertRowid, null, "2023-01-10"
  );

  // Manager (Engineering)
  const managerUser = insertUser.run("manager@cruvels.test", hash("Manager@123"), "manager");
  const managerEmp = insertEmployee.run(
    managerUser.lastInsertRowid, "Rahul Verma", "Engineering Manager", engDept.lastInsertRowid, null, "2023-03-15"
  );

  // Employees reporting to the manager
  const emp1User = insertUser.run("harshita@cruvels.test", hash("Employee@123"), "employee");
  const emp1 = insertEmployee.run(
    emp1User.lastInsertRowid, "Harshita Gupta", "Software Engineer", engDept.lastInsertRowid,
    managerEmp.lastInsertRowid, "2024-07-01"
  );

  const emp2User = insertUser.run("jyoti@cruvels.test", hash("Employee@123"), "employee");
  const emp2 = insertEmployee.run(
    emp2User.lastInsertRowid, "Jyoti Pandey", "Backend Developer", engDept.lastInsertRowid,
    managerEmp.lastInsertRowid, "2024-08-12"
  );

  // Sales employee, no direct manager assigned (edge case for testing)
  const emp3User = insertUser.run("aman@cruvels.test", hash("Employee@123"), "employee");
  const emp3 = insertEmployee.run(
    emp3User.lastInsertRowid, "Aman Singh", "Sales Executive", salesDept.lastInsertRowid, null, "2024-02-20"
  );

  // Sample attendance for the last few days
  const insertAttendance = db.prepare(`
    INSERT OR IGNORE INTO attendance (employee_id, date, check_in, check_out, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const today = new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    insertAttendance.run(emp1.lastInsertRowid, dateStr, `${dateStr}T09:15:00`, `${dateStr}T18:05:00`, "present");
    insertAttendance.run(emp2.lastInsertRowid, dateStr, `${dateStr}T09:40:00`, `${dateStr}T18:00:00`, "present");
  }
  insertAttendance.run(emp3.lastInsertRowid, new Date(today.getTime() - 86400000).toISOString().slice(0, 10), null, null, "absent");

  // Sample leave requests
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertLeave.run(emp1.lastInsertRowid, "sick", "2026-09-02", "2026-09-03", "Fever and rest advised", "pending");
  insertLeave.run(emp2.lastInsertRowid, "casual", "2026-09-10", "2026-09-10", "Personal work", "approved");
  insertLeave.run(emp3.lastInsertRowid, "earned", "2026-09-15", "2026-09-18", "Family function", "pending");

  console.log("Seed complete.");
  console.log("---------------------------------------------");
  console.log("Sample credentials:");
  console.log("Admin    -> admin@cruvels.test    / Admin@123");
  console.log("Manager  -> manager@cruvels.test  / Manager@123");
  console.log("Employee -> harshita@cruvels.test / Employee@123");
  console.log("Employee -> jyoti@cruvels.test    / Employee@123");
  console.log("Employee -> aman@cruvels.test     / Employee@123");
  console.log("---------------------------------------------");
}

seed();
