import React, { useState } from 'react';
import { 
  ClipboardList, CheckCircle2, AlertTriangle, Clock, 
  Search, ArrowRight, Eye, RefreshCw, X 
} from 'lucide-react';
import { api } from '../api';

export default function BuyerOrdersManagement({
  buyerOrders = [],
  colours = [],
  yarnTypes = [],
  customers = [],
  onRefresh,
  onOpenOrderShortfall,
  readOnly = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCheckOrder, setSelectedCheckOrder] = useState(null);
  const [yarnCheckResult, setYarnCheckResult] = useState(null);
  const [checkingYarn, setCheckingYarn] = useState(false);

  // Status mapping
  const getStatusBadge = (status) => {
    switch (status) {
      case 'placed':
        return <span className="badge badge-yellow">Order Placed</span>;
      case 'awaiting_yarn':
        return <span className="badge badge-red"><AlertTriangle size={12} /> Awaiting Yarn</span>;
      case 'in_queue':
        return <span className="badge badge-purple"><Clock size={12} /> In FIFO Queue</span>;
      case 'spinning':
      case 'weaving':
      case 'dyeing':
        return <span className="badge badge-blue">Production ({status})</span>;
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

  const handleYarnCheck = async (order) => {
    setSelectedCheckOrder(order);
    setCheckingYarn(true);
    setYarnCheckResult(null);
    try {
      const res = await api.checkOrderYarn(order.order_id);
      setYarnCheckResult(res);
    } catch (err) {
      alert("Error checking yarn: " + err.message);
    } finally {
      setCheckingYarn(false);
    }
  };

  const filteredOrders = buyerOrders.filter(o => {
    const matchesSearch = 
      o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.colour_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.type_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(o.order_id).includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <span className="panel-title">
              <ClipboardList size={18} color="#2563eb" /> Buyer Orders Management (Module G & D)
            </span>
            <div className="panel-subtitle">
              Order pipeline, 5% wastage yarn calculation, reservation & FIFO eligibility
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text"
                className="form-control"
                placeholder="Search orders or buyers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2rem', width: '220px', fontSize: '0.82rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '0.65rem', color: '#94a3b8' }} />
            </div>

            <select 
              className="form-control" 
              style={{ width: '170px', fontSize: '0.82rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="awaiting_yarn">Awaiting Yarn</option>
              <option value="in_queue">In Queue</option>
              <option value="spinning">Spinning</option>
              <option value="weaving">Weaving</option>
              <option value="dyeing">Dyeing</option>
              <option value="quality_check">Quality Check</option>
              <option value="ready_to_ship">Ready to Ship</option>
              <option value="dispatched">Dispatched</option>
            </select>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer (Buyer)</th>
                  <th>Fabric & Colour</th>
                  <th>Quantity (kg)</th>
                  <th>Total Value (₹)</th>
                  <th>Customer Payment</th>
                  <th>Customer Receipt</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No buyer orders found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => {
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
                        <td style={{ fontSize: '0.82rem' }}>{o.deadline}</td>
                        <td>{getStatusBadge(o.status)}</td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-blue"
                            onClick={() => handleYarnCheck(o)}
                          >
                            Check Yarn
                          </button>
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

      {/* Yarn Check Modal (Module D3-D4) */}
      {selectedCheckOrder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">
                Yarn Availability Check: Order #{selectedCheckOrder.order_id}
              </span>
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={() => { setSelectedCheckOrder(null); setYarnCheckResult(null); }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {checkingYarn ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw size={24} className="spin-animate" color="#2563eb" />
                  <p style={{ marginTop: '0.5rem', color: '#64748b' }}>Checking stock against formula (free = available - reserved)...</p>
                </div>
              ) : yarnCheckResult ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Buyer Order Fabric & Colour</div>
                      <div style={{ fontWeight: 600, color: '#0f2744' }}>
                        {selectedCheckOrder.type_name} - {selectedCheckOrder.colour_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        Target: {selectedCheckOrder.quantity_kg} kg fabric
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Yarn Needed (+5% Wastage)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e3a8a' }}>
                        {yarnCheckResult.needed_kg} kg
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Formula: {selectedCheckOrder.quantity_kg} kg × 1.05
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <span>Physical Stock Available:</span>
                      <strong>{yarnCheckResult.available_kg} kg</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <span>Already Reserved by Other Orders:</span>
                      <span style={{ color: '#d97706', fontWeight: 600 }}>{yarnCheckResult.reserved_kg} kg</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.95rem' }}>
                      <span><strong>Free Unreserved Stock:</strong></span>
                      <strong style={{ color: yarnCheckResult.enough_yarn ? '#059669' : '#dc2626' }}>
                        {yarnCheckResult.free_kg} kg
                      </strong>
                    </div>
                  </div>

                  {yarnCheckResult.enough_yarn ? (
                    <div className="alert-banner alert-success">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={20} />
                        <div>
                          <strong>Enough yarn – ready to start!</strong>
                          <div>The required {yarnCheckResult.needed_kg} kg has been reserved for this order.</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-banner alert-danger">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertTriangle size={20} />
                          <strong>Short by {yarnCheckResult.shortfall_kg} kg – order more!</strong>
                        </div>
                        <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                          Free stock ({yarnCheckResult.free_kg} kg) is insufficient for required {yarnCheckResult.needed_kg} kg. Order status is <em>awaiting_yarn</em>.
                        </div>
                        <button 
                          className="btn btn-sm btn-danger"
                          style={{ marginTop: '0.75rem', background: '#991b1b', color: '#ffffff' }}
                          onClick={() => {
                            setSelectedCheckOrder(null);
                            onOpenOrderShortfall({
                              yarn_type_id: selectedCheckOrder.yarn_type_id,
                              colour_id: selectedCheckOrder.colour_id,
                              quantity: yarnCheckResult.shortfall_kg
                            });
                          }}
                        >
                          Create Yarn Order for Shortfall ({yarnCheckResult.shortfall_kg} kg) <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => { setSelectedCheckOrder(null); setYarnCheckResult(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
