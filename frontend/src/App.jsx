import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AuthPage from './components/AuthPage';
import CompanyDashboard from './components/CompanyDashboard';
import YarnManagement from './components/YarnManagement';
import BuyerOrdersManagement from './components/BuyerOrdersManagement';
import FactoryStatusMachines from './components/FactoryStatusMachines';
import ProductionFloor from './components/ProductionFloor';
import QualityCheck from './components/QualityCheck';
import FinishedGoodsDispatch from './components/FinishedGoodsDispatch';
import WorkersFinance from './components/WorkersFinance';
import CustomerPortal from './components/CustomerPortal';
import SupplierPortal from './components/SupplierPortal';
import WorkerManagement from './components/WorkerManagement';
import CheckInOut from './components/CheckInOut';
import { api } from './api';

import {
  LayoutDashboard, Package, ShoppingCart, Cpu,
  Activity, ClipboardCheck, Truck, DollarSign,
  Users, Settings
} from 'lucide-react';

// ─── Role → which nav tabs are shown ───────────────────────────────────────
const ROLE_TABS = {
  admin: ['dashboard', 'yarn', 'orders', 'machines', 'production', 'qc', 'dispatch', 'finance', 'manage'],
  manager: ['dashboard', 'yarn', 'orders', 'dispatch', 'manage'],
  assistant_manager: ['dashboard', 'production', 'manage'],
  production_worker: ['production'],
  maintenance: ['machines'],
  inspection: ['qc'],
  accountant: ['finance'],
  gate_attendant: ['yarn'],
};

const TAB_CONFIG = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { key: 'yarn', label: 'Yarn & Gate Entry', icon: <Package size={16} /> },
  { key: 'orders', label: 'Buyer Orders', icon: <ShoppingCart size={16} /> },
  { key: 'machines', label: 'Factory Status & Machines', icon: <Cpu size={16} /> },
  { key: 'production', label: 'Production Floor', icon: <Activity size={16} /> },
  { key: 'qc', label: 'Quality Check (QC)', icon: <ClipboardCheck size={16} /> },
  { key: 'dispatch', label: 'Store & Dispatch', icon: <Truck size={16} /> },
  { key: 'finance', label: 'Workers & Finance', icon: <DollarSign size={16} /> },
  { key: 'manage', label: 'Manage Staff', icon: <Users size={16} /> },
];

// Worker roles that get a check-in/out button
const WORKER_ROLES = ['production_worker', 'maintenance', 'inspection', 'accountant', 'gate_attendant'];

