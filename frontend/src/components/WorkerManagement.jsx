import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, Clock, UserPlus, Trash2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const ROLE_LABELS = {
  production_worker: 'Production Worker',
  maintenance: 'Maintenance Worker',
  inspection: 'QC Inspector',
  accountant: 'Accountant',
  gate_attendant: 'Gate Attendant',
  manager: 'Mill Manager',
  assistant_manager: 'Assistant Manager',
};

export default function WorkerManagement({ currentUser }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('pending'); // 'pending' | 'all' | 'add'
  const [msg, setMsg] = useState(null);

  // Add internal user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState(currentUser.role === 'admin' ? 'manager' : 'assistant_manager');
  const [showPw, setShowPw] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendRes, allRes] = await Promise.all([
        fetch('/api/users/pending').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
      ]);
      setPendingUsers(Array.isArray(pendRes) ? pendRes : []);
      setAllUsers(Array.isArray(allRes) ? allRes : []);
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to load user data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, action) => {
    try {
      const res = await fetch(`/api/users/${userId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: `Worker ${action}d successfully!` });
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (userId, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'User deleted.' });
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleAddInternal = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, phone: newPhone, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: data.message });
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewPhone('');
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setAddLoading(false);
    }
  };

  const ROLE_COLORS = {
    admin: '#0f2744', manager: '#1e3a8a', assistant_manager: '#2563eb',
    maintenance: '#0891b2', inspection: '#7c3aed', accountant: '#059669', gate_attendant: '#d97706',
    customer: '#64748b', supplier: '#64748b', pending_approval: '#f59e0b'
  };

  const tabStyle = (active) => ({
    padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.82rem',
    border: 'none', cursor: 'pointer', borderRadius: '6px',
    background: active ? '#2563eb' : '#f1f5f9',
    color: active ? '#fff' : '#475569'
  });

  const internalRoles = currentUser.role === 'admin'
    ? [{ value: 'manager', label: 'Mill Manager' }]
    : [{ value: 'assistant_manager', label: 'Assistant Manager' }];

  const activeUsers = allUsers.filter(u => u.status === 'active' && !['customer', 'supplier'].includes(u.role));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f2744', margin: 0 }}>
          <Users size={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {currentUser.role === 'admin' ? 'Manager Management' : 'Worker & Staff Management'}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {currentUser.role === 'assistant_manager' && (
            <button style={tabStyle(tab === 'pending')} onClick={() => setTab('pending')}>
              Pending Approval {pendingUsers.length > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '0 5px', marginLeft: 4, fontSize: '0.7rem' }}>{pendingUsers.length}</span>}
            </button>
          )}
          <button style={tabStyle(tab === 'all')} onClick={() => setTab('all')}>All Staff</button>
          {currentUser.role !== 'admin' && <button style={tabStyle(tab === 'add')} onClick={() => setTab('add')}>+ Add Asst. Manager</button>}
        </div>
      </div>

      {msg && (
        <div style={{
          marginBottom: '1rem', padding: '0.65rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem',
          background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: msg.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          {msg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      {/* Pending Approval Tab */}
      {tab === 'pending' && currentUser.role === 'assistant_manager' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f2744', marginBottom: '1rem' }}>
            <Clock size={16} style={{ marginRight: 6, color: '#f59e0b', verticalAlign: 'middle' }} />
            Pending Worker Registrations ({pendingUsers.length})
          </h3>
          {loading ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>Loading...</div>
          ) : pendingUsers.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem', fontSize: '0.88rem' }}>
              No pending registrations.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Name', 'Email', 'Role', 'Applied', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(u => (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#0f2744' }}>{u.name}</td>
                      <td style={{ padding: '0.65rem 0.8rem', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <span style={{
                          background: '#eff6ff', color: '#1e3a8a', padding: '0.2rem 0.5rem',
                          borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                        }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem', color: '#94a3b8', fontSize: '0.78rem' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: '#16a34a', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}
                            onClick={() => handleApprove(u.user_id, 'approve')}
                          >
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: '#dc2626', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}
                            onClick={() => handleApprove(u.user_id, 'reject')}
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Staff Tab */}
      {tab === 'all' && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f2744', marginBottom: '1rem' }}>
            Active Internal Staff ({activeUsers.length})
          </h3>
          {loading ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '1.5rem' }}>Loading...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map(u => (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.8rem', fontWeight: 600, color: '#0f2744' }}>{u.name}</td>
                      <td style={{ padding: '0.65rem 0.8rem', color: '#475569' }}>{u.email}</td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <span style={{
                          background: '#eff6ff', color: ROLE_COLORS[u.role] || '#1e3a8a',
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700
                        }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 600 }}>● Active</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.8rem' }}>
                        {u.user_id !== currentUser.user_id && (
                          <button
                            className="btn btn-sm"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}
                            onClick={() => handleDelete(u.user_id, u.name)}
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Internal User Tab */}
      {tab === 'add' && (
        <div className="card" style={{ maxWidth: '500px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f2744', marginBottom: '1rem' }}>
            <UserPlus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Create {currentUser.role === 'admin' ? 'Manager' : 'Assistant Manager'} Account
          </h3>
          <form onSubmit={handleAddInternal}>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.3rem' }}>Role</label>
              <select className="form-control" value={newRole} onChange={e => setNewRole(e.target.value)}>
                {internalRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.3rem' }}>Full Name *</label>
              <input className="form-control" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.3rem' }}>Email *</label>
              <input type="email" className="form-control" placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: '0.85rem', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.3rem' }}>Password *</label>
              <input type={showPw ? 'text' : 'password'} className="form-control" placeholder="Set password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ paddingRight: '2.25rem' }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '0.75rem', top: '1.95rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f2744', marginBottom: '0.3rem' }}>Phone (Optional)</label>
              <input type="tel" className="form-control" placeholder="+91 00000 00000" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={addLoading} style={{ width: '100%' }}>
              {addLoading ? 'Creating...' : `Create ${ROLE_LABELS[newRole] || newRole} Account`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
