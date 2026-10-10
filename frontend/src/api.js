// Central API client

const BASE_URL = "/api";

export async function fetchJson(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth & Reference
  login: (email, password) => fetchJson("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (data) => fetchJson("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getUsers: (role) => fetchJson(`/users${role ? `?role=${role}` : ""}`),
  getColours: () => fetchJson("/colours"),
  getYarnTypes: () => fetchJson("/yarn-types"),

  // Module B: Yarn orders
  getYarnOrders: (supplier_id) => fetchJson(`/yarn-orders${supplier_id ? `?supplier_id=${supplier_id}` : ""}`),
  createYarnOrder: (data) => fetchJson("/yarn-orders", { method: "POST", body: JSON.stringify(data) }),
  payYarnOrder: (order_no, amount) => fetchJson(`/yarn-orders/${order_no}/pay`, { method: "POST", body: JSON.stringify({ amount }) }),

  // Module C: Gate entry (4 inputs)
  submitGateEntry: (data) => fetchJson("/gate-entry", { method: "POST", body: JSON.stringify(data) }),

  // Module D: Stock & Alerts
  getStock: () => fetchJson("/stock"),
  getStockAlerts: () => fetchJson("/stock/alerts"),

  // Module G & D: Buyer orders
  getBuyerOrders: () => fetchJson("/orders"),
  getMyOrders: (customer_id) => fetchJson(`/orders/my?customer_id=${customer_id}`),
  placeBuyerOrder: (data) => fetchJson("/orders", { method: "POST", body: JSON.stringify(data) }),
  checkOrderYarn: (order_id) => fetchJson(`/orders/${order_id}/yarn-check`),
  payOrder: (order_id) => fetchJson(`/orders/${order_id}/pay`, { method: "POST" }),
  confirmReceivedOrder: (order_id) => fetchJson(`/orders/${order_id}/confirm-received`, { method: "POST" }),
  assignJobWorker: (job_id, worker_id) => fetchJson(`/production-jobs/${job_id}/assign`, { method: "PATCH", body: JSON.stringify({ worker_id }) }),

  // Module E & J: Factory status & Machines
  getFactoryStatus: () => fetchJson("/factory-status"),
  getMachines: () => fetchJson("/machines"),
  getMachineDetail: (id) => fetchJson(`/machines/${id}`),
  addMachine: (data) => fetchJson("/machines", { method: "POST", body: JSON.stringify(data) }),
  updateMachineStatus: (id, status) => fetchJson(`/machines/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  removeMachine: (id, reason) => fetchJson(`/machines/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  getRemovedMachines: () => fetchJson("/machines/removed"),

  // Production logging
  logProduction: (data) => fetchJson("/production-log", { method: "POST", body: JSON.stringify(data) }),

  // Module F: QC & Rolls
  getRolls: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetchJson(`/rolls${q ? `?${q}` : ""}`);
  },
  submitQC: (data) => fetchJson("/qc", { method: "POST", body: JSON.stringify(data) }),
  getQCDefectSummary: () => fetchJson("/qc/defect-summary"),

  // Module H: Finished goods & Dispatch
  getStore: () => fetchJson("/store"),
  getDispatchReadyOrders: () => fetchJson("/dispatch/ready-orders"),
  createDispatch: (data) => fetchJson("/dispatch", { method: "POST", body: JSON.stringify(data) }),
  getInvoice: (id) => fetchJson(`/invoices/${id}`),
  getInvoices: () => fetchJson("/invoices"),

  // Module I: Workers, Wages, Finance
  getWorkers: () => fetchJson("/workers"),
  addWorker: (data) => fetchJson("/workers", { method: "POST", body: JSON.stringify(data) }),
  getAttendance: (work_date) => fetchJson(`/attendance?work_date=${work_date}`),
  saveAttendance: (records) => fetchJson("/attendance", { method: "POST", body: JSON.stringify({ records }) }),
  payWage: (data) => fetchJson("/payments/wage", { method: "POST", body: JSON.stringify(data) }),
  paySupplier: (data) => fetchJson("/payments/supplier", { method: "POST", body: JSON.stringify(data) }),
  payBuyer: (data) => fetchJson("/payments/buyer", { method: "POST", body: JSON.stringify(data) }),
  getMonthlyReport: (month) => fetchJson(`/reports/monthly?month=${month}`),
  getDailyReport: (date) => fetchJson(`/reports/daily?date=${date}`)
};