export default function App() {
  // Persist session across browser reloads
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('everest_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('everest_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [yarnSubTab, setYarnSubTab] = useState('stock');
  const [prefillYarnOrder, setPrefillYarnOrder] = useState(null);

  // Global data states
  const [factoryData, setFactoryData] = useState({});
  const [stockAlerts, setStockAlerts] = useState([]);
  const [yarnStock, setYarnStock] = useState([]);
  const [yarnOrders, setYarnOrders] = useState([]);
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [storeData, setStoreData] = useState({});
  const [financeData, setFinanceData] = useState(null);
  const [colours, setColours] = useState([]);
  const [yarnTypes, setYarnTypes] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [users, setUsers] = useState([]);

  const refreshAllData = async () => {
    if (!currentUser) return;
    const role = currentUser.role;
    try {
      // Always load colours/yarn types for context
      const [colRes, ytRes] = await Promise.all([
        api.getColours().catch(() => []),
        api.getYarnTypes().catch(() => []),
      ]);
      setColours(colRes);
      setYarnTypes(ytRes);

      // Role-specific data loads
      if (['admin', 'manager', 'assistant_manager'].includes(role)) {
        const [factRes, alertsRes, stockRes, yoRes, boRes, rollsRes, storeRes, finRes, wkRes, uRes] = await Promise.all([
          api.getFactoryStatus().catch(() => ({})),
          api.getStockAlerts().catch(() => []),
          api.getStock().catch(() => []),
          api.getYarnOrders().catch(() => []),
          api.getBuyerOrders().catch(() => []),
          api.getRolls().catch(() => []),
          api.getStore().catch(() => ({})),
          api.getMonthlyReport(new Date().toISOString().slice(0, 7)).catch(() => null),
          api.getWorkers().catch(() => []),
          api.getUsers().catch(() => []),
        ]);
        setFactoryData(factRes); setStockAlerts(alertsRes); setYarnStock(stockRes);
        setYarnOrders(yoRes); setBuyerOrders(boRes); setRolls(rollsRes);
        setStoreData(storeRes); setFinanceData(finRes); setWorkers(wkRes); setUsers(uRes);
      } else if (role === 'maintenance') {
        const factRes = await api.getFactoryStatus().catch(() => ({}));
        setFactoryData(factRes);
      } else if (role === 'inspection') {
        const rollsRes = await api.getRolls().catch(() => []);
        setRolls(rollsRes);
      } else if (role === 'accountant') {
        const [wkRes, finRes, yoRes, boRes] = await Promise.all([
          api.getWorkers().catch(() => []),
          api.getMonthlyReport(new Date().toISOString().slice(0, 7)).catch(() => null),
          api.getYarnOrders().catch(() => []),
          api.getBuyerOrders().catch(() => []),
        ]);
        setWorkers(wkRes); setFinanceData(finRes); setYarnOrders(yoRes); setBuyerOrders(boRes);
      } else if (role === 'gate_attendant') {
        const [stockRes, alertsRes, yoRes] = await Promise.all([
          api.getStock().catch(() => []),
          api.getStockAlerts().catch(() => []),
          api.getYarnOrders().catch(() => []),
        ]);
        setYarnStock(stockRes); setStockAlerts(alertsRes); setYarnOrders(yoRes);
      }
    } catch (err) {
      console.error('Data refresh error:', err);
    }
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    try { localStorage.setItem('everest_tab', tabKey); } catch {}
  };

  useEffect(() => {
    if (currentUser) {
      const tabs = ROLE_TABS[currentUser.role] || ['dashboard'];
      setActiveTab(prev => {
        const next = tabs.includes(prev) ? prev : tabs[0];
        try { localStorage.setItem('everest_tab', next); } catch {}
        return next;
      });
      refreshAllData();
    }
  }, [currentUser]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try { localStorage.setItem('everest_user', JSON.stringify(user)); } catch {}
    const tabs = ROLE_TABS[user.role] || ['dashboard'];
    const initialTab = tabs[0];
    setActiveTab(initialTab);
    try { localStorage.setItem('everest_tab', initialTab); } catch {}
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('everest_user');
      localStorage.removeItem('everest_tab');
    } catch {}
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (!currentUser) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  const handleOpenOrderShortfall = (shortfallInfo) => {
    setPrefillYarnOrder(shortfallInfo);
    setActiveTab('yarn');
    setYarnSubTab('order');
  };

  const suppliers = users.filter(u => u.role === 'supplier');
  const customers = users.filter(u => u.role === 'customer');
  const role = currentUser.role;

  // Customer / Supplier: no nav bar, direct portal
  if (role === 'customer') {
    return (
      <div className="app-layout">
        <Header currentUser={currentUser} onLogout={handleLogout} />
        <main className="main-content">
          <CustomerPortal currentUser={currentUser} colours={colours} yarnTypes={yarnTypes} />
        </main>
        <AppFooter />
      </div>
    );
  }

  if (role === 'supplier') {
    return (
      <div className="app-layout">
        <Header currentUser={currentUser} onLogout={handleLogout} />
        <main className="main-content">
          <SupplierPortal currentUser={currentUser} />
        </main>
        <AppFooter />
      </div>
    );
  }

  // Worker roles with single page view + check-in/out
  if (WORKER_ROLES.includes(role)) {
    return (
      <div className="app-layout">
        <Header currentUser={currentUser} onLogout={handleLogout} />
        <main className="main-content">
          <CheckInOut currentUser={currentUser} />
          {role === 'production_worker' && (
            <ProductionFloor factoryData={factoryData} workers={workers} onRefresh={refreshAllData} />
          )}
          {role === 'maintenance' && (
            <FactoryStatusMachines factoryData={factoryData} onRefresh={refreshAllData} />
          )}
          {role === 'inspection' && (
            <QualityCheck rolls={rolls} onRefresh={refreshAllData} />
          )}
          {role === 'accountant' && (
            <WorkersFinance
              workers={workers}
              yarnOrders={yarnOrders}
              buyerOrders={buyerOrders}
              onRefresh={refreshAllData}
              hideAttendance
            />
          )}
          {role === 'gate_attendant' && (
            <YarnManagement
              activeSubTab={yarnSubTab}
              yarnStock={yarnStock}
              yarnOrders={yarnOrders}
              stockAlerts={stockAlerts}
              colours={colours}
              yarnTypes={yarnTypes}
              suppliers={suppliers}
              onRefresh={refreshAllData}
              prefillYarnOrder={prefillYarnOrder}
              onClearPrefill={() => setPrefillYarnOrder(null)}
              gateOnly
            />
          )}
        </main>
        <AppFooter />
      </div>
    );
  }

  // Admin / Manager / Assistant Manager — tab-based layout
  const allowedTabs = ROLE_TABS[role] || ['dashboard'];
  const visibleTabs = TAB_CONFIG.filter(t => allowedTabs.includes(t.key));

  // Ensure activeTab is in allowed list
  const safeTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];

  return (
    <div className="app-layout">
      <Header currentUser={currentUser} onLogout={handleLogout} />

      <nav className="nav-bar">
        <div className="nav-container">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              className={`nav-tab ${safeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                handleTabChange(tab.key);
                if (tab.key === 'yarn') setYarnSubTab('stock');
              }}
            >
              {tab.icon} {tab.label}
              {tab.key === 'yarn' && stockAlerts.length > 0 && (
                <span className="badge badge-red" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>
                  {stockAlerts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="main-content">
        {/* DASHBOARD — read-only for admin; full for manager/assistant_manager */}
        {safeTab === 'dashboard' && (
          <CompanyDashboard
            factoryData={factoryData}
            stockAlerts={stockAlerts}
            storeData={storeData}
            financeData={financeData}
            buyerOrders={buyerOrders}
            yarnOrders={yarnOrders}
            readOnly={role === 'admin'}
            onRefresh={refreshAllData}
            onNavigate={(tab, sub) => {
              handleTabChange(tab);
              if (sub) setYarnSubTab(sub);
            }}
            onOpenOrderShortfall={role !== 'admin' ? handleOpenOrderShortfall : undefined}
          />
        )}

        {/* YARN — manager and gate_attendant (gate_attendant handled above) */}
        {safeTab === 'yarn' && (
          <YarnManagement
            activeSubTab={yarnSubTab}
            yarnStock={yarnStock}
            yarnOrders={yarnOrders}
            stockAlerts={stockAlerts}
            colours={colours}
            yarnTypes={yarnTypes}
            suppliers={suppliers}
            onRefresh={refreshAllData}
            prefillYarnOrder={prefillYarnOrder}
            onClearPrefill={() => setPrefillYarnOrder(null)}
            hideGate={role === 'manager'}
            readOnly={role === 'admin'}
          />
        )}

        {/* BUYER ORDERS — manager */}
        {safeTab === 'orders' && (
          <BuyerOrdersManagement
            buyerOrders={buyerOrders}
            colours={colours}
            yarnTypes={yarnTypes}
            customers={customers}
            onRefresh={refreshAllData}
            onOpenOrderShortfall={role !== 'admin' ? handleOpenOrderShortfall : undefined}
            readOnly={role === 'admin'}
          />
        )}

        {/* MACHINES */}
        {safeTab === 'machines' && (
          <FactoryStatusMachines factoryData={factoryData} onRefresh={refreshAllData} readOnly={role === 'admin'} />
        )}

        {/* PRODUCTION FLOOR */}
        {safeTab === 'production' && (
          <ProductionFloor factoryData={factoryData} workers={workers} onRefresh={refreshAllData} readOnly={role === 'admin'} />
        )}

        {/* QC */}
        {safeTab === 'qc' && (
          <QualityCheck rolls={rolls} onRefresh={refreshAllData} readOnly={role === 'admin'} />
        )}

        {/* STORE & DISPATCH */}
        {safeTab === 'dispatch' && (
          <FinishedGoodsDispatch storeData={storeData} buyerOrders={buyerOrders} onRefresh={refreshAllData} readOnly={role === 'admin'} />
        )}

        {/* FINANCE */}
        {safeTab === 'finance' && (
          <WorkersFinance workers={workers} yarnOrders={yarnOrders} buyerOrders={buyerOrders} onRefresh={refreshAllData} readOnly={role === 'admin'} />
        )}

        {/* MANAGE STAFF — admin adds managers, manager adds asst_managers, asst_manager approves workers */}
        {safeTab === 'manage' && (
          <WorkerManagement currentUser={currentUser} />
        )}
      </main>

      <AppFooter />
    </div>
  );
}

function AppFooter() {
  return (
    <footer style={{
      borderTop: '1px solid #dbeafe',
      background: '#ffffff',
      padding: '1.25rem',
      textAlign: 'center',
      fontSize: '0.8rem',
      color: '#64748b'
    }}>
      <div><strong>Everest Textile Mills</strong> · Manufacturing &amp; ERP Operations System</div>
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#94a3b8' }}>
        Blue &amp; White Theme · All Quantities in <strong>kg</strong> · RCOD Specification Compliant
      </div>
    </footer>
  );
}
