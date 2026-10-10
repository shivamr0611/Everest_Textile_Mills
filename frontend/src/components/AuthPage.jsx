import React, { useState } from 'react';
import { 
  Shield, ShoppingBag, Truck, Lock, Mail, User, Phone, LogIn, UserPlus, 
  AlertCircle, CheckCircle, Settings, Activity, ClipboardCheck, DollarSign, UserCheck
} from 'lucide-react';
import { api } from '../api';

const WORKER_ROLES = [
  { value: 'production_worker', label: 'Production Worker', icon: <Activity size={18} />, desc: 'Floor fabrication output' },
  { value: 'maintenance', label: 'Maintenance', icon: <Activity size={18} />, desc: 'Factory status & machines' },
  { value: 'inspection', label: 'QC Inspector', icon: <ClipboardCheck size={18} />, desc: 'Quality checking' },
  { value: 'accountant', label: 'Accountant', icon: <DollarSign size={18} />, desc: 'Finance & wages' },
  { value: 'gate_attendant', label: 'Gate Attendant', icon: <UserCheck size={18} />, desc: 'Yarn & gate entry' },
];

export default function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [portalType, setPortalType] = useState('internal'); // 'internal' | 'customer' | 'supplier'
  const [workerRole, setWorkerRole] = useState('maintenance');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const getRegisterRole = () => {
    if (portalType === 'customer') return 'customer';
    if (portalType === 'supplier') return 'supplier';
    return workerRole;
  };

  const resetForm = () => {
    setEmail(''); setPassword(''); setName(''); setPhone('');
    setErrorMsg(null); setSuccessMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'login') {
        const res = await api.login(email.trim(), password);
        onLoginSuccess(res.user);
      } else {
        const role = getRegisterRole();
        const res = await api.register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          phone: phone.trim()
        });
        if (res.pending) {
          setSuccessMsg(res.message);
          resetForm();
          setMode('login');
        } else {
          onLoginSuccess(res.user);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const btnStyle = (active) => ({
    flex: 1,
    padding: '0.85rem',
    fontSize: '0.875rem',
    fontWeight: 700,
    border: 'none',
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#1e3a8a' : '#64748b',
    borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem'
  });

  const portalBtnStyle = (active) => ({
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
    background: active ? '#eff6ff' : '#ffffff',
    color: active ? '#1e3a8a' : '#64748b',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    flex: 1,
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a2540 0%, #1e3a8a 50%, #0f2744 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'var(--font-family)'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(10, 37, 64, 0.45)',
        overflow: 'hidden',
        border: '1px solid #dbeafe'
      }}>
        {/* Brand Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f2744 0%, #1e3a8a 100%)',
          color: '#ffffff',
          padding: '2rem 1.75rem',
          textAlign: 'center',
          borderBottom: '3px solid #2563eb'
        }}>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
            EVEREST TEXTILE MILLS
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#bfdbfe', marginTop: '0.35rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Textile Manufacturing &amp; ERP System
          </p>
        </div>

        {/* Tab Toggle: Sign In / Register */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button onClick={() => { setMode('login'); resetForm(); }} style={btnStyle(mode === 'login')}>
            <LogIn size={16} /> Sign In
          </button>
          <button onClick={() => { setMode('register'); resetForm(); }} style={btnStyle(mode === 'register')}>
            <UserPlus size={16} /> Register Account
          </button>
        </div>

        <div style={{ padding: '1.75rem' }}>
          {/* Portal Type selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f2744', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              {mode === 'login' ? 'Select Portal:' : 'Registering As:'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <button type="button" onClick={() => setPortalType('internal')} style={portalBtnStyle(portalType === 'internal')}>
                <Shield size={18} color={portalType === 'internal' ? '#2563eb' : '#64748b'} />
                Internal Staff
              </button>
              <button type="button" onClick={() => setPortalType('customer')} style={portalBtnStyle(portalType === 'customer')}>
                <ShoppingBag size={18} color={portalType === 'customer' ? '#2563eb' : '#64748b'} />
                Customer
              </button>
              <button type="button" onClick={() => setPortalType('supplier')} style={portalBtnStyle(portalType === 'supplier')}>
                <Truck size={18} color={portalType === 'supplier' ? '#2563eb' : '#64748b'} />
                Supplier
              </button>
            </div>
          </div>

          {/* Worker role selector — only shown for internal + register */}
          {mode === 'register' && portalType === 'internal' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f2744', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                Worker Role:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {WORKER_ROLES.map(wr => (
                  <button
                    key={wr.value}
                    type="button"
                    onClick={() => setWorkerRole(wr.value)}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: workerRole === wr.value ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: workerRole === wr.value ? '#eff6ff' : '#ffffff',
                      color: workerRole === wr.value ? '#1e3a8a' : '#64748b',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      textAlign: 'center'
                    }}
                  >
                    {React.cloneElement(wr.icon, { color: workerRole === wr.value ? '#2563eb' : '#64748b' })}
                    {wr.label}
                    <span style={{ fontSize: '0.68rem', fontWeight: 400, color: '#94a3b8' }}>{wr.desc}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#fef3c7', borderRadius: '6px', fontSize: '0.75rem', color: '#92400e', border: '1px solid #fde68a' }}>
                ⚠️ Worker registrations require approval by the Assistant Manager before you can log in.
              </div>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
              padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem',
              marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
              padding: '0.75rem', borderRadius: '8px', fontSize: '0.82rem',
              marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.35rem' }}>
                  Full Name / Organization Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="text" className="form-control" placeholder="e.g. John Doe" value={name}
                    onChange={e => setName(e.target.value)} required style={{ paddingLeft: '2.25rem' }} />
                  <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.7rem', color: '#94a3b8' }} />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.35rem' }}>
                Email Address *
              </label>
              <div style={{ position: 'relative' }}>
                <input type="email" className="form-control" placeholder="name@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required style={{ paddingLeft: '2.25rem' }} />
                <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.7rem', color: '#94a3b8' }} />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.35rem' }}>
                Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input type="password" className="form-control" placeholder="Enter secure password" value={password}
                  onChange={e => setPassword(e.target.value)} required style={{ paddingLeft: '2.25rem' }} />
                <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.7rem', color: '#94a3b8' }} />
              </div>
            </div>

            {mode === 'register' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.35rem' }}>
                  Phone Number (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="tel" className="form-control" placeholder="+91 98765 43210" value={phone}
                    onChange={e => setPhone(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
                  <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.7rem', color: '#94a3b8' }} />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700 }}
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? `Sign In to ${portalType === 'internal' ? 'Internal' : portalType === 'customer' ? 'Customer' : 'Supplier'} Portal`
                : `Register as ${portalType === 'internal' ? WORKER_ROLES.find(r => r.value === workerRole)?.label : portalType === 'customer' ? 'Customer' : 'Supplier'}`
              }
            </button>
          </form>

          {/* Info note for internal login */}
          {mode === 'login' && portalType === 'internal' && (
            <div style={{
              marginTop: '1rem', padding: '0.6rem 0.75rem',
              background: '#eff6ff', borderRadius: '6px', fontSize: '0.75rem',
              color: '#1e3a8a', border: '1px solid #bfdbfe'
            }}>
              Admin, Manager, and Assistant Manager accounts are issued by mill management. 
              Workers can register above and await approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
