const STORAGE_PAID = "eoselia_paid_final_v1";
const STORAGE_DATES = "eoselia_dates_final_v1";
const STORAGE_NOTES = "eoselia_notes_final_v1";
const STORAGE_THEME = "eoselia_theme_final_v1";

let paidMap = JSON.parse(localStorage.getItem(STORAGE_PAID) || "{}");
let paymentDates = JSON.parse(localStorage.getItem(STORAGE_DATES) || "{}");
let notesMap = JSON.parse(localStorage.getItem(STORAGE_NOTES) || "{}");
window.prepayments = window.loadPrepayments ? window.loadPrepayments() : [];
window.currentSchedule = [];

window.formatMoney = function (v) {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(v || 0)) + " грн";
};

window.parseDate = function (str) {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
};

function todayInput() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function saveState() {
  localStorage.setItem(STORAGE_PAID, JSON.stringify(paidMap));
  localStorage.setItem(STORAGE_DATES, JSON.stringify(paymentDates));
  localStorage.setItem(STORAGE_NOTES, JSON.stringify(notesMap));
}

function buildBaseRows() {
  let remaining = Number(window.INITIAL_AMOUNT || 0);

  return (window.PAYMENTS || []).map((p, i) => {
    const interest = Number(p.interest || 0);
    const principal = Number(p.principal || 0);
    const total = Number(p.total || 0);
    const monthlyRate = remaining > 0 ? interest / remaining : 0;

    remaining = +(remaining - principal).toFixed(2);

    return {
      id: i,
      date: p.date,
      principal,
      interest,
      total,
      monthlyRate,
      remainingAfter: Math.max(remaining, 0)
    };
  });
}

function buildProjectedSchedule() {
  const baseRows = buildBaseRows();
  let balance = Number(window.INITIAL_AMOUNT || 0);

  return baseRows.map(item => {
    const prepay = window.getPrepaySumByDate ? window.getPrepaySumByDate(item.date, window.prepayments) : 0;
    const projectedInterest = Math.max(0, +(balance * item.monthlyRate).toFixed(2));
    const projectedPrincipal = Math.min(item.principal, balance);
    const projectedTotal = +(projectedPrincipal + projectedInterest).toFixed(2);
    const remainingAfterProjected = Math.max(0, +(balance - projectedPrincipal - prepay).toFixed(2));

    const row = {
      ...item,
      prepay,
      projectedInterest,
      projectedTotal,
      remainingAfterProjected
    };

    balance = remainingAfterProjected;
    return row;
  });
}

window.getStatus = function (row) {
  if (paidMap[row.id]) return "paid";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = window.parseDate(row.date);
  const pay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.floor((pay - today) / 86400000);

  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "planned";
};

window.getStatusLabel = function (status) {
  if (status === "paid") return "Сплачено";
  if (status === "overdue") return "Прострочено";
  if (status === "today") return "Сьогодні";
  if (status === "soon") return "Скоро";
  return "Заплановано";
};

function getStatusBadge(status) {
  if (status === "paid") return "badge-paid";
  if (status === "overdue") return "badge-overdue";
  if (status === "today") return "badge-today";
  if (status === "soon") return "badge-soon";
  return "badge-planned";
}

function getRowClass(status) {
  if (status === "paid") return "paid-row";
  if (status === "overdue") return "overdue-row";
  if (status === "today") return "current-row";
  if (status === "soon") return "soon-row";
  return "";
}

function getFilteredRows(rows) {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const unpaidOnly = document.getElementById("unpaidOnly").checked;
  const sortField = document.getElementById("sortField").value;
  const sortDirection = document.getElementById("sortDirection").value;

  const filtered = rows.filter(row => {
    const okSearch = row.date.toLowerCase().includes(search);
    const okUnpaid = unpaidOnly ? !paidMap[row.id] : true;
    return okSearch && okUnpaid;
  });

  filtered.sort((a, b) => {
    let x, y;

    if (sortField === "date") {
      x = window.parseDate(a.date).getTime();
      y = window.parseDate(b.date).getTime();
    } else {
      x = Number(a[sortField] || 0);
      y = Number(b[sortField] || 0);
    }

    return sortDirection === "asc" ? x - y : y - x;
  });

  return filtered;
}

