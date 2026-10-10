import React, { useState, useEffect } from 'react';
import { 
  Package, Truck, FileText, CheckCircle2, AlertTriangle, 
  Search, Eye, Printer, X, ShieldCheck 
} from 'lucide-react';
import { api } from '../api';

export default function FinishedGoodsDispatch({
  storeData = {},
  buyerOrders = [],
  onRefresh,
  readOnly = false
}) {
  const [activeTab, setActiveTab] = useState('store'); // 'store', 'dispatch', 'invoices'
  const [readyOrders, setReadyOrders] = useState([]);
  const [loadingReady, setLoadingReady] = useState(false);

  // Dispatch Form state (Module H2)
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderAvailableRolls, setOrderAvailableRolls] = useState([]);
  const [selectedRollIds, setSelectedRollIds] = useState([]);
  const [truckNo, setTruckNo] = useState('');
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchError, setDispatchError] = useState(null);

  // Invoices list state (Module H4)
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);

  const onShelfRolls = storeData.on_shelf_rolls || [];
  const totalShelfKg = storeData.total_shelf_kg || 0;
  const dispatchHistory = storeData.dispatch_history || [];

  useEffect(() => {
    loadReadyOrders();
    loadInvoices();
  }, []);

  const loadReadyOrders = async () => {
    setLoadingReady(true);
    try {
      const data = await api.getDispatchReadyOrders();
      setReadyOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReady(false);
    }
  };

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInvoices(false);
    }
  };


  // When order picked, load its passed rolls
  const handleSelectOrder = async (orderId) => {
    setSelectedOrderId(orderId);
    setSelectedRollIds([]);
    setDispatchResult(null);
    setDispatchError(null);
    if (!orderId) {
      setOrderAvailableRolls([]);
      return;
    }
    try {
      const rolls = await api.getRolls({ order_id: orderId, qc_status: 'passed' });
      // Only keep in_stock rolls
      const inStock = rolls.filter(r => r.store_status === 'in_stock');
      setOrderAvailableRolls(inStock);
      // Auto-select all by default
      setSelectedRollIds(inStock.map(r => r.roll_id));
    } catch (err) {
      alert("Error fetching rolls: " + err.message);
    }
  };

  const handleToggleRoll = (rollId) => {
    if (selectedRollIds.includes(rollId)) {
      setSelectedRollIds(selectedRollIds.filter(id => id !== rollId));
    } else {
      setSelectedRollIds([...selectedRollIds, rollId]);
    }
  };

  const selectedOrderObj = buyerOrders.find(o => String(o.order_id) === String(selectedOrderId));
  const selectedWeightTotal = orderAvailableRolls
    .filter(r => selectedRollIds.includes(r.roll_id))
    .reduce((acc, curr) => acc + parseFloat(curr.weight_kg), 0);

  const handleExecuteDispatch = async (e) => {
    e.preventDefault();
    if (!selectedOrderId || selectedRollIds.length === 0 || !truckNo.trim()) {
      alert("Please select order, at least one roll, and enter truck number");
      return;
    }

    setDispatchSubmitting(true);
    setDispatchResult(null);
    setDispatchError(null);
    try {
      const res = await api.createDispatch({
        order_id: parseInt(selectedOrderId),
        roll_ids: selectedRollIds,
        truck_no: truckNo.trim()
      });
      setDispatchResult(res);
      setTruckNo('');
      setSelectedOrderId('');
      setOrderAvailableRolls([]);
      setSelectedRollIds([]);
      onRefresh();
      loadReadyOrders();
      loadInvoices();
    } catch (err) {
      setDispatchError(err.message);
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handleViewInvoiceDetail = async (invoiceId) => {
    try {
      const inv = await api.getInvoice(invoiceId);
      setViewInvoice(inv);
    } catch (err) {
      alert("Failed to load invoice: " + err.message);
    }
  };

  return (
    <div>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'store' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('store')}
        >
          <Package size={16} /> Finished Goods Store Shelf (Module H1, H5)
        </button>
        {!readOnly && (
          <button 
            className={`btn ${activeTab === 'dispatch' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dispatch')}
          >
            <Truck size={16} /> Dispatch Loading & Roll Matching (Module H2-H4)
          </button>
        )}
        <button 
          className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('invoices')}
        >
          <FileText size={16} /> Commercial Invoices Generated
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: FINISHED GOODS STORE SHELF (Module H1, H5)         */}
      {/* ========================================================= */}
      {activeTab === 'store' && (
        <div>
          {/* Shelf Summary Banner */}
          <div style={{ 
            background: 'linear-gradient(135deg, #0f2744, #1e3a8a)', 
            color: '#ffffff', 
            padding: '1.25rem 1.5rem', 
            borderRadius: '10px', 
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#bfdbfe', textTransform: 'uppercase', fontWeight: 600 }}>
                Finished Goods On Shelf (Module H5)
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                {totalShelfKg.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kg QC-passed in store</span>
              </div>
            </div>
            <button 
              className="btn btn-primary"
              style={{ background: '#2563eb', border: '1px solid #3b82f6' }}
              onClick={() => setActiveTab('dispatch')}
            >
              <Truck size={16} /> Go to Dispatch Screen
            </button>
          </div>

          {/* Shelf Rolls Table */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Package size={18} color="#2563eb" /> Passed Rolls Sitting in Store (in_stock)
              </span>
              <span className="panel-subtitle">Ready to be matched to buyer dispatch loads</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Roll Code</th>
                      <th>Order #</th>
                      <th>Buyer</th>
                      <th>Fabric Type</th>
                      <th>Colour</th>
                      <th>Weight (kg)</th>
                      <th>Produced At</th>
                      <th>Store Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onShelfRolls.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No rolls currently sitting on shelf. Pass rolls through QC to stock finished goods!
                        </td>
                      </tr>
                    ) : (
                      onShelfRolls.map(r => (
                        <tr key={r.roll_id}>
                          <td><strong>{r.roll_code}</strong></td>
                          <td>Order #{r.order_id}</td>
                          <td>{r.customer_name}</td>
                          <td>{r.type_name}</td>
                          <td>
                            <span className="color-chip" style={{ backgroundColor: r.hex_value || '#ccc' }} />
                            {r.colour_name}
                          </td>
                          <td><strong>{r.weight_kg} kg</strong></td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.produced_at}</td>
                          <td>
                            <span className="badge badge-green">In Stock</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Dispatch History (Module H5) */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Truck size={18} color="#2563eb" /> Dispatches Out History (Module H5)
              </span>
              <span className="panel-subtitle">Record of loaded trucks that have departed Everest Textile Mills</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dispatch ID</th>
                      <th>Truck No</th>
                      <th>Dispatched At</th>
                      <th>Buyer</th>
                      <th>Order #</th>
                      <th>Total Loaded (kg)</th>
                      <th>Invoice No</th>
                      <th>Invoice Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchHistory.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No dispatches completed yet.
                        </td>
                      </tr>
                    ) : (
                      dispatchHistory.map(d => (
                        <tr key={d.dispatch_id}>
                          <td><strong>DSP-{d.dispatch_id}</strong></td>
                          <td><strong>{d.truck_no}</strong></td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{d.dispatched_at}</td>
                          <td>{d.customer_name}</td>
                          <td>Order #{d.order_id}</td>
                          <td><strong>{d.total_kg} kg</strong></td>
                          <td>
                            {d.invoice_no ? (
                              <span style={{ color: '#2563eb', fontWeight: 600 }}>{d.invoice_no}</span>
                            ) : '—'}
                          </td>
                          <td>₹{d.amount ? d.amount.toLocaleString() : '—'}</td>
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

      {/* ========================================================= */}
      {/* TAB 2: DISPATCH LOADING & ROLL MATCHING (Module H2-H4)    */}
      {/* ========================================================= */}
      {activeTab === 'dispatch' && (
        <div>
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Truck size={18} color="#2563eb" /> Module H2: Dispatch Screen & Roll Verification
              </span>
              <span className="panel-subtitle">
                System checks right rolls, right buyer, right quantity, blocks double-dispatch & creates invoice
              </span>
            </div>
            <div className="panel-body">
              {dispatchResult && (
                <div className="alert-banner alert-success">
                  <div>
                    <strong>Dispatch Confirmed!</strong> Truck departure recorded.
                    <div>Invoice Generated: <strong>{dispatchResult.invoice_no}</strong> (Loaded: {dispatchResult.loaded_kg} kg · Amount: ₹{dispatchResult.amount.toLocaleString()})</div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => handleViewInvoiceDetail(dispatchResult.invoice_id)}
                      >
                        <FileText size={14} /> View Commercial Invoice
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {dispatchError && (
                <div className="alert-banner alert-danger">
                  <strong>Dispatch Blocked:</strong> {dispatchError}
                </div>
              )}

              <form onSubmit={handleExecuteDispatch}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">1. Pick Buyer Order to Dispatch *</label>
                    <select 
                      className="form-control"
                      value={selectedOrderId}
                      onChange={(e) => handleSelectOrder(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Order Ready for Dispatch --</option>
                      {buyerOrders
                        .filter(o => o.status === 'ready_to_ship' || o.status === 'quality_check')
                        .map(o => (
                          <option key={o.order_id} value={o.order_id}>
                            Order #{o.order_id} · {o.customer_name} ({o.quantity_kg} kg {o.type_name} {o.colour_name})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">2. Transport Truck License Number *</label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="e.g. DL-01-AB-1234"
                      value={truckNo}
                      onChange={(e) => setTruckNo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Roll selection list */}
                {selectedOrderId && (
                  <div style={{ marginTop: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f2744' }}>
                          Select Passed Rolls to Load for Order #{selectedOrderId}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Ordered: <strong>{selectedOrderObj?.quantity_kg} kg</strong> · Selected: <strong>{selectedWeightTotal} kg</strong>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem' }}>
                        {selectedWeightTotal === parseFloat(selectedOrderObj?.quantity_kg || 0) ? (
                          <span className="badge badge-green"><CheckCircle2 size={12} /> Exact Quantity Match</span>
                        ) : (
                          <span className="badge badge-yellow">
                            Partial Dispatch ({selectedWeightTotal} / {selectedOrderObj?.quantity_kg} kg)
                          </span>
                        )}
                      </div>
                    </div>

                    {orderAvailableRolls.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626', fontSize: '0.85rem' }}>
                        <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                        No passed rolls in stock for this order yet. Complete QC inspection first!
                      </div>
                    ) : (
                      <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table className="data-table" style={{ fontSize: '0.82rem' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }}>Load</th>
                              <th>Roll Code</th>
                              <th>Weight (kg)</th>
                              <th>Machine Origin</th>
                              <th>QC Status</th>
                              <th>Store Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderAvailableRolls.map(r => (
                              <tr key={r.roll_id}>
                                <td>
                                  <input 
                                    type="checkbox"
                                    checked={selectedRollIds.includes(r.roll_id)}
                                    onChange={() => handleToggleRoll(r.roll_id)}
                                  />
                                </td>
                                <td><strong>{r.roll_code}</strong></td>
                                <td>{r.weight_kg} kg</td>
                                <td>{r.machine_name}</td>
                                <td><span className="badge badge-green">Passed</span></td>
                                <td><span className="badge badge-blue">In Stock</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={dispatchSubmitting || !selectedOrderId || orderAvailableRolls.length === 0}
                  >
                    {dispatchSubmitting ? 'Verifying & Dispatching...' : 'Confirm Load & Generate Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: INVOICES LIST (Module H4)                          */}
      {/* ========================================================= */}
      {activeTab === 'invoices' && (
        <div className="card-panel">
          <div className="panel-header">
            <span className="panel-title">
              <FileText size={18} color="#2563eb" /> Commercial Invoices Generated (Module H4)
            </span>
            <span className="panel-subtitle">
              Generated automatically from loaded rolls — lines and kg match load exactly
            </span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Customer Name</th>
                    <th>Order #</th>
                    <th>Truck Loaded</th>
                    <th>Total Weight (kg)</th>
                    <th>Invoice Amount</th>
                    <th>Issued At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No commercial invoices generated yet.
                      </td>
                    </tr>
                  ) : (
                    invoices.map(inv => (
                      <tr key={inv.invoice_id}>
                        <td><strong>{inv.invoice_no}</strong></td>
                        <td>{inv.customer_name}</td>
                        <td>Order #{inv.order_id}</td>
                        <td>{inv.truck_no}</td>
                        <td><strong>{inv.total_kg} kg</strong></td>
                        <td style={{ fontWeight: 700, color: '#1e3a8a' }}>
                          ₹{inv.amount.toLocaleString()}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{inv.issued_at}</td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-blue"
                            onClick={() => handleViewInvoiceDetail(inv.invoice_id)}
                          >
                            <Eye size={12} /> View Invoice
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
      )}

      {/* ========================================================= */}
      {/* INVOICE VIEWER MODAL (Printable format)                   */}
      {/* ========================================================= */}
      {viewInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <span className="modal-title">
                Commercial Invoice: {viewInvoice.invoice_no}
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => setViewInvoice(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem', background: '#ffffff' }}>
              <div style={{ borderBottom: '2px solid #0f2744', paddingBottom: '1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: '#0f2744', fontWeight: 800 }}>EVEREST TEXTILE MILLS</h2>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Industrial Estate, Phase II, Textile Hub</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>GSTIN: 07AAACE9876F1Z8 · Unit: kg</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>{viewInvoice.invoice_no}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Date: {viewInvoice.issued_at}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Truck: {viewInvoice.truck_no}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: '#0f2744', marginBottom: '0.2rem' }}>Billed To:</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{viewInvoice.customer_name}</div>
                <div>Email: {viewInvoice.customer_email || '—'} · Phone: {viewInvoice.customer_phone || '—'}</div>
                <div>Buyer Order Reference: <strong>Order #{viewInvoice.order_id}</strong></div>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
                Loaded Rolls Breakdown (Traceability Match)
              </div>
              <table className="data-table" style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                <thead>
                  <tr>
                    <th>Roll Code</th>
                    <th>Fabric Material</th>
                    <th>Origin Machine</th>
                    <th style={{ textAlign: 'right' }}>Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {viewInvoice.rolls?.map(r => (
                    <tr key={r.roll_id}>
                      <td>{r.roll_code}</td>
                      <td>{viewInvoice.type_name} ({viewInvoice.colour_name})</td>
                      <td>{r.machine_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.weight_kg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '2px solid #0f2744', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Total Billed Fabric: <strong>{viewInvoice.total_kg} kg</strong></div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Rate per kg: ₹{viewInvoice.price_per_kg} / kg</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Total Amount Due</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f2744' }}>
                    ₹{viewInvoice.amount?.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={14} /> Print Invoice
              </button>
              <button className="btn btn-primary" onClick={() => setViewInvoice(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
