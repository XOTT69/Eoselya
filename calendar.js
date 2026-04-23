window.initCalendarSelectors = function (schedule) {
  const monthSel = document.getElementById("calendarMonth");
  const yearSel = document.getElementById("calendarYear");
  if (!monthSel || !yearSel) return;

  if (monthSel.dataset.ready === "1") return;

  const months = [
    "Січень","Лютий","Березень","Квітень","Травень","Червень",
    "Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"
  ];

  monthSel.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join("");

  const years = [...new Set(schedule.map(item => {
    const d = window.parseDate(item.date);
    return d.getFullYear();
  }))];

  yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");

  const now = new Date();
  monthSel.value = String(now.getMonth());
  if (years.includes(now.getFullYear())) {
    yearSel.value = String(now.getFullYear());
  } else if (years.length) {
    yearSel.value = String(years[0]);
  }

  monthSel.dataset.ready = "1";

  monthSel.addEventListener("change", () => window.renderCalendar(window.currentSchedule || []));
  yearSel.addEventListener("change", () => window.renderCalendar(window.currentSchedule || []));
};

window.renderCalendar = function (schedule) {
  const grid = document.getElementById("calendarGrid");
  const monthSel = document.getElementById("calendarMonth");
  const yearSel = document.getElementById("calendarYear");
  if (!grid || !monthSel || !yearSel) return;

  const month = Number(monthSel.value);
  const year = Number(yearSel.value);

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  grid.innerHTML = weekDays.map(d => `<div class="weekday">${d}</div>`).join("");

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  let start = firstDay.getDay();
  start = start === 0 ? 6 : start - 1;

  for (let i = 0; i < start; i++) {
    grid.innerHTML += `<div class="calendar-day empty"></div>`;
  }

  for (let day = 1; day <= lastDate; day++) {
    const current = new Date(year, month, day);
    const found = schedule.find(item => {
      const d = window.parseDate(item.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

    if (!found) {
      grid.innerHTML += `
        <div class="calendar-day">
          <div class="day-num">${day}</div>
          <div class="day-text muted">—</div>
        </div>
      `;
      continue;
    }

    const status = window.getStatus(found);
    const cls =
      status === "paid" ? "status-paid" :
      status === "overdue" ? "status-overdue" :
      status === "today" ? "status-today" :
      status === "soon" ? "status-soon" : "status-planned";

    grid.innerHTML += `
      <div class="calendar-day ${cls}">
        <div class="day-num">${day}</div>
        <div class="day-text">${window.formatMoney(found.projectedTotal)}
${window.getStatusLabel(status)}</div>
      </div>
    `;
  }
};