function renderSummary(schedule) {
  const paidRows = schedule.filter(r => paidMap[r.id]);
  const paidTotal = paidRows.reduce((s, r) => s + r.projectedTotal + r.prepay, 0);
  const paidInterest = paidRows.reduce((s, r) => s + r.projectedInterest, 0);
  const paidPrincipal = paidRows.reduce((s, r) => s + r.principal + r.prepay, 0);
  const remainingPrincipal = Math.max(0, Number(window.INITIAL_AMOUNT || 0) - paidPrincipal);
  const nextPayment = schedule.find(r => !paidMap[r.id]);
  const progress = window.INITIAL_AMOUNT
    ? ((Number(window.INITIAL_AMOUNT) - remainingPrincipal) / Number(window.INITIAL_AMOUNT)) * 100
    : 0;

  const baseInterestTotal = schedule.reduce((s, r) => s + r.interest, 0);
  const forecastInterestTotal = schedule.reduce((s, r) => s + r.projectedInterest, 0);
  const savedInterest = Math.max(0, baseInterestTotal - forecastInterestTotal);

  document.getElementById("initialAmount").textContent = window.formatMoney(window.INITIAL_AMOUNT || 0);
  document.getElementById("remainingPrincipal").textContent = window.formatMoney(remainingPrincipal);
  document.getElementById("paidTotal").textContent = window.formatMoney(paidTotal);
  document.getElementById("paidPrincipal").textContent = window.formatMoney(paidPrincipal);
  document.getElementById("paidInterest").textContent = window.formatMoney(paidInterest);
  document.getElementById("paidMonths").textContent = `${paidRows.length} / ${schedule.length}`;
  document.getElementById("nextPayment").textContent = nextPayment
    ? `${nextPayment.date} • ${window.formatMoney(nextPayment.projectedTotal)}`
    : "Кредит погашено";
  document.getElementById("progressText").textContent = `${progress.toFixed(2)}%`;
  document.getElementById("progressTextTop").textContent = `${progress.toFixed(2)}%`;
  document.getElementById("progressFill").style.width = `${Math.min(progress, 100)}%`;

  document.getElementById("baseInterestTotal").textContent = window.formatMoney(baseInterestTotal);
  document.getElementById("forecastInterestTotal").textContent = window.formatMoney(forecastInterestTotal);
  document.getElementById("savedInterest").textContent = window.formatMoney(savedInterest);
  document.getElementById("prepaidTotal").textContent = window.formatMoney(window.totalPrepaid ? window.totalPrepaid(window.prepayments) : 0);
}

function renderPrepayList() {
  const el = document.getElementById("prepayList");
  if (!window.prepayments.length) {
    el.innerHTML = '<span class="muted">Ще немає дострокових платежів.</span>';
    return;
  }

  const sorted = [...window.prepayments].sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));

  el.innerHTML = sorted.map((item, index) => `
    <div class="prepay-item">
      <span>${item.date} — <strong>${window.formatMoney(item.amount)}</strong></span>
      <button class="btn btn-danger prepay-remove-btn" data-remove-prepay="${index}">Видалити</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-remove-prepay]").forEach(btn => {
    btn.addEventListener("click", e => {
      const index = Number(e.target.dataset.removePrepay);
      window.removePrepaymentByIndex(index);
    });
  });
}

function renderTable(schedule) {
  const tbody = document.getElementById("paymentsTable");
  tbody.innerHTML = "";

  getFilteredRows(schedule).forEach(row => {
    const status = window.getStatus(row);
    const tr = document.createElement("tr");
    const cls = getRowClass(status);
    if (cls) tr.classList.add(cls);

    tr.innerHTML = `
      <td><input type="checkbox" class="pay-checkbox" data-id="${row.id}" ${paidMap[row.id] ? "checked" : ""}></td>
      <td><span class="status-badge ${getStatusBadge(status)}">${window.getStatusLabel(status)}</span></td>
      <td><input type="date" class="paydate-input" data-date-id="${row.id}" value="${paymentDates[row.id] || ""}"></td>
      <td>${row.date}</td>
      <td>${window.formatMoney(row.principal)}</td>
      <td>${window.formatMoney(row.interest)}</td>
      <td>${window.formatMoney(row.projectedInterest)}</td>
      <td>${window.formatMoney(row.total)}</td>
      <td>${window.formatMoney(row.projectedTotal)}</td>
      <td>${window.formatMoney(row.remainingAfterProjected)}</td>
      <td>${row.prepay ? window.formatMoney(row.prepay) : "—"}</td>
      <td><input type="text" class="note-input" data-note-id="${row.id}" value="${notesMap[row.id] || ""}" placeholder="Нотатка..."></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".pay-checkbox").forEach(el => {
    el.addEventListener("change", e => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        paidMap[id] = true;
        if (!paymentDates[id]) paymentDates[id] = todayInput();
      } else {
        delete paidMap[id];
      }
      saveState();
      renderAll();
    });
  });

  document.querySelectorAll(".paydate-input").forEach(el => {
    el.addEventListener("change", e => {
      const id = e.target.dataset.dateId;
      paymentDates[id] = e.target.value;
      if (e.target.value) paidMap[id] = true;
      saveState();
      renderAll();
    });
  });

  document.querySelectorAll(".note-input").forEach(el => {
    el.addEventListener("input", e => {
      const id = e.target.dataset.noteId;
      notesMap[id] = e.target.value;
      saveState();
    });
  });
}

