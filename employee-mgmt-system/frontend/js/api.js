// Thin fetch wrapper around the backend API.
// Change this if the backend runs on a different host/port.
const API_BASE = window.PEOPLEDESK_API_BASE || "http://localhost:4000/api";

const Api = {
  token: localStorage.getItem("pd_token") || null,
  user: JSON.parse(localStorage.getItem("pd_user") || "null"),

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem("pd_token", token);
    localStorage.setItem("pd_user", JSON.stringify(user));
  },

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem("pd_token");
    localStorage.removeItem("pd_user");
  },

  async request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new Error("Could not reach the server. Is the backend running on " + API_BASE + "?");
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }

    if (res.status === 401 && this.token) {
      // Session expired/invalid — force back to login
      this.clearSession();
      window.location.reload();
    }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path) { return this.request("GET", path); },
  post(path, body) { return this.request("POST", path, body); },
  put(path, body) { return this.request("PUT", path, body); },
  del(path) { return this.request("DELETE", path); },

  // --- Auth ---
  login(email, password) { return this.post("/auth/login", { email, password }); },

  // --- Employees ---
  getEmployees() { return this.get("/employees"); },
  getMyProfile() { return this.get("/employees/me"); },
  getEmployee(id) { return this.get(`/employees/${id}`); },
  createEmployee(payload) { return this.post("/employees", payload); },
  updateEmployee(id, payload) { return this.put(`/employees/${id}`, payload); },
  deactivateEmployee(id) { return this.del(`/employees/${id}`); },

  // --- Departments ---
  getDepartments() { return this.get("/departments"); },
  createDepartment(payload) { return this.post("/departments", payload); },

  // --- Attendance ---
  checkIn() { return this.post("/attendance/checkin"); },
  checkOut() { return this.post("/attendance/checkout"); },
  getEmployeeAttendance(id) { return this.get(`/attendance/employee/${id}`); },
  getTodaysAttendance() { return this.get("/attendance/today"); },

  // --- Leave ---
  getLeaveRequests() { return this.get("/leave"); },
  submitLeave(payload) { return this.post("/leave", payload); },
  approveLeave(id) { return this.put(`/leave/${id}/approve`); },
  rejectLeave(id) { return this.put(`/leave/${id}/reject`); },

  // --- Dashboard ---
  getDashboard() { return this.get("/dashboard"); },
};
