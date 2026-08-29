const ROUTES = {
  dashboard: { label: "Dashboard", icon: "🏠", view: DashboardView, roles: ["admin", "manager", "employee"] },
  employees: { label: "Employees", icon: "👥", view: EmployeesView, roles: ["admin"] },
  team: { label: "My Team", icon: "🧑‍🤝‍🧑", view: EmployeesView, roles: ["manager"] },
  departments: { label: "Departments", icon: "🏢", view: DepartmentsView, roles: ["admin"] },
  attendance: { label: "Attendance", icon: "🕒", view: AttendanceView, roles: ["admin", "manager", "employee"] },
  leave: { label: "Leave Requests", icon: "📅", view: LeaveView, roles: ["admin", "manager", "employee"] },
};

const App = {
  init() {
    document.getElementById("login-form").addEventListener("submit", (e) => this.handleLogin(e));
    document.getElementById("logout-btn").addEventListener("click", () => this.logout());
    window.addEventListener("hashchange", () => this.renderRoute());

    if (Api.token && Api.user) {
      this.showApp();
    } else {
      this.showLogin();
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    errEl.hidden = true;

    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    try {
      const { token, user } = await Api.login(email, password);
      Api.setSession(token, user);
      this.showApp();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
    }
  },

  logout() {
    Api.clearSession();
    window.location.hash = "";
    this.showLogin();
  },

  showLogin() {
    document.getElementById("login-view").hidden = false;
    document.getElementById("app-shell").hidden = true;
  },

  showApp() {
    document.getElementById("login-view").hidden = true;
    document.getElementById("app-shell").hidden = false;
    this.renderNav();
    this.renderUserChip();
    this.renderRoute();
  },

  renderUserChip() {
    const { email, role } = Api.user;
    document.getElementById("user-chip").innerHTML = `
      <span class="u-name">${UI.escapeHtml(email)}</span>
      <span class="u-role">${UI.escapeHtml(role)}</span>
    `;
  },

  renderNav() {
    const role = Api.user.role;
    const nav = document.getElementById("nav-links");
    nav.innerHTML = Object.entries(ROUTES)
      .filter(([, r]) => r.roles.includes(role))
      .map(([key, r]) => `<a href="#${key}" class="nav-link" data-route="${key}">${r.icon} ${r.label}</a>`)
      .join("");
  },

  currentRouteKey() {
    const hash = window.location.hash.replace("#", "");
    const role = Api.user.role;
    if (hash && ROUTES[hash] && ROUTES[hash].roles.includes(role)) return hash;
    // default route per role
    return "dashboard";
  },

  renderRoute() {
    const key = this.currentRouteKey();
    if (window.location.hash !== `#${key}`) window.location.hash = key;

    document.querySelectorAll(".nav-link").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === key);
    });

    document.getElementById("page-title").textContent = ROUTES[key].label;
    UI.closeModal();
    const root = document.getElementById("view-root");
    ROUTES[key].view.render(root);
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
