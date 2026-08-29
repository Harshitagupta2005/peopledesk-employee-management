const EmployeesView = {
  async render(root) {
    root.innerHTML = UI.loadingBlock("Loading employees…");
    const isAdmin = Api.user.role === "admin";

    let employees, departments = [], managers = [];
    try {
      employees = await Api.getEmployees();
      if (isAdmin) {
        departments = await Api.getDepartments();
        managers = employees.filter((e) => e.role === "manager" || e.role === "admin");
      }
    } catch (err) {
      root.innerHTML = UI.errorBlock(err.message);
      return;
    }

    const actionsHtml = isAdmin ? `<button class="btn btn-primary btn-sm" id="add-employee-btn">+ Add Employee</button>` : "";
    document.getElementById("topbar-actions").innerHTML = actionsHtml;
    if (isAdmin) {
      document.getElementById("add-employee-btn").addEventListener("click", () =>
        EmployeesView.openForm(null, departments, managers)
      );
    }

    if (!employees.length) {
      root.innerHTML = UI.emptyBlock(
        isAdmin ? "No employees yet" : "No direct reports",
        isAdmin ? "Add your first employee to get started." : "You have no employees reporting to you yet."
      );
      return;
    }

    const rows = employees
      .map((e) => `
        <tr>
          <td><strong>${UI.escapeHtml(e.full_name)}</strong><br/><span class="cell-muted">${UI.escapeHtml(e.email)}</span></td>
          <td>${UI.escapeHtml(e.designation || "—")}</td>
          <td>${UI.escapeHtml(e.department_name || "—")}</td>
          <td>${UI.escapeHtml(e.manager_name || "—")}</td>
          <td>${UI.fmtDate(e.joining_date)}</td>
          <td>${UI.statusBadge(e.employment_status)}</td>
          ${isAdmin ? `<td class="text-right">
            <button class="btn btn-ghost btn-sm" data-edit="${e.id}">Edit</button>
            ${e.employment_status === "active" ? `<button class="btn btn-danger btn-sm" data-deactivate="${e.id}">Deactivate</button>` : ""}
          </td>` : ""}
        </tr>
      `)
      .join("");

    root.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <table>
            <thead><tr>
              <th>Employee</th><th>Designation</th><th>Department</th><th>Manager</th><th>Joined</th><th>Status</th>
              ${isAdmin ? `<th></th>` : ""}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    if (isAdmin) {
      root.querySelectorAll("[data-edit]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const emp = employees.find((e) => e.id === Number(btn.dataset.edit));
          EmployeesView.openForm(emp, departments, managers);
        })
      );
      root.querySelectorAll("[data-deactivate]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          if (!confirm("Deactivate this employee? Their login will be disabled.")) return;
          try {
            await Api.deactivateEmployee(btn.dataset.deactivate);
            UI.toast("Employee deactivated", "success");
            EmployeesView.render(root);
          } catch (err) {
            UI.toast(err.message, "error");
          }
        })
      );
    }
  },

  openForm(existing, departments, managers) {
    const isEdit = !!existing;
    const deptOptions = departments
      .map((d) => `<option value="${d.id}" ${existing && existing.department_id === d.id ? "selected" : ""}>${UI.escapeHtml(d.name)}</option>`)
      .join("");
    const mgrOptions = managers
      .filter((m) => !existing || m.id !== existing.id)
      .map((m) => `<option value="${m.id}" ${existing && existing.manager_id === m.id ? "selected" : ""}>${UI.escapeHtml(m.full_name)}</option>`)
      .join("");

    UI.openModal(`
      <h3>${isEdit ? "Edit Employee" : "Add Employee"}</h3>
      <form id="employee-form">
        <div class="form-row"><label>Full name</label>
          <input name="full_name" required value="${isEdit ? UI.escapeHtml(existing.full_name) : ""}" />
        </div>
        ${!isEdit ? `
        <div class="form-grid-2">
          <div class="form-row"><label>Email</label><input type="email" name="email" required /></div>
          <div class="form-row"><label>Temporary password</label><input type="password" name="password" required minlength="8" /></div>
        </div>
        <div class="form-row"><label>Role</label>
          <select name="role" required>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>` : ""}
        <div class="form-grid-2">
          <div class="form-row"><label>Designation</label>
            <input name="designation" value="${isEdit ? UI.escapeHtml(existing.designation || "") : ""}" />
          </div>
          <div class="form-row"><label>Joining date</label>
            <input type="date" name="joining_date" required value="${isEdit ? existing.joining_date : ""}" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label>Department</label>
            <select name="department_id"><option value="">— None —</option>${deptOptions}</select>
          </div>
          <div class="form-row"><label>Manager</label>
            <select name="manager_id"><option value="">— None —</option>${mgrOptions}</select>
          </div>
        </div>
        ${isEdit ? `
        <div class="form-row"><label>Employment status</label>
          <select name="employment_status">
            <option value="active" ${existing.employment_status === "active" ? "selected" : ""}>Active</option>
            <option value="inactive" ${existing.employment_status === "inactive" ? "selected" : ""}>Inactive</option>
          </select>
        </div>` : ""}
        <p class="form-error" id="employee-form-error" hidden></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="cancel-employee-form">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Create employee"}</button>
        </div>
      </form>
    `);

    document.getElementById("cancel-employee-form").addEventListener("click", UI.closeModal);
    document.getElementById("employee-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      if (payload.department_id === "") payload.department_id = null;
      if (payload.manager_id === "") payload.manager_id = null;
      else payload.manager_id = Number(payload.manager_id);

      const errEl = document.getElementById("employee-form-error");
      errEl.hidden = true;
      try {
        if (isEdit) {
          await Api.updateEmployee(existing.id, payload);
          UI.toast("Employee updated", "success");
        } else {
          await Api.createEmployee(payload);
          UI.toast("Employee created", "success");
        }
        UI.closeModal();
        EmployeesView.render(document.getElementById("view-root"));
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  },
};
