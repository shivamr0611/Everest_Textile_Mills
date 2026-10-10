import React, { useState, useEffect } from 'react';
import { 
  Users, DollarSign, Calendar, Download, PlusCircle, 
  CheckCircle2, AlertTriangle, ArrowRight, TrendingUp, TrendingDown 
} from 'lucide-react';
import { api } from '../api';

export default function WorkersFinance({
  workers = [],
  yarnOrders = [],
  buyerOrders = [],
  onRefresh,
  hideAttendance = false,
  readOnly = false
}) {
  const [activeTab, setActiveTab] = useState('month-end'); // 'month-end', 'attendance', 'payments', 'eod'
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyData, setMonthlyData] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Attendance state (Module I1)
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceShift, setAttendanceShift] = useState('morning');
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Payments form state (Module I2, I3, I4)
  const [payType, setPayType] = useState('wage'); // 'wage', 'supplier', 'buyer'
  const [selectedWorkerId, setSelectedWorkerId] = useState(workers[0]?.worker_id || '');
  const [wageDays, setWageDays] = useState('26');
  const [wageAmount, setWageAmount] = useState('');
  const [selectedYarnOrder, setSelectedYarnOrder] = useState(yarnOrders[0]?.order_no || '');
  const [yarnPayAmount, setYarnPayAmount] = useState('');
  const [buyerInvoiceId, setBuyerInvoiceId] = useState('');
  const [buyerPayAmount, setBuyerPayAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // EOD report state (Module E7)
  const [eodDate, setEodDate] = useState(new Date().toISOString().slice(0, 10));
  const [eodData, setEodData] = useState(null);
  const [loadingEod, setLoadingEod] = useState(false);

  useEffect(() => {
    loadMonthlyReport(currentMonth);
    loadAttendance(attendanceDate);
  }, []);

  const loadMonthlyReport = async (month) => {
    setLoadingMonth(true);
    try {
      const data = await api.getMonthlyReport(month);
      setMonthlyData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMonth(false);
    }
  };

  const loadAttendance = async (d) => {
    try {
      const data = await api.getAttendance(d);
      setAttendanceRecords(data.map(w => ({
        worker_id: w.worker_id,
        name: w.name,
        daily_wage: w.daily_wage,
        shift: attendanceShift,
        present: w.present === 1
      })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAttendance = (workerId) => {
    setAttendanceRecords(attendanceRecords.map(r => 
      r.worker_id === workerId ? { ...r, present: !r.present } : r
    ));
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    try {
      const payload = attendanceRecords.map(r => ({
        worker_id: r.worker_id,
        work_date: attendanceDate,
        shift: attendanceShift,
        present: r.present
      }));
      await api.saveAttendance(payload);
      alert("Attendance registered successfully for " + attendanceDate);
      onRefresh();
    } catch (err) {
      alert("Error saving attendance: " + err.message);
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setSubmittingPayment(true);
    try {
      if (payType === 'wage') {
        await api.payWage({
          worker_id: parseInt(selectedWorkerId),
          month_year: currentMonth,
          days_present: parseInt(wageDays),
          amount: parseFloat(wageAmount)
        });
      } else if (payType === 'supplier') {
        await api.paySupplier({
          order_no: selectedYarnOrder,
          amount: parseFloat(yarnPayAmount)
        });
      } else if (payType === 'buyer') {
        await api.payBuyer({
          invoice_id: parseInt(buyerInvoiceId),
          amount: parseFloat(buyerPayAmount)
        });
      }
      alert("Payment recorded successfully!");
      setWageAmount('');
      setYarnPayAmount('');
      setBuyerPayAmount('');
      loadMonthlyReport(currentMonth);
      onRefresh();
    } catch (err) {
      alert("Error saving payment: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const loadEodReport = async () => {
    setLoadingEod(true);
    try {
      const data = await api.getDailyReport(eodDate);
      setEodData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEod(false);
    }
  };

  return (
    <div>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'month-end' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('month-end')}
        >
          <DollarSign size={16} /> Month-End Financial Report (Module I5)
        </button>
        {!hideAttendance && !readOnly && (
          <button 
            className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('attendance')}
          >
            <Users size={16} /> Live Worker Check-In Status
          </button>
        )}
        {!readOnly && (
          <button 
            className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('payments')}
          >
            <PlusCircle size={16} /> Record Cash & Ledger Payments (Module I2-I4)
          </button>
        )}
        <button 
          className={`btn ${activeTab === 'eod' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('eod'); loadEodReport(); }}
        >
          <Download size={16} /> End-of-Day Production CSV (Module E7)
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MONTH-END FINANCIAL REPORT (Module I5)             */}
      {/* ========================================================= */}
      {activeTab === 'month-end' && (
        <div>
          {/* Month selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Financial Accounting Month:</span>
              <input 
                type="month"
                className="form-control"
                style={{ width: '170px' }}
                value={currentMonth}
                onChange={(e) => {
                  setCurrentMonth(e.target.value);
                  loadMonthlyReport(e.target.value);
                }}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Formula: Profit/Loss = Buyer Payments (In) - Wages Paid (Out) - Yarn Payments (Out)
            </div>
          </div>

          {/* Cashflow KPI summary */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="kpi-val" style={{ color: '#059669' }}>
                  ₹{(monthlyData?.money_in || 0).toLocaleString()}
                </div>
                <div className="kpi-lbl">Money In (Buyer Payments)</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Users size={24} />
              </div>
              <div>
                <div className="kpi-val" style={{ color: '#1e3a8a' }}>
                  ₹{(monthlyData?.wages_out || 0).toLocaleString()}
                </div>
                <div className="kpi-lbl">Wages Paid Out (Labor)</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <div className="kpi-val" style={{ color: '#b45309' }}>
                  ₹{(monthlyData?.yarn_out || 0).toLocaleString()}
                </div>
                <div className="kpi-lbl">Yarn Bills Paid (Suppliers)</div>
              </div>
            </div>

            <div className="kpi-card" style={{ 
              borderColor: monthlyData?.is_profit ? '#a7f3d0' : '#fecaca',
              background: monthlyData?.is_profit ? '#f0fdf4' : '#fff5f5' 
            }}>
              <div className="kpi-icon-wrap" style={{ 
                background: monthlyData?.is_profit ? '#d1fae5' : '#fee2e2', 
                color: monthlyData?.is_profit ? '#059669' : '#dc2626' 
              }}>
                {monthlyData?.is_profit ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              </div>
              <div>
                <div className="kpi-val" style={{ color: monthlyData?.is_profit ? '#059669' : '#dc2626' }}>
                  ₹{(monthlyData?.profit_loss || 0).toLocaleString()}
                </div>
                <div className="kpi-lbl">
                  {monthlyData?.is_profit ? "Net Profit This Month" : "Net Loss This Month"}
                </div>
              </div>
            </div>
          </div>

          {/* (a) Cost of each order (Yarn Cost + Allocated Wages) */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <DollarSign size={18} color="#2563eb" /> True Order Costing & Gross Margin Analysis
              </span>
              <span className="panel-subtitle">
                Yarn Cost (needed_kg × price/kg) + Allocated Labor Wages (month wages × order kg ÷ total month kg)
              </span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Fabric Spec</th>
                      <th>Quantity (kg)</th>
                      <th>Yarn Material Cost</th>
                      <th>Allocated Wage Cost</th>
                      <th>Total Order Cost</th>
                      <th>Order Revenue</th>
                      <th>Gross Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData?.order_costs?.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No orders recorded this month.
                        </td>
                      </tr>
                    ) : (
                      monthlyData?.order_costs?.map(oc => (
                        <tr key={oc.order_id}>
                          <td><strong>Order #{oc.order_id}</strong></td>
                          <td>{oc.customer_name}</td>
                          <td>{oc.fabric}</td>
                          <td>{oc.quantity_kg} kg</td>
                          <td>₹{oc.yarn_cost.toLocaleString()}</td>
                          <td>₹{oc.allocated_wages.toLocaleString()}</td>
                          <td style={{ fontWeight: 600, color: '#1e3a8a' }}>₹{oc.total_cost.toLocaleString()}</td>
                          <td style={{ fontWeight: 600 }}>₹{oc.revenue.toLocaleString()}</td>
                          <td style={{ fontWeight: 700, color: oc.margin >= 0 ? '#059669' : '#dc2626' }}>
                            ₹{oc.margin.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* (b) kg produced by every machine in the month */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Users size={18} color="#2563eb" /> Monthly Machine Production Breakdown (kg)
              </span>
              <span className="panel-subtitle">Total output across all stages this month</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Machine Name</th>
                      <th>Stage Type</th>
                      <th>Total Output (kg)</th>
                      <th>Contribution %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData?.machine_output?.map((mo, idx) => {
                      const totalMonth = monthlyData?.total_kg_month || 1;
                      const pct = Math.round((mo.kg / totalMonth) * 100);
                      return (
                        <tr key={idx}>
                          <td><strong>{mo.machine_name}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{mo.stage}</td>
                          <td><strong>{mo.kg} kg</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="progress-bar-container" style={{ width: '100px' }}>
                                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LIVE WORKER CHECK-IN STATUS                        */}
      {/* ========================================================= */}
      {activeTab === 'attendance' && (
        <div className="card-panel">
          <div className="panel-header">
            <div>
              <span className="panel-title">
                <Users size={18} color="#2563eb" /> Live Worker Check-In &amp; Attendance Status
              </span>
              <div className="panel-subtitle">Automatically updated when workers check in and check out from their portals</div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input 
                type="date"
                className="form-control"
                style={{ width: '160px', fontSize: '0.82rem' }}
                value={attendanceDate}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  loadAttendance(e.target.value);
                }}
              />
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker Name</th>
                    <th>Role</th>
                    <th>Daily Wage (₹/day)</th>
                    <th>Check-In Time</th>
                    <th>Check-Out Time</th>
                    <th>Live Attendance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                        No worker records found for {attendanceDate}.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map(r => (
                      <tr key={r.worker_id} style={{ background: r.present ? '#f0fdf4' : '#fff5f5' }}>
                        <td><strong>{r.name}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{r.role || 'Production Worker'}</td>
                        <td>₹{r.daily_wage}</td>
                        <td style={{ fontSize: '0.8rem', color: r.check_in_time ? '#059669' : '#94a3b8' }}>
                          {r.check_in_time ? r.check_in_time.slice(11) : '—'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: r.check_out_time ? '#dc2626' : '#94a3b8' }}>
                          {r.check_out_time ? r.check_out_time.slice(11) : '—'}
                        </td>
                        <td>
                          {r.live_status === 'Checked In' ? (
                            <span className="badge badge-green"><CheckCircle2 size={12} /> Checked In</span>
                          ) : r.live_status === 'Checked Out' ? (
                            <span className="badge badge-blue">Checked Out</span>
                          ) : (
                            <span className="badge badge-red">Not Checked In</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: RECORD PAYMENTS (Module I2, I3, I4)                */}
      {/* ========================================================= */}
      {activeTab === 'payments' && (
        <div className="card-panel">
          <div className="panel-header">
            <span className="panel-title">
              <PlusCircle size={18} color="#2563eb" /> Module I2-I4: Cash & Ledger Payments
            </span>
            <span className="panel-subtitle">Record wage disbursements, supplier yarn payments, and buyer remittances</span>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button 
                className={`btn ${payType === 'wage' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayType('wage')}
              >
                1. Worker Wage Disbursement (Module I2)
              </button>
              <button 
                className={`btn ${payType === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayType('supplier')}
              >
                2. Supplier Yarn Bill Payment (Module I3)
              </button>
              <button 
                className={`btn ${payType === 'buyer' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPayType('buyer')}
              >
                3. Buyer Invoice Receipt (Module I4)
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              {payType === 'wage' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Worker *</label>
                    <select 
                      className="form-control"
                      value={selectedWorkerId}
                      onChange={(e) => {
                        setSelectedWorkerId(e.target.value);
                        const w = workers.find(wk => String(wk.worker_id) === e.target.value);
                        if (w) setWageAmount(w.daily_wage * parseInt(wageDays || 26));
                      }}
                      required
                    >
                      {workers.map(w => (
                        <option key={w.worker_id} value={w.worker_id}>
                          {w.name} (₹{w.daily_wage}/day)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Days Present in Month *</label>
                    <input 
                      type="number"
                      min="1"
                      max="31"
                      className="form-control"
                      value={wageDays}
                      onChange={(e) => {
                        setWageDays(e.target.value);
                        const w = workers.find(wk => String(wk.worker_id) === String(selectedWorkerId));
                        if (w) setWageAmount(w.daily_wage * parseInt(e.target.value || 0));
                      }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Wage Amount (₹) *</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={wageAmount}
                      onChange={(e) => setWageAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {payType === 'supplier' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Yarn Order Number *</label>
                    <select 
                      className="form-control"
                      value={selectedYarnOrder}
                      onChange={(e) => {
                        setSelectedYarnOrder(e.target.value);
                        const yo = yarnOrders.find(o => o.order_no === e.target.value);
                        if (yo) setYarnPayAmount(yo.quantity * yo.price_per_kg);
                      }}
                      required
                    >
                      {yarnOrders.map(yo => (
                        <option key={yo.order_no} value={yo.order_no}>
                          {yo.order_no} · {yo.supplier_name} (₹{yo.quantity * yo.price_per_kg})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Amount (₹) *</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={yarnPayAmount}
                      onChange={(e) => setYarnPayAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {payType === 'buyer' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Invoice ID *</label>
                    <input 
                      type="number"
                      className="form-control"
                      placeholder="e.g. 1"
                      value={buyerInvoiceId}
                      onChange={(e) => setBuyerInvoiceId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount Received from Buyer (₹) *</label>
                    <input 
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 110000.00"
                      value={buyerPayAmount}
                      onChange={(e) => setBuyerPayAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submittingPayment}>
                  {submittingPayment ? 'Recording Payment...' : 'Record Ledger Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: END-OF-DAY REPORT & CSV (Module E7)                */}
      {/* ========================================================= */}
      {activeTab === 'eod' && (
        <div className="card-panel">
          <div className="panel-header">
            <div>
              <span className="panel-title">
                <Download size={18} color="#2563eb" /> Module E7: End-of-Day Production Report
              </span>
              <div className="panel-subtitle">Total kg produced today, kg per machine, per order, per shift with CSV download</div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input 
                type="date"
                className="form-control"
                style={{ width: '160px', fontSize: '0.82rem' }}
                value={eodDate}
                onChange={(e) => {
                  setEodDate(e.target.value);
                  loadEodReport();
                }}
              />
              <a 
                href={`/api/reports/daily?date=${eodDate}&download=true`}
                className="btn btn-primary"
                download
              >
                <Download size={14} /> Download EOD CSV
              </a>
            </div>
          </div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Daily Tally ({eodDate})</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f2744' }}>
                  {(eodData?.total_kg || 0).toLocaleString()} kg
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Finished Fabric Passed Through Machines</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
                  Output Breakdown per Machine
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                  {eodData?.machine_breakdown?.map((mb, idx) => (
                    <div key={idx} style={{ background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{mb.machine_name}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>{mb.kg} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
              Individual Floor Logs for {eodDate}
            </div>
            <div className="table-responsive">
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Time</th>
                    <th>Machine</th>
                    <th>Stage</th>
                    <th>Shift</th>
                    <th>Worker</th>
                    <th>Order #</th>
                    <th>Output (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {eodData?.logs?.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                        No production logs recorded on this date yet.
                      </td>
                    </tr>
                  ) : (
                    eodData?.logs?.map(l => (
                      <tr key={l.log_id}>
                        <td>#{l.log_id}</td>
                        <td style={{ color: '#64748b' }}>{l.logged_at}</td>
                        <td><strong>{l.machine_name}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{l.stage}</td>
                        <td style={{ textTransform: 'capitalize' }}>{l.shift}</td>
                        <td>{l.worker_name || '—'}</td>
                        <td>Order #{l.order_id}</td>
                        <td><strong>{l.kg_produced} kg</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
