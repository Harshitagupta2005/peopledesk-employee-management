const AttendanceView = {
  async render(root) {
    document.getElementById("topbar-actions").innerHTML = "";
    const role = Api.user.role;
    if (role === "employee") return this.renderEmployee(root);
    return this.renderOverview(root);
  },

  async renderEmployee(root) {
    root.innerHTML = UI.loadingBlock("Loading attendance…");
    let history, me;
    try {
      me = await Api.getMyProfile();
      history = await Api.getEmployeeAttendance(me.id);
    } catch (err) {
      root.innerHTML = UI.errorBlock(err.message);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayRecord = history.find((h) => h.date === today);
    const checkedIn = !!(todayRecord && todayRecord.check_in);
    const checkedOut = !!(todayRecord && todayRecord.check_out);

    const rows = history
      .map((h) => `
        <tr>
          <td>${UI.fmtDate(h.date)}</td>
          <td>${UI.fmtTime(h.check_in)}</td>
          <td>${UI.fmtTime(h.check_out)}</td>
          <td>${UI.statusBadge(h.status)}</td>
        </tr>
      `)
      .join("");

    root.innerHTML = `
      <div class="panel">
        <div class="panel-header flex-between">
          <h3>Today — ${UI.fmtDate(today)}</h3>
          <button class="btn btn-primary btn-sm" id="mark-btn" ${checkedOut ? "disabled" : ""}>
            ${checkedOut ? "Checked out" : checkedIn ? "Check out" : "Check in"}
          </button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Attendance History</h3></div>
        <div class="panel-body">
          ${history.length ? `<table><thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
            : UI.emptyBlock("No attendance recorded yet", "Check in for the first time to start your history.")}
        </div>
      </div>
    `;

    const btn = document.getElementById("mark-btn");
    if (!checkedOut) {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          if (checkedIn) { await Api.checkOut(); UI.toast("Checked out", "success"); }
          else { await Api.checkIn(); UI.toast("Checked in", "success"); }
          AttendanceView.render(root);
        } catch (err) {
          UI.toast(err.message, "error");
          btn.disabled = false;
        }
      });
    }
  },

  async renderOverview(root) {
    root.innerHTML = UI.loadingBlock("Loading today's attendance…");
    let rows;
    try {
      rows = await Api.getTodaysAttendance();
    } catch (err) {
      root.innerHTML = UI.errorBlock(err.message);
      return;
    }

    const tableRows = rows
      .map((r) => `
        <tr>
          <td><strong>${UI.escapeHtml(r.full_name)}</strong></td>
          <td>${UI.fmtTime(r.check_in)}</td>
          <td>${UI.fmtTime(r.check_out)}</td>
          <td>${UI.statusBadge(r.status)}</td>
        </tr>
      `)
      .join("");

    root.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h3>Today's Attendance — ${UI.fmtDate(new Date())}</h3></div>
        <div class="panel-body">
          ${rows.length ? `<table><thead><tr><th>Employee</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>`
            : UI.emptyBlock("No attendance marked yet today", "Records will appear here as employees check in.")}
        </div>
      </div>
    `;
  },
};
