import React from 'react';
import { Shield, ShoppingBag, Truck, UserCheck, Settings, ClipboardCheck, DollarSign, LogOut, Activity } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Mill Manager',
  assistant_manager: 'Asst. Manager',
  production_worker: 'Production Worker',
  maintenance: 'Maintenance',
  inspection: 'QC Inspector',
  accountant: 'Accountant',
  gate_attendant: 'Gate Attendant',
  customer: 'Customer',
  supplier: 'Supplier',
};

const ROLE_ICONS = {
  admin: <Shield size={14} />,
  manager: <Settings size={14} />,
  assistant_manager: <UserCheck size={14} />,
  production_worker: <Activity size={14} />,
  maintenance: <Activity size={14} />,
  inspection: <ClipboardCheck size={14} />,
  accountant: <DollarSign size={14} />,
  gate_attendant: <UserCheck size={14} />,
  customer: <ShoppingBag size={14} />,
  supplier: <Truck size={14} />,
};

export default function Header({ currentUser, onLogout }) {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand-section">
          <div>
            <h1 className="brand-title">EVEREST TEXTILE MILLS</h1>
            <div className="brand-subtitle">
              Textile Manufacturing &amp; ERP System · Unit: <strong>kg</strong>
            </div>
          </div>
        </div>

        <div className="header-controls">
          {/* User profile & Role Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#bfdbfe' }}>
                {currentUser.email}
              </div>
            </div>

            <div className="role-badge">
              {ROLE_ICONS[currentUser.role] || <UserCheck size={14} />}
              <span>{ROLE_LABELS[currentUser.role] || currentUser.role?.toUpperCase()}</span>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            className="btn btn-sm btn-secondary"
            onClick={onLogout}
            title="Sign Out of Everest Textile Mills"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

