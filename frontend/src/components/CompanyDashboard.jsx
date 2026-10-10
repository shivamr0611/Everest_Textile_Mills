import React, { useState } from 'react';
import { 
  AlertTriangle, CheckCircle2, Activity, Package, DollarSign, 
  ArrowRight, Cpu, Layers, Truck, ClipboardList, ShieldAlert,
  ShoppingCart, Clock, Eye, Shield, Users, TrendingUp, CreditCard
} from 'lucide-react';
import { api } from '../api';

export default function CompanyDashboard({ 
  factoryData = {}, 
  stockAlerts = [], 
  storeData = {}, 
  financeData = null, 
  buyerOrders = [],
  yarnOrders = [],
  readOnly = false,
  onNavigate,
  onOpenOrderShortfall,
  onRefresh
}) {
  const machines = factoryData?.all_machines || [];
  const runningCount = factoryData?.running_machines?.length || 0;
  const idleCount = factoryData?.idle_machines?.length || 0;
  const kgToday = factoryData?.kg_today_total || 0;
  const shelfKg = storeData?.total_shelf_kg || 0;

  const [orderFilter, setOrderFilter] = useState('ALL');
  const [payingOrderNo, setPayingOrderNo] = useState(null);

  const handlePaySupplier = async (orderNo, amount) => {
    if (!window.confirm(`Confirm payment of ₹${Number(amount).toLocaleString()} to supplier for yarn order ${orderNo}?`)) return;
    setPayingOrderNo(orderNo);
    try {
      await api.payYarnOrder(orderNo, amount);
      alert(`Supplier payment of ₹${Number(amount).toLocaleString()} recorded successfully for order ${orderNo}!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Error recording supplier payment: " + err.message);
    } finally {
      setPayingOrderNo(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'placed':
        return <span className="badge badge-yellow">Order Placed</span>;
      case 'awaiting_yarn':
        return <span className="badge badge-red"><AlertTriangle size={12} /> Awaiting Yarn</span>;
      case 'in_queue':
        return <span className="badge badge-purple"><Clock size={12} /> In FIFO Queue</span>;
      case 'fabrication':
      case 'spinning':
      case 'weaving':
      case 'dyeing':
        return <span className="badge badge-blue">Fabrication</span>;
      case 'quality_check':
        return <span className="badge badge-yellow">Quality Check</span>;
      case 'ready_to_ship':
        return <span className="badge badge-green"><CheckCircle2 size={12} /> Ready to Ship</span>;
      case 'dispatched':
        return <span className="badge badge-navy">Dispatched</span>;
      default:
        return <span className="badge badge-blue">{status}</span>;
    }
  };

  const filteredBuyerOrders = buyerOrders.filter(o => {
    if (orderFilter === 'ALL') return true;
    if (orderFilter === 'paid') return o.payment_status === 'paid';
    if (orderFilter === 'unpaid') return o.payment_status !== 'paid';
    if (orderFilter === 'received') return o.is_received === 1;
    return o.status === orderFilter;
  });

  return (
    <div>
      {/* Read-Only Notice for Admin */}
      {readOnly && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderLeft: '4px solid #1e3a8a',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: '#0f2744'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Shield size={18} color="#1e3a8a" />
            <div>
              <strong>Executive Overview (Read-Only Mode):</strong> You have complete visibility into all incoming customer orders, customer payment receipts, supplier yarn bills, mill production, finished stock, and finance across Everest Textile Mills.
            </div>
          </div>
          <span className="badge badge-navy" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Auditor View
          </span>
        </div>
      )}

      {/* Low-stock warning banner (Module D2) */}
      {stockAlerts && stockAlerts.length > 0 && (
        <div className="alert-banner alert-danger">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Low-Stock Warning:</strong> {stockAlerts.length} raw yarn item(s) are at or below reorder level!
              <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', opacity: 0.9 }}>
                ({stockAlerts.map(s => `${s.type_name} ${s.colour_name}: ${s.free_kg} kg left`).slice(0, 3).join(', ')}{stockAlerts.length > 3 ? '...' : ''})
              </span>
            </div>
          </div>
          <button 
            className="btn btn-sm btn-danger"
            onClick={() => onNavigate && onNavigate('yarn', 'stock')}
            style={{ background: '#991b1b', color: '#ffffff' }}
          >
            Review Stock {readOnly ? 'Details' : '& Order'} <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="kpi-val">{kgToday.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>kg</span></div>
            <div className="kpi-lbl">Fabric Produced Today</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Cpu size={24} />
          </div>
          <div>
            <div className="kpi-val">{runningCount} / {machines.length}</div>
            <div className="kpi-lbl">Machines Active ({idleCount} Idle)</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Package size={24} />
          </div>
          <div>
            <div className="kpi-val">{shelfKg.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>kg</span></div>
            <div className="kpi-lbl">Finished Goods On Shelf</div>
          </div>
        </div>

        {/* Customer Revenue In */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <div className="kpi-val" style={{ color: '#16a34a' }}>
              ₹{(financeData?.money_in || 0).toLocaleString()}
            </div>
            <div className="kpi-lbl">Customer Payments Received</div>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ 
            background: financeData?.is_profit ? '#ecfdf5' : '#fef2f2', 
            color: financeData?.is_profit ? '#059669' : '#dc2626' 
          }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div className="kpi-val" style={{ color: financeData?.is_profit ? '#059669' : '#dc2626' }}>
              ₹{(financeData?.profit_loss || 0).toLocaleString()}
            </div>
            <div className="kpi-lbl">
              Net Profit / Loss ({financeData?.month || 'This Month'})
            </div>
          </div>
        </div>
      </div>

      {/* Customer Orders Live Stream Table */}
      <div className="card-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <div>
            <span className="panel-title">
              <ShoppingCart size={18} color="#2563eb" /> Customer Buyer Orders Stream ({buyerOrders.length})
            </span>
            <div className="panel-subtitle">Real-time status of orders, customer payments, and deliveries</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-control"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', width: 'auto' }}
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
            >
              <option value="ALL">All Statuses ({buyerOrders.length})</option>
              <option value="paid">✓ Customer Paid ({buyerOrders.filter(o => o.payment_status === 'paid').length})</option>
              <option value="unpaid">⚠ Payment Unpaid ({buyerOrders.filter(o => o.payment_status !== 'paid').length})</option>
              <option value="received">✓ Order Received by Buyer ({buyerOrders.filter(o => o.is_received === 1).length})</option>
              <option value="placed">Order Placed</option>
              <option value="awaiting_yarn">Awaiting Yarn</option>
              <option value="in_queue">In FIFO Queue</option>
              <option value="fabrication">Fabrication Floor</option>
              <option value="quality_check">Quality Check</option>
              <option value="ready_to_ship">Ready to Ship</option>
              <option value="dispatched">Dispatched</option>
            </select>
            {onNavigate && (
              <button className="btn btn-outline-blue btn-sm" onClick={() => onNavigate('orders')}>
                Full Orders View <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer (Buyer)</th>
                  <th>Fabric &amp; Pantone</th>
                  <th>Quantity (kg)</th>
                  <th>Total Value (₹)</th>
                  <th>Customer Payment</th>
                  <th>Buyer Receipt</th>
                  <th>Deadline</th>
                  <th>Production Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuyerOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No orders found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredBuyerOrders.map(o => {
                    const isPaid = o.payment_status === 'paid';
                    const isReceived = o.is_received === 1;
                    const orderVal = o.total_amount || ((o.quantity_kg || 0) * (o.price_per_kg || 0));

                    return (
                      <tr key={o.order_id}>
                        <td><strong>#{o.order_id}</strong></td>
                        <td>
                          <strong>{o.customer_name}</strong>
                        </td>
                        <td>
                          <span className="color-chip" style={{ backgroundColor: o.hex_value || '#ccc' }} />
                          {o.type_name} ({o.colour_name})
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{o.pantone_code}</div>
                        </td>
                        <td><strong>{o.quantity_kg} kg</strong></td>
                        <td>
                          <strong>₹{Number(orderVal).toLocaleString()}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>₹{o.price_per_kg}/kg</div>
                        </td>
                        <td>
                          {isPaid ? (
                            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Paid
                            </span>
                          ) : (
                            <div>
                              <span className="badge badge-yellow">Unpaid</span>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                {o.payment_timing === 'before_delivery' ? 'Pre-pay' : 'On Delivery'}
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          {isReceived ? (
                            <div>
                              <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={12} /> Received
                              </span>
                              {o.received_at && (
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                  {o.received_at.slice(0, 10)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="badge badge-gray">Pending</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{o.deadline || '—'}</td>
                        <td>{getStatusBadge(o.status)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Yarn Purchase Orders Stream */}
      <div className="card-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="panel-header">
          <div>
            <span className="panel-title">
              <Package size={18} color="#2563eb" /> Yarn Supply Orders ({yarnOrders.length})
            </span>
            <div className="panel-subtitle">Mill yarn procurement bills &amp; supplier settlements</div>
          </div>
          {onNavigate && (
            <button className="btn btn-outline-blue btn-sm" onClick={() => onNavigate('yarn', 'order')}>
              Yarn Management <ArrowRight size={13} />
            </button>
          )}
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Yarn Order #</th>
                  <th>Supplier</th>
                  <th>Yarn Specification</th>
                  <th>Ordered Qty</th>
                  <th>Received Qty</th>
                  <th>Total Bill (₹)</th>
                  <th>Supplier Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {yarnOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      No yarn orders placed yet.
                    </td>
                  </tr>
                ) : (
                  yarnOrders.map(yo => {
                    const billAmt = yo.total_amount || (yo.quantity * yo.price_per_kg);
                    const isPaid = yo.payment_status === 'paid';

                    return (
                      <tr key={yo.order_no}>
                        <td><strong>{yo.order_no}</strong></td>
                        <td>{yo.supplier_name}</td>
                        <td>
                          <span className="color-chip" style={{ backgroundColor: yo.hex_value || '#ccc' }} />
                          {yo.type_name} ({yo.colour_name})
                        </td>
                        <td><strong>{yo.quantity} kg</strong></td>
                        <td>
                          <span style={{ color: (yo.received_kg || 0) >= yo.quantity ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                            {yo.received_kg || 0} kg
                          </span>
                        </td>
                        <td>
                          <strong>₹{Number(billAmt).toLocaleString()}</strong>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>₹{yo.price_per_kg}/kg</div>
                        </td>
                        <td>
                          {isPaid ? (
                            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} /> Paid
                            </span>
                          ) : (
                            <span className="badge badge-yellow">Unpaid</span>
                          )}
                        </td>
                        <td>
                          {!readOnly && !isPaid ? (
                            <button 
                              className="btn btn-sm btn-primary"
                              disabled={payingOrderNo === yo.order_no}
                              onClick={() => handlePaySupplier(yo.order_no, billAmt)}
                            >
                              {payingOrderNo === yo.order_no ? 'Paying...' : 'Pay Supplier'}
                            </button>
                          ) : isPaid ? (
                            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.78rem' }}>
                              ✓ Settled
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              Auditor View
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Active Factory Machines Snapshot */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <span className="panel-title">
              <Cpu size={18} color="#2563eb" /> Active Production Floor Snapshot
            </span>
            <div className="panel-subtitle">Real-time status of running machines &amp; FIFO queues</div>
          </div>
          {onNavigate && (
            <button className="btn btn-outline-blue btn-sm" onClick={() => onNavigate('machines')}>
              Full Factory Status &amp; Machines <ArrowRight size={14} />
            </button>
          )}
        </div>
        <div className="panel-body">
          <div className="machine-cards-grid">
            {machines.map(m => (
              <div key={m.machine_id} className={`machine-card ${m.status}`}>
                <div>
                  <div className="machine-header">
                    <div>
                      <div className="machine-name">{m.machine_name}</div>
                      <div className="machine-stage">Stage: {m.stage}</div>
                    </div>
                    <span className={`badge ${
                      m.status === 'running' ? 'badge-blue' :
                      m.status === 'idle' ? 'badge-green' :
                      m.status === 'breakdown' ? 'badge-red' : 'badge-navy'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  {m.status === 'running' && m.job_id ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                        <span>Order #{m.order_id} ({m.stage})</span>
                        <span><strong>{m.done_kg}</strong> / {m.target_kg} kg</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, m.progress_pct)}%` }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                        {m.progress_pct}% done
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '0.5rem 0', color: '#059669', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle2 size={16} /> Ready for next FIFO queue order
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}>
                  <span>Output Today: <strong>{m.kg_today} kg</strong></span>
                  {onNavigate && (
                    <span style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => onNavigate('machines')}>
                      Details →
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
