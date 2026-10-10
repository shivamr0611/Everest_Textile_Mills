import React, { useState } from 'react';
import { 
  Activity, CheckCircle2, Clock, Play, UserCheck, 
  Layers, ArrowRight, RefreshCw, AlertCircle, Users, Check,
  UserPlus, FileText
} from 'lucide-react';
import { api } from '../api';

export default function ProductionFloor({
  factoryData = {},
  workers = [],
  onRefresh,
  readOnly = false
}) {
  const queuedJobs = factoryData.queued_jobs || [];
  const runningMachines = factoryData.running_machines || [];
  const kgToday = factoryData.kg_today_total || 0;

  // Active top tab: 'assign' or 'log'
  const [activeTab, setActiveTab] = useState('assign');

  // Assign form state
  const [assignJobId, setAssignJobId] = useState('');
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignMsg, setAssignMsg] = useState(null);

  // Production log form state
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(workers[0]?.worker_id || '');
  const [selectedShift, setSelectedShift] = useState('morning');
  const [kgProduced, setKgProduced] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);

  // Flash state for inline assignment in table
  const [recentlySavedJobId, setRecentlySavedJobId] = useState(null);

  // Filter running jobs
  const runningJobs = queuedJobs.filter(j => j.status === 'running');

  // Handle explicit job assignment
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignJobId) {
      alert("Please select a fabrication job to assign");
      return;
    }

    setAssignSubmitting(true);
    setAssignMsg(null);
    try {
      await api.assignJobWorker(parseInt(assignJobId), assignWorkerId ? parseInt(assignWorkerId) : null);
      const chosenWorker = workers.find(w => w.worker_id === parseInt(assignWorkerId));
      const workerName = chosenWorker ? chosenWorker.name : 'Unassigned';
      setAssignMsg({
        type: 'success',
        text: `Successfully assigned ${workerName} to Job #${assignJobId}!`
      });
      onRefresh();
    } catch (err) {
      setAssignMsg({ type: 'error', text: err.message });
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Handle logging production
  const handleLogProduction = async (e) => {
    e.preventDefault();
    if (!selectedJobId || !kgProduced || parseFloat(kgProduced) <= 0) {
      alert("Please select a running job and enter positive kg produced");
      return;
    }

    setSubmitting(true);
    setResultMsg(null);
    try {
      const res = await api.logProduction({
        job_id: parseInt(selectedJobId),
        worker_id: selectedWorker ? parseInt(selectedWorker) : null,
        shift: selectedShift,
        kg_produced: parseFloat(kgProduced)
      });
      setResultMsg({
        type: 'success',
        text: `Logged ${kgProduced} kg! Progress: ${res.result.done_kg} / ${res.result.target_kg} kg.` +
              (res.result.completed ? " Fabrication completed! Order moved to Quality Check (QC)." : "")
      });
      setKgProduced('');
      onRefresh();
    } catch (err) {
      setResultMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Inline table assignment
  const handleInlineAssignWorker = async (jobId, workerId) => {
    try {
      await api.assignJobWorker(jobId, workerId ? parseInt(workerId) : null);
      setRecentlySavedJobId(jobId);
      setTimeout(() => setRecentlySavedJobId(null), 3000);
      onRefresh();
    } catch (err) {
      alert("Failed to assign worker: " + err.message);
    }
  };

  const selectedAssignJob = queuedJobs.find(j => j.job_id === parseInt(assignJobId));

  return (
    <div>
      {/* Live Floor Output Banner */}
      <div style={{ 
        background: '#ffffff', 
        border: '1px solid #dbeafe', 
        borderRadius: '10px', 
        padding: '1.25rem 1.5rem', 
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f2744' }}>
              {kgToday.toLocaleString()} kg Produced Today
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Single Fabrication Stage — Monitored by Assistant Manager
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>
              {runningJobs.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Fabricating Now</div>
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#d97706' }}>
              {queuedJobs.filter(j => j.status === 'queued').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Queued (FIFO)</div>
          </div>
        </div>
      </div>

      {/* Action Switcher Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('assign')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: activeTab === 'assign' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: activeTab === 'assign' ? '#eff6ff' : '#ffffff',
                color: activeTab === 'assign' ? '#1e40af' : '#475569',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <UserPlus size={16} /> Assign Worker to Job
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('log')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: activeTab === 'log' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: activeTab === 'log' ? '#eff6ff' : '#ffffff',
                color: activeTab === 'log' ? '#1e40af' : '#475569',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <FileText size={16} /> Record Shift Output (Kg)
            </button>
          </>
        )}
        {readOnly && (
          <div style={{ padding: '0.5rem 1rem', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', fontSize: '0.82rem', color: '#854d0e' }}>
            👁 View-only mode — Admin can view production data but cannot assign workers or log kg.
          </div>
        )}
      </div>

      {/* TAB 1: ASSIGN WORKER TO JOB */}
      {activeTab === 'assign' && (
        <div className="card-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #2563eb' }}>
          <div className="panel-header">
            <div>
              <span className="panel-title">
                <UserPlus size={18} color="#2563eb" /> Assign Worker to Fabrication Job
              </span>
              <div className="panel-subtitle">Select any queued or running job on the floor and assign a floor worker</div>
            </div>
          </div>
          <div className="panel-body">
            {assignMsg && (
              <div className={`alert-banner ${assignMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '1rem' }}>
                {assignMsg.text}
              </div>
            )}

            <form onSubmit={handleAssignSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Select Fabrication Job *</label>
                  <select 
                    className="form-control"
                    value={assignJobId}
                    onChange={(e) => {
                      setAssignJobId(e.target.value);
                      const j = queuedJobs.find(x => x.job_id === parseInt(e.target.value));
                      if (j && j.assigned_worker_id) {
                        setAssignWorkerId(j.assigned_worker_id);
                      }
                    }}
                    required
                  >
                    <option value="">-- Choose Fabrication Job --</option>
                    {queuedJobs.map(j => (
                      <option key={j.job_id} value={j.job_id}>
                        Job #{j.job_id} · Order #{j.order_id} · {j.type_name || 'Fabrication'} ({j.status.toUpperCase()}) {j.assigned_worker_name ? `[Worker: ${j.assigned_worker_name}]` : '[Unassigned]'}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {queuedJobs.length === 0 ? "No active fabrication jobs on the floor." : "Includes all active running and queued jobs"}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Floor Worker *</label>
                  <select 
                    className="form-control"
                    value={assignWorkerId}
                    onChange={(e) => setAssignWorkerId(e.target.value)}
                  >
                    <option value="">-- Select Worker (or Unassign) --</option>
                    {workers.map(w => (
                      <option key={w.worker_id} value={w.worker_id}>
                        {w.name} {w.role ? `(${w.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedAssignJob && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.75rem 1rem', 
                  background: '#f8fafc', 
                  borderRadius: '6px', 
                  fontSize: '0.82rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>Job #{selectedAssignJob.job_id} Details:</strong> Order #{selectedAssignJob.order_id} · Target: {selectedAssignJob.target_kg} kg · Status: 
                    <span className="badge badge-blue" style={{ marginLeft: '0.4rem' }}>{selectedAssignJob.status}</span>
                  </div>
                  <div>
                    Current Assignment: <strong>{selectedAssignJob.assigned_worker_name || 'Unassigned'}</strong>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={assignSubmitting || !assignJobId}
                >
                  {assignSubmitting ? 'Assigning...' : 'Assign Worker to Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: RECORD SHIFT OUTPUT */}
      {activeTab === 'log' && (
        <div className="card-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #16a34a' }}>
          <div className="panel-header">
            <div>
              <span className="panel-title">
                <FileText size={18} color="#16a34a" /> Record Fabrication Shift Output
              </span>
              <div className="panel-subtitle">Log kg produced against active running fabrication job</div>
            </div>
          </div>
          <div className="panel-body">
            {resultMsg && (
              <div className={`alert-banner ${resultMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '1rem' }}>
                {resultMsg.text}
              </div>
            )}

            <form onSubmit={handleLogProduction}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Active Running Job *</label>
                  <select 
                    className="form-control"
                    value={selectedJobId}
                    onChange={(e) => {
                      setSelectedJobId(e.target.value);
                      const j = runningJobs.find(x => x.job_id === parseInt(e.target.value));
                      if (j && j.assigned_worker_id) {
                        setSelectedWorker(j.assigned_worker_id);
                      }
                    }}
                    required
                  >
                    <option value="">-- Select Active Running Job --</option>
                    {runningJobs.map(j => (
                      <option key={j.job_id} value={j.job_id}>
                        Job #{j.job_id} · Order #{j.order_id} · Progress ({j.done_kg}/{j.target_kg} kg)
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {runningJobs.length === 0 ? "No fabrication jobs currently running." : "Only active running jobs can log output"}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Floor Worker *</label>
                  <select 
                    className="form-control"
                    value={selectedWorker}
                    onChange={(e) => setSelectedWorker(e.target.value)}
                    required
                  >
                    {workers.map(w => (
                      <option key={w.worker_id} value={w.worker_id}>
                        {w.name} {w.role ? `(${w.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Work Shift *</label>
                  <select 
                    className="form-control"
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    required
                  >
                    <option value="morning">Morning Shift (06:00 - 14:00)</option>
                    <option value="evening">Evening Shift (14:00 - 22:00)</option>
                    <option value="night">Night Shift (22:00 - 06:00)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Fabric Output (kg) *</label>
                  <input 
                    type="number"
                    step="0.1"
                    min="0.5"
                    className="form-control"
                    placeholder="e.g. 50.0"
                    value={kgProduced}
                    onChange={(e) => setKgProduced(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={submitting || runningJobs.length === 0}
                >
                  {submitting ? 'Updating Production...' : 'Submit Output & Update Progress'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assistant Manager Fabrication Assignment & Status Table */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <span className="panel-title">
              <Clock size={18} color="#2563eb" /> Fabrication Floor Jobs &amp; Worker Assignment
            </span>
            <div className="panel-subtitle">
              Assistant Manager checks if fabrication is assigned to someone or if it is completed
            </div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Order #</th>
                  <th>Process</th>
                  <th>Material &amp; Colour</th>
                  <th>Progress (kg)</th>
                  <th>Status</th>
                  <th>Assigned Worker</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queuedJobs.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No queued or running fabrication jobs.
                    </td>
                  </tr>
                ) : (
                  queuedJobs.map(j => (
                    <tr key={j.job_id} style={{ background: j.status === 'running' ? '#f0fdf4' : 'transparent' }}>
                      <td><strong>J-{j.job_id}</strong></td>
                      <td><strong>Order #{j.order_id}</strong></td>
                      <td>
                        <span className="badge badge-blue">Fabrication</span>
                      </td>
                      <td>{j.type_name} {j.colour_name ? `(${j.colour_name})` : ''}</td>
                      <td>
                        <strong>{j.done_kg}</strong> / {j.target_kg} kg
                        <div className="progress-bar-container" style={{ width: '100px' }}>
                          <div 
                            className="progress-bar-fill" 
                            style={{ width: `${Math.min(100, Math.round((j.done_kg / j.target_kg) * 100))}%` }} 
                          />
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${j.status === 'running' ? 'badge-blue' : j.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
                          {j.status === 'running' ? <Play size={10} /> : j.status === 'completed' ? <Check size={10} /> : <Clock size={10} />}
                          {j.status === 'completed' ? 'Done' : j.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto', minWidth: '130px' }}
                            value={j.assigned_worker_id || ''}
                            onChange={(e) => handleInlineAssignWorker(j.job_id, e.target.value)}
                          >
                            <option value="">-- Unassigned --</option>
                            {workers.map(w => (
                              <option key={w.worker_id} value={w.worker_id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                          {recentlySavedJobId === j.job_id && (
                            <span style={{ color: '#16a34a', fontSize: '0.75rem', fontWeight: 700 }}>
                              ✓ Saved
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-sm btn-outline-blue"
                            onClick={() => {
                              setAssignJobId(j.job_id.toString());
                              if (j.assigned_worker_id) {
                                setAssignWorkerId(j.assigned_worker_id.toString());
                              }
                              setActiveTab('assign');
                              window.scrollTo({ top: 150, behavior: 'smooth' });
                            }}
                          >
                            Assign
                          </button>

                          {j.status === 'running' && (
                            <button 
                              className="btn btn-sm btn-outline-green"
                              onClick={() => {
                                setSelectedJobId(j.job_id.toString());
                                if (j.assigned_worker_id) {
                                  setSelectedWorker(j.assigned_worker_id);
                                }
                                setActiveTab('log');
                                window.scrollTo({ top: 150, behavior: 'smooth' });
                              }}
                            >
                              Log Kg
                            </button>
                          )}
                        </div>
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
  );
}
