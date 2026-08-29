const LeaveView = {
  async render(root) {
    const role = Api.user.role;
    const canRequest = role === "employee";
    document.getElementById("topbar-actions").innerHTML = canRequest
      ? `<button class="btn btn-primary btn-sm" id="request-leave-btn">+ Request Leave</button>`
      : "";
    if (canRequest) {
      document.getElementById("request-leave-btn").addEventListener("click", () => LeaveView.openForm());
    }

    root.innerHTML = UI.loadingBlock("Loading leave requests…");
    let requests;
    try {
      requests = await Api.getLeaveRequests();
    } catch (err) {
      root.innerHTML = UI.errorBlock(err.message);
      return;
    }

    if (!requests.length) {
      root.innerHTML = UI.emptyBlock("No leave requests", canRequest ? "Submit your first request using the button above." : "Nothing to review right now.");
      return;
    }

    const canReview = role === "admin" || role === "manager";
    const rows = requests
      .map((r) => `
        <tr>
          ${canReview ? `<td><strong>${UI.escapeHtml(r.employee_name)}</strong></td>` : ""}
          <td>${UI.escapeHtml(r.leave_type)}</td>
          <td>${UI.fmtDate(r.start_date)} → ${UI.fmtDate(r.end_date)}</td>
          <td class="cell-muted">${UI.escapeHtml(r.reason || "—")}</td>
          <td>${UI.statusBadge(r.status)}</td>
          ${canReview ? `<td class="text-right">
            ${r.status === "pending" ? `
              <button class="btn btn-secondary btn-sm" data-approve="${r.id}">Approve</button>
              <button class="btn btn-danger btn-sm" data-reject="${r.id}">Reject</button>
            ` : `<span class="cell-muted">Reviewed</span>`}
          </td>` : ""}
        </tr>
      `)
      .join("");

    root.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <table>
            <thead><tr>
              ${canReview ? "<th>Employee</th>" : ""}
              <th>Type</th><th>Dates</th><th>Reason</th><th>Status</th>
              ${canReview ? "<th></th>" : ""}
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    if (canReview) {
      root.querySelectorAll("[data-approve]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await Api.approveLeave(btn.dataset.approve);
            UI.toast("Leave request approved", "success");
            LeaveView.render(root);
          } catch (err) {
            UI.toast(err.message, "error");
          }
        })
      );
      root.querySelectorAll("[data-reject]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await Api.rejectLeave(btn.dataset.reject);
            UI.toast("Leave request rejected", "success");
            LeaveView.render(root);
          } catch (err) {
            UI.toast(err.message, "error");
          }
        })
      );
    }
  },

  openForm() {
    UI.openModal(`
      <h3>Request Leave</h3>
      <form id="leave-form">
        <div class="form-row"><label>Leave type</label>
          <select name="leave_type" required>
            <option value="casual">Casual</option>
            <option value="sick">Sick</option>
            <option value="earned">Earned</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        <div class="form-grid-2">
          <div class="form-row"><label>Start date</label><input type="date" name="start_date" required /></div>
          <div class="form-row"><label>End date</label><input type="date" name="end_date" required /></div>
        </div>
        <div class="form-row"><label>Reason</label><textarea name="reason" rows="3" placeholder="Briefly describe the reason"></textarea></div>
        <p class="form-error" id="leave-form-error" hidden></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="cancel-leave-form">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit request</button>
        </div>
      </form>
    `);

    document.getElementById("cancel-leave-form").addEventListener("click", UI.closeModal);
    document.getElementById("leave-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      const errEl = document.getElementById("leave-form-error");
      errEl.hidden = true;
      try {
        await Api.submitLeave(payload);
        UI.toast("Leave request submitted", "success");
        UI.closeModal();
        LeaveView.render(document.getElementById("view-root"));
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  },
};
