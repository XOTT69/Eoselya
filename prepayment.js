window.PREPAY_STORAGE_KEY = "eoselia_prepayments_v1";

window.loadPrepayments = function () {
  try {
    return JSON.parse(localStorage.getItem(window.PREPAY_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

window.savePrepayments = function (list) {
  localStorage.setItem(window.PREPAY_STORAGE_KEY, JSON.stringify(list));
};

window.getPrepaySumByDate = function (dateStr, prepayments) {
  return prepayments
    .filter(item => item.date === dateStr)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
};

window.totalPrepaid = function (prepayments) {
  return prepayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
};

window.removePrepaymentByIndex = function (index) {
  if (!Array.isArray(window.prepayments)) return;
  window.prepayments.splice(index, 1);
  window.savePrepayments(window.prepayments);
  if (typeof window.renderAll === "function") window.renderAll();
};
