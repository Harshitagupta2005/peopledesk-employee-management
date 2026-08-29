const DashboardView = {
  async render(root) {
    root.innerHTML = UI.loadingBlock("Loading dashboard…");
    let data;
    try {
      data = await Api.getDashboard();
    } catch (err) {
      root.innerHTML = UI.errorBlock(err.message);
      return;
    }

    if (data.scope === "admin") this.renderAdmin(root, data);
    else if (data.scope === "manager") this.renderManager(root, data);
    else this.renderEmployee(root, data);
  },

  renderAdmin(root, d) {
    const deptRows = d.departmentBreakdown
      .map((r) => `<tr><td>${UI.escapeHtml(r.name)}</td><td class="text-right">${r.count}</td></tr>`)
      .join("");

    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Employees</div><div class="stat-value">${d.employeeCount}</div></div>
        <div class="stat-card"><div class="stat-label">Present Today</div><div class="stat-value">${d.todaysAttendance}</div></div>
        <div class="stat-card"><div class="stat-label">Pending Leave Requests</div><div class="stat-value">${d.pendingLeave}</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Employees by Department</h3></div>
        <div class="panel-body">
          <table><thead><tr><th>Department</th><th class="text-right">Employees</th></tr></thead>
          <tbody>${deptRows || `<tr><td colspan="2">No departments yet</td></tr>`}</tbody></table>
        </div>
      </div>
    `;
  },

  renderManager(root, d) {
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Team Size</div><div class="stat-value">${d.teamCount}</div></div>
        <div class="stat-card"><div class="stat-label">Present Today</div><div class="stat-value">${d.todaysAttendance}</div></div>
        <div class="stat-card"><div class="stat-label">Pending Leave Requests</div><div class="stat-value">${d.pendingLeave}</div></div>
      </div>
      <div class="panel"><div class="panel-body pad">
        <p class="cell-muted">Use <strong>Team</strong> to view your reports, or <strong>Leave Requests</strong> to review pending approvals.</p>
      </div></div>
    `;
  },

  renderEmployee(root, d) {
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Present Days (This Month)</div><div class="stat-value">${d.myAttendanceThisMonth}</div></div>
        <div class="stat-card"><div class="stat-label">Pending Leave Requests</div><div class="stat-value">${d.myPendingLeave}</div></div>
        <div class="stat-card"><div class="stat-label">Today</div><div class="stat-value">${d.checkedOutToday ? "Checked out" : d.checkedInToday ? "Checked in" : "Not marked"}</div></div>
      </div>
      <div class="panel"><div class="panel-body pad flex-between">
        <p class="cell-muted mt-0">Mark today's attendance from the Attendance tab, or submit a new leave request.</p>
        <button class="btn btn-primary" id="quick-checkin">${d.checkedInToday ? (d.checkedOutToday ? "Already checked out" : "Check out") : "Check in"}</button>
      </div></div>
    `;

    const btn = document.getElementById("quick-checkin");
    if (d.checkedOutToday) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          if (d.checkedInToday) {
            await Api.checkOut();
            UI.toast("Checked out successfully", "success");
          } else {
            await Api.checkIn();
            UI.toast("Checked in successfully", "success");
          }
          DashboardView.render(root);
        } catch (err) {
          UI.toast(err.message, "error");
          btn.disabled = false;
        }
      });
    }
  },
};
