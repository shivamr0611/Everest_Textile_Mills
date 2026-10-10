import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, PlusCircle, CheckCircle2, Clock, 
  Truck, AlertTriangle, ArrowRight, RefreshCw, Calendar,
  CreditCard, PackageCheck, Check
} from 'lucide-react';
import { api } from '../api';

export default function CustomerPortal({
  currentUser,
  colours = [],
  yarnTypes = []
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Place New Order form
  const [newOrderType, setNewOrderType] = useState(yarnTypes[0]?.yarn_type_id || '');
  const [newOrderColour, setNewOrderColour] = useState(colours[0]?.colour_id || '');
  const [newOrderQty, setNewOrderQty] = useState('');
  const [newOrderDeadline, setNewOrderDeadline] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [paymentTiming, setPaymentTiming] = useState('after_delivery'); // 'before_delivery' | 'after_delivery'
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placeResult, setPlaceResult] = useState(null);
  const [colorSearch, setColorSearch] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    loadMyOrders();
  }, [currentUser]);

  const loadMyOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getMyOrders(currentUser.user_id);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!newOrderQty || parseFloat(newOrderQty) <= 0) {
      alert("Please enter a valid quantity in kg");
      return;
    }

    setPlacingOrder(true);
    setPlaceResult(null);
    try {
      const res = await api.placeBuyerOrder({
        customer_id: currentUser.user_id,
        yarn_type_id: parseInt(newOrderType),
        colour_id: parseInt(newOrderColour),
        quantity_kg: parseFloat(newOrderQty),
        deadline: newOrderDeadline,
        payment_timing: paymentTiming
      });
      setPlaceResult({
        type: 'success',
        text: `Order #${res.order_id} placed successfully! Initial status: ${res.status.replace('_', ' ')}. Payment schedule: ${paymentTiming === 'before_delivery' ? 'Pre-Payment' : 'Pay After Delivery'}.`
      });
      setNewOrderQty('');
      loadMyOrders();
    } catch (err) {
      setPlaceResult({ type: 'error', text: err.message });
    } finally {
      setPlacingOrder(false);
    }
  };

  const handlePayOrder = async (orderId) => {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      await api.payOrder(orderId);
      loadMyOrders();
    } catch (err) {
      alert("Error processing payment: " + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleConfirmReceived = async (orderId) => {
    setActionLoading(prev => ({ ...prev, [orderId]: true }));
    try {
      await api.confirmReceivedOrder(orderId);
      loadMyOrders();
    } catch (err) {
      alert("Error confirming receipt: " + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Pipeline stages: replaced spinning/weaving/dyeing with single 'Fabrication' stage
  const stages = [
    { key: 'placed', label: 'Placed' },
    { key: 'awaiting_yarn', label: 'Awaiting Mat.' },
    { key: 'in_queue', label: 'In Queue' },
    { key: 'fabrication', label: 'Fabrication' },
    { key: 'quality_check', label: 'QC' },
    { key: 'ready_to_ship', label: 'Ready' },
    { key: 'dispatched', label: 'Dispatched' }
  ];

  const getStageIndex = (status) => {
    if (['spinning', 'weaving', 'dyeing'].includes(status)) return 3; // maps to fabrication
    const idx = stages.findIndex(s => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  const filteredColours = colours.filter(c => 
    c.colour_name.toLowerCase().includes(colorSearch.toLowerCase()) ||
    c.pantone_code.toLowerCase().includes(colorSearch.toLowerCase())
  );

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a8a, #0284c7)', 
        color: '#ffffff', 
        borderRadius: '12px', 
        padding: '1.5rem 2rem', 
        marginBottom: '1.5rem',
        boxShadow: 'var(--card-shadow)'
      }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
          Welcome, {currentUser.name}
        </h2>
        <div style={{ fontSize: '0.9rem', color: '#e0f2fe', marginTop: '0.4rem' }}>
          Customer Ordering &amp; Tracking Portal · Real-Time Manufacturing Visibility · Unit: <strong>kg</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Place New Order Form */}
        <div className="card-panel">
          <div className="panel-header">
            <span className="panel-title">
              <PlusCircle size={18} color="#2563eb" /> Place Fabric Order
            </span>
            <span className="panel-subtitle">Request custom dyed fabric batch from Everest Mills</span>
          </div>
          <div className="panel-body">
            {placeResult && (
              <div className={`alert-banner ${placeResult.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                {placeResult.text}
              </div>
            )}

            <form onSubmit={handlePlaceOrder}>
              <div className="form-group">
                <label className="form-label">Fabric / Yarn Type *</label>
                <select 
                  className="form-control"
                  value={newOrderType}
                  onChange={(e) => setNewOrderType(e.target.value)}
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
                <label className="form-label">Pantone Shade / Colour *</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Filter colors..."
                  style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}
                  value={colorSearch}
                  onChange={(e) => setColorSearch(e.target.value)}
                />
                <select 
                  className="form-control"
                  value={newOrderColour}
                  onChange={(e) => setNewOrderColour(e.target.value)}
                  required
                >
                  {filteredColours.slice(0, 100).map(c => (
                    <option key={c.colour_id} value={c.colour_id}>
                      {c.colour_name} ({c.pantone_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Order Quantity (kg) *</label>
                <input 
                  type="number"
                  step="1"
                  min="10"
                  className="form-control"
                  placeholder="e.g. 200"
                  value={newOrderQty}
                  onChange={(e) => setNewOrderQty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Deadline *</label>
                <input 
                  type="date"
                  className="form-control"
                  value={newOrderDeadline}
                  onChange={(e) => setNewOrderDeadline(e.target.value)}
                  required
                />
              </div>

              {/* Payment Option: Decide before or after delivery */}
              <div className="form-group">
                <label className="form-label">Payment Preference *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentTiming('after_delivery')}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: paymentTiming === 'after_delivery' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: paymentTiming === 'after_delivery' ? '#eff6ff' : '#ffffff',
                      color: paymentTiming === 'after_delivery' ? '#1e3a8a' : '#64748b',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Pay After Receiving
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentTiming('before_delivery')}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      border: paymentTiming === 'before_delivery' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: paymentTiming === 'before_delivery' ? '#eff6ff' : '#ffffff',
                      color: paymentTiming === 'before_delivery' ? '#1e3a8a' : '#64748b',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Pay Before Receiving
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
                  {paymentTiming === 'after_delivery' ? "You can pay once the fabric is delivered to your facility." : "You can pay in advance before or upon dispatch."}
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={placingOrder}
              >
                {placingOrder ? 'Submitting Order...' : 'Submit Order to Everest Mills'}
              </button>
            </form>
          </div>
        </div>

        {/* My Orders Live Tracking */}
        <div>
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <ShoppingBag size={18} color="#2563eb" /> My Active Orders Status
              </span>
              <span className="panel-subtitle">Direct factory floor tracking — eliminates phone calls</span>
            </div>
            <div className="panel-body">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw size={24} className="spin-animate" color="#2563eb" />
                </div>
              ) : orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  You have not placed any orders yet. Use the form on the left to start!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {orders.map(o => {
                    const currentIdx = getStageIndex(o.status);
                    const isDispatched = o.status === 'dispatched';
                    const isPaid = o.payment_status === 'paid';
                    const isReceived = o.is_received === 1;

                    return (
                      <div 
                        key={o.order_id} 
                        style={{ 
                          border: '1px solid #dbeafe', 
                          borderRadius: '10px', 
                          padding: '1.25rem', 
                          background: '#ffffff',
                          boxShadow: '0 2px 4px rgba(15, 39, 68, 0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f2744' }}>
                              Order #{o.order_id}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                              <span className="color-chip" style={{ backgroundColor: o.hex_value || '#ccc' }} />
                              <strong>{o.fabric_type}</strong> in <strong>{o.colour_name}</strong> ({o.pantone_code})
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e3a8a' }}>
                              {o.quantity_kg} kg
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              Target Deadline: <strong>{o.deadline}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Visual Progress Stepper (Single Fabrication Process) */}
                        <div className="stepper-container">
                          {stages.map((stg, sIdx) => {
                            // If order is dispatched, all steps including Dispatched are completed with ticks
                            const isCompleted = isDispatched ? true : sIdx < currentIdx;
                            const isActive = isDispatched ? false : sIdx === currentIdx;
                            return (
                              <div key={stg.key} className="stepper-step">
                                <div className={`step-node ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                                  {isCompleted ? '✓' : sIdx + 1}
                                </div>
                                <div className={`step-label ${isActive ? 'active' : ''}`}>
                                  {stg.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Customer Action Strip: Payment + Received Acknowledgment */}
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.75rem 1rem',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            {/* Checkbox to acknowledge order received */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#0f2744', cursor: isDispatched && !isReceived ? 'pointer' : 'default' }}>
                              <input 
                                type="checkbox"
                                checked={isReceived}
                                disabled={!isDispatched || isReceived || actionLoading[o.order_id]}
                                onChange={() => handleConfirmReceived(o.order_id)}
                                style={{ width: '16px', height: '16px', cursor: isDispatched && !isReceived ? 'pointer' : 'default' }}
                              />
                              {isReceived ? (
                                <span style={{ color: '#16a34a' }}>✓ Order Received ({o.received_at ? o.received_at.slice(0, 10) : 'Done'})</span>
                              ) : (
                                <span>I have received this order</span>
                              )}
                            </label>

                            {/* Payment Status indicator */}
                            <div style={{ fontSize: '0.8rem' }}>
                              Payment: {isPaid ? (
                                <span className="badge badge-green" style={{ marginLeft: 4 }}><Check size={11} /> Paid</span>
                              ) : (
                                <span className="badge badge-yellow" style={{ marginLeft: 4 }}>Unpaid ({o.payment_timing === 'before_delivery' ? 'Pay Before Delivery' : 'Pay After Delivery'})</span>
                              )}
                            </div>
                          </div>

                          {/* Customer Pay Button */}
                          <div>
                            {!isPaid ? (
                              <button
                                className="btn btn-sm btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                disabled={actionLoading[o.order_id]}
                                onClick={() => handlePayOrder(o.order_id)}
                              >
                                <CreditCard size={14} /> Pay Now
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>Payment Settled</span>
                            )}
                          </div>
                        </div>

                        <div style={{ 
                          marginTop: '0.75rem', 
                          fontSize: '0.8rem', 
                          color: '#475569',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            Current Mill Status: <strong style={{ color: '#2563eb' }}>{o.display_status}</strong>
                          </div>
                          <div>
                            Estimated Delivery Date: <strong>{o.estimated_delivery}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
