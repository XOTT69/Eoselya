const STORAGE_PAID = "eoselia_paid_modern";
const STORAGE_DATES = "eoselia_dates_modern";
const STORAGE_NOTES = "eoselia_notes_modern";
const STORAGE_THEME = "eoselia_theme_modern";

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
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
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

function buildRows() {
  let remaining = INITIAL_AMOUNT;
  return PAYMENTS.map((p, i) => {
    remaining = +(remaining - p.principal).toFixed(2);
    return { ...p, id: i, remainingAfter: Math.max(remaining, 0) };
  });
}

function getStatus(row) {
  if (paidMap[row.id]) return "paid";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const pay = new Date(parseDate(row.date).getFullYear(), parseDate(row.date).getMonth(), parseDate(row.date).getDate()).getTime();
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
  if (status === "today") return "today-row";
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
      x = parseDate(a.date).getTime();
      y = parseDate(b.date).getTime();
    } else {
      x = a[sortField];
      y = b[sortField];
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
  const remainingPrincipal = Math.max(0, INITIAL_AMOUNT - paidPrincipal);
  const nextUnpaid = rows.find(r => !paidMap[r.id]);
  const progress = ((INITIAL_AMOUNT - remainingPrincipal) / INITIAL_AMOUNT) * 100;

  document.getElementById("initialAmount").textContent = formatMoney(INITIAL_AMOUNT);
  document.getElementById("remainingPrincipal").textContent = formatMoney(remainingPrincipal);
  document.getElementById("paidTotal").textContent = formatMoney(paidTotal);
  document.getElementById("paidInterest").textContent = formatMoney(paidInterest);
  document.getElementById("statusSummary").textContent = nextUnpaid ? getStatusLabel(getStatus(nextUnpaid)) : "Закрито";
  document.getElementById("nextPaymentInfo").textContent = nextUnpaid ? `${nextUnpaid.date} • ${formatMoney(nextUnpaid.total)}` : "Немає";
  document.getElementById("paidMonthsInfo").textContent = `${paidRows.length} / ${rows.length}`;
  document.getElementById("progressInfo").textContent = `${progress.toFixed(2)}%`;
  document.getElementById("progressPercent").textContent = `${progress.toFixed(2)}%`;
  document.getElementById("progressFill").style.width = `${Math.min(progress, 100)}%`;
}

function renderTable(rows) {
  const tbody = document.getElementById("tbody");
  tbody.innerHTML = "";

  const filtered = getFilteredRows(rows);

  filtered.forEach(row => {
    const status = getStatus(row);
    const tr = document.createElement("tr");
    const cls = getRowClass(status);
    if (cls) tr.classList.add(cls);

    tr.innerHTML = `
      <td><input type="checkbox" data-id="${row.id}" ${paidMap[row.id] ? "checked" : ""}></td>
      <td><span class="status-badge ${getStatusBadge(status)}">${getStatusLabel(status)}</span></td>
      <td><input type="date" data-date-id="${row.id}" value="${paymentDates[row.id] || ""}"></td>
      <td>${row.date}</td>
      <td>${formatMoney(row.principal)}</td>
      <td>${formatMoney(row.interest)}</td>
      <td>${formatMoney(row.total)}</td>
      <td>${formatMoney(row.remainingAfter)}</td>
      <td><input class="note-input" type="text" data-note-id="${row.id}" value="${notesMap[row.id] || ""}" placeholder="Нотатка"></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('input[type="checkbox"][data-id]').forEach(el => {
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

  document.querySelectorAll('input[type="date"][data-date-id]').forEach(el => {
    el.addEventListener("change", e => {
      const id = e.target.dataset.dateId;
      paymentDates[id] = e.target.value;
      if (e.target.value) paidMap[id] = true;
      saveState();
      render();
    });
  });

  document.querySelectorAll('input[type="text"][data-note-id]').forEach(el => {
    el.addEventListener("input", e => {
      const id = e.target.dataset.noteId;
      notesMap[id] = e.target.value;
      saveState();
    });
  });
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
  if (!confirm("Скинути всі відмітки, дати й нотатки?")) return;
  paidMap = {};
  paymentDates = {};
  notesMap = {};
  localStorage.removeItem(STORAGE_PAID);
  localStorage.removeItem(STORAGE_DATES);
  localStorage.removeItem(STORAGE_NOTES);
  render();
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
  a.download = "eoselia-dashboard.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem(STORAGE_THEME, theme);
}

function toggleTheme() {
  const current = localStorage.getItem(STORAGE_THEME) || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}

function render() {
  const rows = buildRows();
  renderSummary(rows);
  renderTable(rows);
}

document.getElementById("markTodayBtn").addEventListener("click", markTillToday);
document.getElementById("resetBtn").addEventListener("click", resetAll);
document.getElementById("exportCsvBtn").addEventListener("click", () => exportCSV(buildRows()));
document.getElementById("themeBtn").addEventListener("click", toggleTheme);
document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("unpaidOnly").addEventListener("change", render);
document.getElementById("sortField").addEventListener("change", render);
document.getElementById("sortDirection").addEventListener("change", render);

applyTheme(localStorage.getItem(STORAGE_THEME) || "dark");
render();
