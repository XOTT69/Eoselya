const STORAGE_PAID = "eoselia_paid_firststyle";
const STORAGE_DATES = "eoselia_dates_firststyle";
const STORAGE_NOTES = "eoselia_notes_firststyle";
const STORAGE_THEME = "eoselia_theme_firststyle";

let paidMap = JSON.parse(localStorage.getItem(STORAGE_PAID) || "{}");
let paymentDates = JSON.parse(localStorage.getItem(STORAGE_DATES) || "{}");
let notesMap = JSON.parse(localStorage.getItem(STORAGE_NOTES) || "{}");

function formatMoney(v) {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(v || 0)) + " грн";
}

function parseDate(str) {
  if (!str || typeof str !== "string") return new Date(0);
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function todayInput() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function saveState() {
  localStorage.setItem(STORAGE_PAID, JSON.stringify(paidMap));
  localStorage.setItem(STORAGE_DATES, JSON.stringify(paymentDates));
  localStorage.setItem(STORAGE_NOTES, JSON.stringify(notesMap));
}

function getPaymentsSafe() {
  if (!Array.isArray(window.PAYMENTS)) return [];
  return window.PAYMENTS.filter(item =>
    item &&
    typeof item.date === "string" &&
    typeof item.principal !== "undefined" &&
    typeof item.interest !== "undefined" &&
    typeof item.total !== "undefined"
  );
}

function buildRows() {
  const source = getPaymentsSafe();
  let remaining = Number(window.INITIAL_AMOUNT || 0);

  return source.map((p, i) => {
    const principal = Number(p.principal || 0);
    const interest = Number(p.interest || 0);
    const total = Number(p.total || 0);

    remaining = +(remaining - principal).toFixed(2);

    return {
      id: i,
      date: p.date,
      principal,
      interest,
      total,
      remainingAfter: Math.max(remaining, 0)
    };
  });
}

function getStatus(row) {
  if (paidMap[row.id]) return "paid";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const payDate = parseDate(row.date);
  const pay = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate()).getTime();
  const diff = Math.floor((pay - today) / 86400000);

  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "planned";
}

function getStatusLabel(status) {
  if (status === "paid") return "Сплачено";
  if (status === "overdue") return "Прострочено";
  if (status === "today") return "Сьогодні";
  if (status === "soon") return "Скоро";
  return "Заплановано";
}

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
  const searchEl = document.getElementById("searchInput");
  const unpaidOnlyEl = document.getElementById("unpaidOnly");
  const sortFieldEl = document.getElementById("sortField");
  const sortDirectionEl = document.getElementById("sortDirection");

  const search = (searchEl?.value || "").trim().toLowerCase();
  const unpaidOnly = !!unpaidOnlyEl?.checked;
  const sortField = sortFieldEl?.value || "date";
  const sortDirection = sortDirectionEl?.value || "asc";

  const filtered = rows.filter(row => {
    const okSearch = row.date.toLowerCase().includes(search);
    const okUnpaid = unpaidOnly ? !paidMap[row.id] : true;
    return okSearch && okUnpaid;
  });

  filtered.sort((a, b) => {
    let x, y;

    if (sortField === "date") {
      x = parseDate(a.date).getTime();
      y = parseDate(b.date).getTime();
    } else {
      x = Number(a[sortField] || 0);
      y = Number(b[sortField] || 0);
    }

    return sortDirection === "asc" ? x - y : y - x;
  });

  return filtered;
}

function renderSummary(rows) {
  const paidRows = rows.filter(r => paidMap[r.id]);
  const paidTotal = paidRows.reduce((s, r) => s + r.total, 0);
  const paidInterest = paidRows.reduce((s, r) => s + r.interest, 0);
  const paidPrincipal = paidRows.reduce((s, r) => s + r.principal, 0);
  const remainingPrincipal = Math.max(0, Number(window.INITIAL_AMOUNT || 0) - paidPrincipal);
  const nextPayment = rows.find(r => !paidMap[r.id]);
  const progress = window.INITIAL_AMOUNT
    ? ((Number(window.INITIAL_AMOUNT) - remainingPrincipal) / Number(window.INITIAL_AMOUNT)) * 100
    : 0;

  document.getElementById("initialAmount").textContent = formatMoney(window.INITIAL_AMOUNT || 0);
  document.getElementById("remainingPrincipal").textContent = formatMoney(remainingPrincipal);
  document.getElementById("paidTotal").textContent = formatMoney(paidTotal);
  document.getElementById("paidPrincipal").textContent = formatMoney(paidPrincipal);
  document.getElementById("paidInterest").textContent = formatMoney(paidInterest);
  document.getElementById("paidMonths").textContent = `${paidRows.length} / ${rows.length}`;
  document.getElementById("nextPayment").textContent = nextPayment
    ? `${nextPayment.date} • ${formatMoney(nextPayment.total)}`
    : "Кредит погашено";
  document.getElementById("progressText").textContent = `${progress.toFixed(2)}%`;
  document.getElementById("progressTextTop").textContent = `${progress.toFixed(2)}%`;
  document.getElementById("progressFill").style.width = `${Math.min(progress, 100)}%`;
}

