const UI = {
  toast(message, type = "default") {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "toast-error" : type === "success" ? "toast-success" : ""}`;
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  loadingBlock(label = "Loading…") {
    return `<div class="state-block"><div class="state-icon">⏳</div><p>${this.escapeHtml(label)}</p></div>`;
  },

  emptyBlock(title, subtitle) {
    return `<div class="state-block"><div class="state-icon">📭</div><h4>${this.escapeHtml(title)}</h4><p>${this.escapeHtml(subtitle || "")}</p></div>`;
  },

  errorBlock(message) {
    return `<div class="state-block"><div class="state-icon">⚠️</div><h4>Something went wrong</h4><p>${this.escapeHtml(message)}</p></div>`;
  },

  statusBadge(status) {
    const map = {
      present: "badge-green", approved: "badge-green", active: "badge-green",
      pending: "badge-amber", half_day: "badge-amber",
      absent: "badge-red", rejected: "badge-red", inactive: "badge-red",
      on_leave: "badge-grey",
    };
    const cls = map[status] || "badge-grey";
    return `<span class="badge ${cls}">${this.escapeHtml((status || "").replace("_", " "))}</span>`;
  },

  fmtDate(isoOrDateStr) {
    if (!isoOrDateStr) return "—";
    const d = new Date(isoOrDateStr);
    if (isNaN(d)) return isoOrDateStr;
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  },

  fmtTime(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    if (isNaN(d)) return "—";
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  },

  openModal(html) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal-card">${html}</div></div>`;
    document.getElementById("modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") UI.closeModal();
    });
  },

  closeModal() {
    document.getElementById("modal-root").innerHTML = "";
  },
};