function exportCSV(schedule) {
  const header = [
    "Сплачено",
    "Статус",
    "Дата оплати",
    "Планова дата",
    "Тіло",
    "Базові %",
    "Перераховані %",
    "Базова сума",
    "Нова сума",
    "Залишок після",
    "Дострокове",
    "Нотатка"
  ];

  const lines = [header];

  schedule.forEach(row => {
    const status = window.getStatus(row);
    lines.push([
      paidMap[row.id] ? "Так" : "Ні",
      window.getStatusLabel(status),
      paymentDates[row.id] || "",
      row.date,
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.projectedInterest.toFixed(2),
      row.total.toFixed(2),
      row.projectedTotal.toFixed(2),
      row.remainingAfterProjected.toFixed(2),
      Number(row.prepay || 0).toFixed(2),
      notesMap[row.id] || ""
    ]);
  });

  const csv = lines.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")
  ).join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eoselia-tracker.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  const payload = {
    paidMap,
    paymentDates,
    notesMap,
    prepayments: window.prepayments,
    theme: localStorage.getItem(STORAGE_THEME) || "light"
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eoselia-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      paidMap = data.paidMap || {};
      paymentDates = data.paymentDates || {};
      notesMap = data.notesMap || {};
      window.prepayments = data.prepayments || [];
      saveState();
      if (window.savePrepayments) window.savePrepayments(window.prepayments);
      if (data.theme) applyTheme(data.theme);
      renderAll();
    } catch {
      alert("Не вдалося імпортувати JSON");
    }
  };
  reader.readAsText(file);
}

function markTillToday() {
  const schedule = buildProjectedSchedule();
  const now = new Date();
  schedule.forEach(r => {
    if (window.parseDate(r.date) <= now) {
      paidMap[r.id] = true;
      if (!paymentDates[r.id]) paymentDates[r.id] = todayInput();
    }
  });
  saveState();
  renderAll();
}

function resetAll() {
  if (!confirm("Скинути всі відмітки, дати, нотатки та дострокові платежі?")) return;
  paidMap = {};
  paymentDates = {};
  notesMap = {};
  window.prepayments = [];
  localStorage.removeItem(STORAGE_PAID);
  localStorage.removeItem(STORAGE_DATES);
  localStorage.removeItem(STORAGE_NOTES);
  localStorage.removeItem(window.PREPAY_STORAGE_KEY);
  renderAll();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_THEME, theme);
  document.getElementById("themeToggleBtn").textContent =
    theme === "dark" ? "☀️ Світла тема" : "🌙 Темна тема";
  document.getElementById("themeColorMeta").setAttribute("content", theme === "dark" ? "#0f1115" : "#f5f6f8");
}

function toggleTheme() {
  const current = localStorage.getItem(STORAGE_THEME) || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function addPrepayment() {
  const rawDate = document.getElementById("prepayDate").value;
  const amount = Number(document.getElementById("prepayAmount").value || 0);

  if (!rawDate || amount <= 0) {
    alert("Вкажи дату і суму дострокового платежу");
    return;
  }

  const [y, m, d] = rawDate.split("-");
  const date = `${d}/${m}/${y}`;

  window.prepayments.push({
    rawDate,
    date,
    amount
  });

  if (window.savePrepayments) window.savePrepayments(window.prepayments);

  document.getElementById("prepayDate").value = "";
  document.getElementById("prepayAmount").value = "";
  renderAll();
}

window.renderAll = function () {
  const schedule = buildProjectedSchedule();
  window.currentSchedule = schedule;
  renderSummary(schedule);
  renderPrepayList();
  renderTable(schedule);
  if (window.initCalendarSelectors) window.initCalendarSelectors(schedule);
  if (window.renderCalendar) window.renderCalendar(schedule);
};

document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
document.getElementById("markTillTodayBtn").addEventListener("click", markTillToday);
document.getElementById("exportCsvBtn").addEventListener("click", () => exportCSV(window.currentSchedule || buildProjectedSchedule()));
document.getElementById("exportJsonBtn").addEventListener("click", exportJSON);
document.getElementById("resetPaidBtn").addEventListener("click", resetAll);
document.getElementById("addPrepayBtn").addEventListener("click", addPrepayment);
document.getElementById("searchInput").addEventListener("input", window.renderAll);
document.getElementById("unpaidOnly").addEventListener("change", window.renderAll);
document.getElementById("sortField").addEventListener("change", window.renderAll);
document.getElementById("sortDirection").addEventListener("change", window.renderAll);
document.getElementById("importJsonInput").addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (file) importJSON(file);
});

applyTheme(localStorage.getItem(STORAGE_THEME) || "light");
window.renderAll();