function renderTable(rows) {
  const tbody = document.getElementById("paymentsTable");
  tbody.innerHTML = "";

  const filteredRows = getFilteredRows(rows);

  filteredRows.forEach(row => {
    const status = getStatus(row);
    const tr = document.createElement("tr");
    const cls = getRowClass(status);
    if (cls) tr.classList.add(cls);

    tr.innerHTML = `
      <td><input type="checkbox" class="pay-checkbox" data-id="${row.id}" ${paidMap[row.id] ? "checked" : ""}></td>
      <td><span class="status-badge ${getStatusBadge(status)}">${getStatusLabel(status)}</span></td>
      <td><input type="date" class="paydate-input" data-date-id="${row.id}" value="${paymentDates[row.id] || ""}"></td>
      <td>${row.date}</td>
      <td>${formatMoney(row.principal)}</td>
      <td>${formatMoney(row.interest)}</td>
      <td>${formatMoney(row.total)}</td>
      <td>${formatMoney(row.remainingAfter)}</td>
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
      render();
    });
  });

  document.querySelectorAll(".paydate-input").forEach(el => {
    el.addEventListener("change", e => {
      const id = e.target.dataset.dateId;
      paymentDates[id] = e.target.value;
      if (e.target.value) paidMap[id] = true;
      saveState();
      render();
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

function exportCSV(rows) {
  const header = [
    "Сплачено",
    "Статус",
    "Дата оплати",
    "Планова дата",
    "Тіло",
    "Відсотки",
    "Сума",
    "Залишок після",
    "Нотатка"
  ];

  const lines = [header];

  rows.forEach(row => {
    const status = getStatus(row);
    lines.push([
      paidMap[row.id] ? "Так" : "Ні",
      getStatusLabel(status),
      paymentDates[row.id] || "",
      row.date,
      row.principal.toFixed(2),
      row.interest.toFixed(2),
      row.total.toFixed(2),
      row.remainingAfter.toFixed(2),
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

function markTillToday() {
  const rows = buildRows();
  const now = new Date();

  rows.forEach(r => {
    if (parseDate(r.date) <= now) {
      paidMap[r.id] = true;
      if (!paymentDates[r.id]) paymentDates[r.id] = todayInput();
    }
  });

  saveState();
  render();
}

function resetAll() {
  if (!confirm("Скинути всі відмітки, дати та нотатки?")) return;
  paidMap = {};
  paymentDates = {};
  notesMap = {};
  localStorage.removeItem(STORAGE_PAID);
  localStorage.removeItem(STORAGE_DATES);
  localStorage.removeItem(STORAGE_NOTES);
  render();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_THEME, theme);
  document.getElementById("themeToggleBtn").textContent =
    theme === "dark" ? "☀️ Світла тема" : "🌙 Темна тема";

  const meta = document.getElementById("themeColorMeta");
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0f1115" : "#f5f6f8");
  }
}

function toggleTheme() {
  const current = localStorage.getItem(STORAGE_THEME) || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function render() {
  const rows = buildRows();
  renderSummary(rows);
  renderTable(rows);
}

function init() {
  document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);
  document.getElementById("markTillTodayBtn")?.addEventListener("click", markTillToday);
  document.getElementById("exportCsvBtn")?.addEventListener("click", () => exportCSV(buildRows()));
  document.getElementById("resetPaidBtn")?.addEventListener("click", resetAll);
  document.getElementById("searchInput")?.addEventListener("input", render);
  document.getElementById("unpaidOnly")?.addEventListener("change", render);
  document.getElementById("sortField")?.addEventListener("change", render);
  document.getElementById("sortDirection")?.addEventListener("change", render);

  applyTheme(localStorage.getItem(STORAGE_THEME) || "light");
  render();
}

init();
