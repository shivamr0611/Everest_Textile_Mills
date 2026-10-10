import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { api } from '../api';

export default function SupplierPortal({ currentUser }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSupplierOrders();
  }, [currentUser]);

  const loadSupplierOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getYarnOrders(currentUser.user_id);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Banner */}
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
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
            {currentUser.name} · Yarn Dispatch Orders (Module B3)
          </h2>
          <div style={{ fontSize: '0.85rem', color: '#bfdbfe' }}>
            Everest Textile Mills Purchase Inquiries · Dispatch to Mill Gate
          </div>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={loadSupplierOrders}
          style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}
        >
          <RefreshCw size={14} className={loading ? "spin-animate" : ""} /> Sync Purchase Orders
        </button>
      </div>

      <div className="card-panel">
        <div className="panel-header">
          <span className="panel-title">
            <Truck size={18} color="#2563eb" /> Yarn Purchase Orders from Everest Textile Mills
          </span>
          <span className="panel-subtitle">
            Ship with exact Order Number, Material Type, and Pantone shade
          </span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Material Type</th>
                  <th>Pantone Colour</th>
                  <th>Quantity Ordered (kg)</th>
                  <th>Received at Mill Gate</th>
                  <th>Rate (₹/kg)</th>
                  <th>Total PO Value</th>
                  <th>Status</th>
                  <th>Raised Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      No active purchase orders found for this supplier.
                    </td>
                  </tr>
                ) : (
                  orders.map(o => (
                    <tr key={o.order_no} style={{ background: o.status === 'not_supplied' ? '#fffdf7' : 'transparent' }}>
                      <td><strong style={{ color: '#0f2744' }}>{o.order_no}</strong></td>
                      <td><strong>{o.type_name}</strong></td>
                      <td>
                        <span className="color-chip" style={{ backgroundColor: o.hex_value || '#ccc' }} />
                        {o.colour_name}
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{o.pantone_code}</div>
                      </td>
                      <td><strong style={{ fontSize: '0.95rem' }}>{o.quantity} kg</strong></td>
                      <td>{o.received_kg || 0} kg</td>
                      <td>₹{o.price_per_kg}</td>
                      <td style={{ fontWeight: 600, color: '#1e3a8a' }}>
                        ₹{(o.quantity * o.price_per_kg).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${o.status === 'supplied' ? 'badge-green' : 'badge-yellow'}`}>
                          {o.status === 'supplied' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {o.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{o.ordered_at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
