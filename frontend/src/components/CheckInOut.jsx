import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, CheckCircle } from 'lucide-react';
import { api } from '../api';

export default function CheckInOut({ currentUser }) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    loadTodayStatus();
  }, []);

  const loadTodayStatus = async () => {
    try {
      const res = await fetch(`/api/attendance/user/${currentUser.user_id}?date=${today}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.check_in_time) {
          setCheckedIn(true);
          setCheckInTime(data.check_in_time);
          setTodayRecord(data);
        }
      }
    } catch (err) {
      console.error('Could not load attendance status:', err);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.user_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      setCheckedIn(true);
      setCheckInTime(new Date().toLocaleTimeString());
      setMsg({ type: 'success', text: 'Checked in successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.user_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-out failed');
      setMsg({ type: 'success', text: 'Checked out successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #2563eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="#2563eb" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f2744' }}>Daily Attendance</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {today} — {checkedIn ? <span style={{ color: '#16a34a' }}>✓ Checked In {checkInTime ? `at ${checkInTime}` : ''}</span> : <span style={{ color: '#dc2626' }}>Not checked in</span>}
            </div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {!checkedIn ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCheckIn}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <LogIn size={14} />
              {loading ? 'Checking In...' : 'Check In'}
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={handleCheckOut}
              disabled={loading}
              style={{
                background: '#dc2626', color: '#fff', border: 'none',
                display: 'flex', alignItems: 'center', gap: '0.35rem'
              }}
            >
              <LogOut size={14} />
              {loading ? 'Checking Out...' : 'Check Out'}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div style={{
          marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem',
          background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: msg.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {msg.type === 'success' ? <CheckCircle size={13} style={{ marginRight: 4 }} /> : null}
          {msg.text}
        </div>
      )}
    </div>
  );
}
