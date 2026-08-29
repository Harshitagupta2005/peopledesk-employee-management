const DepartmentsView = {
  async render(root) {
    const isAdmin = Api.user.role === "admin";
    document.getElementById("topbar-actions").innerHTML = isAdmin
      ? `<button class="btn btn-primary btn-sm" id="add-dept-btn">+ Add Department</button>` : "";
    if (isAdmin) {
      document.getElementById("add-dept-btn").addEventListener("click", () => DepartmentsView.openForm());
    }

    root.innerHTML = UI.loadingBlock("Loading departments…");
    let departments;
    try {
      departments = await Api.getDepartments();
    } catch (err) {
      root.innerHTML = UI.errorBlock(err.message);
      return;
    }

    if (!departments.length) {
      root.innerHTML = UI.emptyBlock("No departments yet", "Create your first department to start organizing employees.");
      return;
    }

    const rows = departments
      .map((d) => `
        <tr>
          <td><strong>${UI.escapeHtml(d.name)}</strong></td>
          <td class="cell-muted">${UI.escapeHtml(d.description || "—")}</td>
        </tr>
      `)
      .join("");

    root.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <table><thead><tr><th>Name</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
      </div>
    `;
  },

  openForm() {
    UI.openModal(`
      <h3>Add Department</h3>
      <form id="dept-form">
        <div class="form-row"><label>Name</label><input name="name" required /></div>
        <div class="form-row"><label>Description</label><textarea name="description" rows="2"></textarea></div>
        <p class="form-error" id="dept-form-error" hidden></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="cancel-dept-form">Cancel</button>
          <button type="submit" class="btn btn-primary">Create</button>
        </div>
      </form>
    `);
    document.getElementById("cancel-dept-form").addEventListener("click", UI.closeModal);
    document.getElementById("dept-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      const errEl = document.getElementById("dept-form-error");
      errEl.hidden = true;
      try {
        await Api.createDepartment(payload);
        UI.toast("Department created", "success");
        UI.closeModal();
        DepartmentsView.render(document.getElementById("view-root"));
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  },
};
