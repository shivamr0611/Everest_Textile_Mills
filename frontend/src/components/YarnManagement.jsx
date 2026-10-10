import React, { useState } from 'react';
import { 
  Package, Truck, PlusCircle, AlertCircle, CheckCircle2, 
  Search, ArrowRight, ShieldCheck, AlertTriangle 
} from 'lucide-react';
import { api } from '../api';

export default function YarnManagement({
  activeSubTab = 'stock',
  yarnStock = [],
  yarnOrders = [],
  stockAlerts = [],
  colours = [],
  yarnTypes = [],
  suppliers = [],
  onRefresh,
  prefillYarnOrder,
  onClearPrefill,
  gateOnly = false,
  hideGate = false,
  readOnly = false
}) {
  const [subTab, setSubTab] = useState(gateOnly ? 'gate' : ((hideGate || readOnly) && activeSubTab === 'gate' ? 'stock' : activeSubTab));
  const [searchTerm, setSearchTerm] = useState('');

  // Module B: Order Yarn Form state
  const [orderSupplier, setOrderSupplier] = useState(suppliers[0]?.user_id || '');
  const [orderType, setOrderType] = useState(yarnTypes[0]?.yarn_type_id || '');
  const [orderColour, setOrderColour] = useState(colours[0]?.colour_id || '');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [orderPrice, setOrderPrice] = useState('220.0');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState(null);

  // Module C: Gate Entry 4-Input Form state
  const [gateOrderNo, setGateOrderNo] = useState('');
  const [gateType, setGateType] = useState(yarnTypes[0]?.yarn_type_id || '');
  const [gateColour, setGateColour] = useState(colours[0]?.colour_id || '');
  const [gateQuantity, setGateQuantity] = useState('');
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const [gateResult, setGateResult] = useState(null);
  const [gateError, setGateError] = useState(null);

  // Apply prefill if triggered from shortfall alert
  React.useEffect(() => {
    if (prefillYarnOrder) {
      setSubTab('order');
      if (prefillYarnOrder.yarn_type_id) setOrderType(prefillYarnOrder.yarn_type_id);
      if (prefillYarnOrder.colour_id) setOrderColour(prefillYarnOrder.colour_id);
      if (prefillYarnOrder.quantity) setOrderQuantity(prefillYarnOrder.quantity);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillYarnOrder]);

  // Handle Yarn Order Submission (Module B)
  const handleCreateYarnOrder = async (e) => {
    e.preventDefault();
    setOrderSubmitting(true);
    setOrderMessage(null);
    try {
      const res = await api.createYarnOrder({
        supplier_id: parseInt(orderSupplier),
        yarn_type_id: parseInt(orderType),
        colour_id: parseInt(orderColour),
        quantity: parseFloat(orderQuantity),
        price_per_kg: parseFloat(orderPrice)
      });
      setOrderMessage({ type: 'success', text: `Success: Yarn Order ${res.order_no} created with status 'not_supplied'` });
      setOrderQuantity('');
      onRefresh();
    } catch (err) {
      setOrderMessage({ type: 'error', text: err.message });
    } finally {
      setOrderSubmitting(false);
    }
  };

  const [payingOrderNo, setPayingOrderNo] = useState(null);

  const handlePaySupplier = async (orderNo, amount) => {
    if (!window.confirm(`Confirm payment of ₹${Number(amount).toLocaleString()} to supplier for yarn order ${orderNo}?`)) return;
    setPayingOrderNo(orderNo);
    try {
      await api.payYarnOrder(orderNo, amount);
      alert(`Supplier payment of ₹${Number(amount).toLocaleString()} successfully recorded for yarn order ${orderNo}!`);
      onRefresh();
    } catch (err) {
      alert("Error paying supplier: " + err.message);
    } finally {
      setPayingOrderNo(null);
    }
  };

  // Handle Gate Entry Submission (Module C: Exactly 4 Inputs)
  const handleGateEntry = async (e) => {
    e.preventDefault();
    setGateSubmitting(true);
    setGateResult(null);
    setGateError(null);
    try {
      const res = await api.submitGateEntry({
        order_no: gateOrderNo.trim(),
        yarn_type_id: parseInt(gateType),
        colour_id: parseInt(gateColour),
        quantity: parseFloat(gateQuantity)
      });
      setGateResult(res);
      setGateQuantity('');
      setGateOrderNo('');
      onRefresh();
    } catch (err) {
      setGateError(err.message);
    } finally {
      setGateSubmitting(false);
    }
  };

  // Filter stock
  const filteredStock = yarnStock.filter(s => 
    s.type_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.colour_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.pantone_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        {!hideGate && !readOnly && (
          <button 
            className={`btn ${subTab === 'gate' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('gate')}
          >
            <Truck size={16} /> Gate Entry (Module C: 4 Inputs)
          </button>
        )}
        <button 
          className={`btn ${subTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSubTab('stock')}
        >
          <Package size={16} /> Yarn Stock & Warnings (Module D)
        </button>
        {!gateOnly && !readOnly && (
          <button 
            className={`btn ${subTab === 'order' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('order')}
          >
            <PlusCircle size={16} /> Order Yarn from Supplier (Module B)
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB 1: YARN STOCK & WARNINGS (Module D)               */}
      {/* ========================================================= */}
      {subTab === 'stock' && (
        <div>
          {stockAlerts.length > 0 && (
            <div className="alert-banner alert-danger">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                <span><strong>Reorder Alert:</strong> {stockAlerts.length} yarn items have free stock ≤ reorder level!</span>
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Reorder promptly to prevent production queue delays</span>
            </div>
          )}

          <div className="card-panel">
            <div className="panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className="panel-title">
                  <Package size={18} color="#2563eb" /> Raw Material Stock Inventory
                </span>
                <span className="panel-subtitle">
                  Per (Type, Colour): Available, Reserved & Free stock in <strong>kg</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="Search type or colour..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2rem', width: '220px', fontSize: '0.82rem' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '0.65rem', color: '#94a3b8' }} />
                </div>
              </div>
            </div>

            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Yarn Type</th>
                      <th>Colour & Pantone</th>
                      <th>Available (kg)</th>
                      <th>Reserved (kg)</th>
                      <th>Free Stock (kg)</th>
                      <th>Reorder Level (kg)</th>
                      <th>Status / Warning</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No stock entries match your query.
                        </td>
                      </tr>
                    ) : (
                      filteredStock.map(s => {
                        const isLow = s.free_kg <= s.reorder_level;
                        return (
                          <tr key={s.stock_id} style={{ background: isLow ? '#fff5f5' : 'transparent' }}>
                            <td style={{ fontWeight: 600, color: '#0f2744' }}>{s.type_name}</td>
                            <td>
                              <span className="color-chip" style={{ backgroundColor: s.hex_value || '#ccc' }} />
                              <strong>{s.colour_name}</strong>
                              <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{s.pantone_code}</div>
                            </td>
                            <td>{s.available_kg} kg</td>
                            <td style={{ color: '#d97706', fontWeight: 500 }}>{s.reserved_kg} kg</td>
                            <td style={{ fontWeight: 700, color: isLow ? '#dc2626' : '#059669', fontSize: '0.95rem' }}>
                              {s.free_kg} kg
                            </td>
                            <td>{s.reorder_level} kg</td>
                            <td>
                              {isLow ? (
                                <span className="badge badge-red">
                                  <AlertTriangle size={12} /> Low Stock (≤ {s.reorder_level} kg)
                                </span>
                              ) : (
                                <span className="badge badge-green">
                                  <CheckCircle2 size={12} /> Adequate
                                </span>
                              )}
                            </td>
                            <td>
                              {isLow && (
                                <button 
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setSubTab('order');
                                    setOrderType(s.yarn_type_id);
                                    setOrderColour(s.colour_id);
                                    setOrderQuantity(Math.max(200, (s.reorder_level * 2) - s.free_kg));
                                  }}
                                >
                                  + Order Yarn
                                </button>
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
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 2: ORDER YARN FROM SUPPLIER (Module B)            */}
      {/* ========================================================= */}
      {subTab === 'order' && (
        <div>
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <PlusCircle size={18} color="#2563eb" /> Module B: Company Yarn Purchase Order
              </span>
              <span className="panel-subtitle">Raise purchase order to yarn supplier (starts as not_supplied)</span>
            </div>
            <div className="panel-body">
              {orderMessage && (
                <div className={`alert-banner ${orderMessage.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                  {orderMessage.text}
                </div>
              )}

              <form onSubmit={handleCreateYarnOrder}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Yarn Supplier *</label>
                    <select 
                      className="form-control"
                      value={orderSupplier}
                      onChange={(e) => setOrderSupplier(e.target.value)}
                      required
                    >
                      {suppliers.map(sup => (
                        <option key={sup.user_id} value={sup.user_id}>
                          {sup.name} ({sup.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Yarn Material Type *</label>
                    <select 
                      className="form-control"
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      required
                    >
                      {yarnTypes.map(yt => (
                        <option key={yt.yarn_type_id} value={yt.yarn_type_id}>
                          {yt.type_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Colour (100 Pantone Shades) *</label>
                    <select 
                      className="form-control"
                      value={orderColour}
                      onChange={(e) => setOrderColour(e.target.value)}
                      required
                    >
                      {colours.map(c => (
                        <option key={c.colour_id} value={c.colour_id}>
                          {c.colour_name} · {c.pantone_code} {c.is_standard ? '★ Standard' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Quantity to Order (kg) *</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="1"
                      className="form-control"
                      placeholder="e.g. 500.00"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purchase Price per kg (₹) *</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="1"
                      className="form-control"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setOrderQuantity(''); setOrderMessage(null); }}>
                    Reset Form
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={orderSubmitting}>
                    {orderSubmitting ? 'Creating Order...' : 'Submit Yarn Order to Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Existing Yarn Orders Table */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Truck size={18} color="#2563eb" /> Company Yarn Orders Raised (Module B3)
              </span>
              <span className="panel-subtitle">Status strictly has two values: not_supplied or supplied</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order No</th>
                      <th>Supplier</th>
                      <th>Yarn Type</th>
                      <th>Colour</th>
                      <th>Ordered (kg)</th>
                      <th>Received (kg)</th>
                      <th>Price / kg</th>
                      <th>Total Bill (₹)</th>
                      <th>Delivery</th>
                      <th>Supplier Payment</th>
                      <th>Action</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yarnOrders.length === 0 ? (
                      <tr>
                        <td colSpan="12" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No yarn orders found.
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
                            <td>{yo.type_name}</td>
                            <td>
                              <span className="color-chip" style={{ backgroundColor: yo.hex_value || '#ccc' }} />
                              {yo.colour_name}
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{yo.pantone_code}</div>
                            </td>
                            <td><strong>{yo.quantity} kg</strong></td>
                            <td>{yo.received_kg || 0} kg</td>
                            <td>₹{yo.price_per_kg}</td>
                            <td><strong>₹{Number(billAmt).toLocaleString()}</strong></td>
                            <td>
                              <span className={`badge ${yo.status === 'supplied' ? 'badge-green' : 'badge-yellow'}`}>
                                {yo.status === 'supplied' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                {yo.status}
                              </span>
                            </td>
                            <td>
                              {isPaid ? (
                                <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <CheckCircle2 size={12} /> Paid
                                </span>
                              ) : (
                                <span className="badge badge-yellow">Unpaid</span>
                              )}
                            </td>
                            <td>
                              {!isPaid ? (
                                <button
                                  className="btn btn-sm btn-primary"
                                  disabled={payingOrderNo === yo.order_no}
                                  onClick={() => handlePaySupplier(yo.order_no, billAmt)}
                                >
                                  {payingOrderNo === yo.order_no ? 'Paying...' : 'Pay Supplier'}
                                </button>
                              ) : (
                                <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }}>
                                  ✓ Settled
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{yo.ordered_at}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB 3: GATE ENTRY (Module C: Exactly 4 Inputs)        */}
      {/* ========================================================= */}
      {subTab === 'gate' && (
        <div>
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Truck size={18} color="#2563eb" /> Module C: Yarn Arrival at Gate Entry
              </span>
              <span className="panel-subtitle">
                Takes <strong>exactly four inputs</strong>: quantity received (kg), yarn type, colour, and order number
              </span>
            </div>
            <div className="panel-body">
              {gateResult && (
                <div className="alert-banner alert-success">
                  <div>
                    <strong>Gate Entry Successful!</strong> {gateResult.quantity_received} kg added to raw yarn stock.
                    <div>Order {gateResult.order_no} status: <strong>{gateResult.order_status}</strong> (Total received: {gateResult.total_received} kg).</div>
                    {gateResult.warning && (
                      <div style={{ color: '#b45309', marginTop: '0.35rem' }}>
                        ⚠ {gateResult.warning}
                      </div>
                    )}
                    {gateResult.orders_unblocked > 0 && (
                      <div style={{ color: '#047857', marginTop: '0.35rem', fontWeight: 600 }}>
                        ✓ {gateResult.orders_unblocked} waiting buyer order(s) unblocked and assigned to production queue!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {gateError && (
                <div className="alert-banner alert-danger">
                  <div>
                    <strong>Gate Entry Rejected:</strong> {gateError}
                  </div>
                </div>
              )}

              <form onSubmit={handleGateEntry}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Strict Gate Validation (Section 2.1 C1-C2): System verifies order number exists, is still not_supplied, and that yarn type and colour match that order.
                  </div>

                  <div className="form-grid">
                    {/* Input 1: Company's yarn order number */}
                    <div className="form-group">
                      <label className="form-label">1. Yarn Order Number *</label>
                      <input 
                        type="text"
                        className="form-control"
                        placeholder="e.g. YO-2026-0002"
                        value={gateOrderNo}
                        onChange={(e) => setGateOrderNo(e.target.value)}
                        required
                      />
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Must be an active, unsupplied order
                      </div>
                    </div>

                    {/* Input 2: Yarn Material Type */}
                    <div className="form-group">
                      <label className="form-label">2. Yarn Type *</label>
                      <select 
                        className="form-control"
                        value={gateType}
                        onChange={(e) => setGateType(e.target.value)}
                        required
                      >
                        {yarnTypes.map(yt => (
                          <option key={yt.yarn_type_id} value={yt.yarn_type_id}>
                            {yt.type_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Input 3: Colour */}
                    <div className="form-group">
                      <label className="form-label">3. Colour (Pantone) *</label>
                      <select 
                        className="form-control"
                        value={gateColour}
                        onChange={(e) => setGateColour(e.target.value)}
                        required
                      >
                        {colours.map(c => (
                          <option key={c.colour_id} value={c.colour_id}>
                            {c.colour_name} ({c.pantone_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Input 4: Quantity received (kg) */}
                    <div className="form-group">
                      <label className="form-label">4. Quantity Received (kg) *</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0.1"
                        className="form-control"
                        placeholder="e.g. 300.00"
                        value={gateQuantity}
                        onChange={(e) => setGateQuantity(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={gateSubmitting}>
                    {gateSubmitting ? 'Verifying & Saving...' : 'Record Gate Entry & Add Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Quick reference of pending yarn orders */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <AlertCircle size={18} color="#d97706" /> Pending Orders Awaiting Gate Arrival
              </span>
              <span className="panel-subtitle">Orders ready for gate verification</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order No</th>
                      <th>Supplier</th>
                      <th>Required Type</th>
                      <th>Required Colour</th>
                      <th>Ordered (kg)</th>
                      <th>Received So Far</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yarnOrders.filter(o => o.status === 'not_supplied').length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No pending orders awaiting gate arrival. All orders are supplied!
                        </td>
                      </tr>
                    ) : (
                      yarnOrders.filter(o => o.status === 'not_supplied').map(o => (
                        <tr key={o.order_no}>
                          <td><strong>{o.order_no}</strong></td>
                          <td>{o.supplier_name}</td>
                          <td>{o.type_name}</td>
                          <td>
                            <span className="color-chip" style={{ backgroundColor: o.hex_value || '#ccc' }} />
                            {o.colour_name}
                          </td>
                          <td>{o.quantity} kg</td>
                          <td>{o.received_kg || 0} kg</td>
                          <td>
                            <button 
                              className="btn btn-sm btn-outline-blue"
                              onClick={() => {
                                setGateOrderNo(o.order_no);
                                setGateType(o.yarn_type_id);
                                setGateColour(o.colour_id);
                                setGateQuantity(o.quantity - (o.received_kg || 0));
                              }}
                            >
                              Auto-Fill Form
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
