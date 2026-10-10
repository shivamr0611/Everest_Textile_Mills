import React, { useState } from 'react';
import { 
  Cpu, PlusCircle, AlertTriangle, CheckCircle2, Wrench, 
  Trash2, History, RefreshCw, X, ArrowRight, ShieldAlert, Activity 
} from 'lucide-react';
import { api } from '../api';

export default function FactoryStatusMachines({
  factoryData = {},
  onRefresh,
  readOnly = false
}) {
  const [activeTab, setActiveTab] = useState('status'); // 'status', 'add', 'removed'
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineDetail, setMachineDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add Machine form state (Module J1)
  const [newMachName, setNewMachName] = useState('');
  const [newMachStage, setNewMachStage] = useState('spinning');
  const [newMachCapacity, setNewMachCapacity] = useState('100.0');
  const [newMachDate, setNewMachDate] = useState(new Date().toISOString().slice(0, 10));
  const [addMachSubmitting, setAddMachSubmitting] = useState(false);
  const [addMachMsg, setAddMachMsg] = useState(null);

  // Remove Machine modal state (Module J4)
  const [removingMachine, setRemovingMachine] = useState(null);
  const [removalReason, setRemovalReason] = useState('');
  const [removingSubmitting, setRemovingSubmitting] = useState(false);

  // Removed machines state (Module J5)
  const [removedMachines, setRemovedMachines] = useState([]);
  const [loadingRemoved, setLoadingRemoved] = useState(false);

  const machines = factoryData.all_machines || [];
  const idleMachines = factoryData.idle_machines || [];
  const runningMachines = factoryData.running_machines || [];
  const breakdownMachines = factoryData.breakdown_machines || [];

  // Open Machine Detail (Module J2)
  const handleOpenDetail = async (m) => {
    setSelectedMachine(m);
    setLoadingDetail(true);
    setMachineDetail(null);
    try {
      const data = await api.getMachineDetail(m.machine_id);
      setMachineDetail(data);
    } catch (err) {
      alert("Failed to load machine detail: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Mark Breakdown or Repaired (Module J3)
  const handleStatusChange = async (machine_id, newStatus) => {
    try {
      await api.updateMachineStatus(machine_id, newStatus);
      if (selectedMachine && selectedMachine.machine_id === machine_id) {
        const updated = await api.getMachineDetail(machine_id);
        setMachineDetail(updated);
      }
      onRefresh();
    } catch (err) {
      alert("Error updating machine: " + err.message);
    }
  };

  // Add Machine (Module J1)
  const handleAddMachine = async (e) => {
    e.preventDefault();
    setAddMachSubmitting(true);
    setAddMachMsg(null);
    try {
      await api.addMachine({
        machine_name: newMachName.trim(),
        stage: newMachStage,
        capacity_kg_per_hr: parseFloat(newMachCapacity),
        installed_on: newMachDate
      });
      setAddMachMsg({ type: 'success', text: `Machine '${newMachName}' added successfully as 'idle'. FIFO assigner checked for waiting jobs.` });
      setNewMachName('');
      onRefresh();
    } catch (err) {
      setAddMachMsg({ type: 'error', text: err.message });
    } finally {
      setAddMachSubmitting(false);
    }
  };

  // Remove Machine (Module J4)
  const handleConfirmRemove = async (e) => {
    e.preventDefault();
    if (!removalReason.trim()) {
      alert("Please enter a removal reason");
      return;
    }
    setRemovingSubmitting(true);
    try {
      await api.removeMachine(removingMachine.machine_id, removalReason.trim());
      setRemovingMachine(null);
      setRemovalReason('');
      onRefresh();
    } catch (err) {
      alert("Failed to remove machine: " + err.message);
    } finally {
      setRemovingSubmitting(false);
    }
  };

  // Fetch Removed Machines (Module J5)
  const handleLoadRemoved = async () => {
    setActiveTab('removed');
    setLoadingRemoved(true);
    try {
      const data = await api.getRemovedMachines();
      setRemovedMachines(data);
    } catch (err) {
      alert("Failed to load removed machines: " + err.message);
    } finally {
      setLoadingRemoved(false);
    }
  };

  return (
    <div>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'status' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('status')}
        >
          <Activity size={16} /> Factory Status (Module E4)
        </button>
        {!readOnly && (
          <button 
            className={`btn ${activeTab === 'add' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('add')}
          >
            <PlusCircle size={16} /> Add Machine (Module J1)
          </button>
        )}
        <button 
          className={`btn ${activeTab === 'removed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleLoadRemoved}
        >
          <History size={16} /> Removed Machines History (Module J5)
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: LIVE FACTORY STATUS (Module E4)                    */}
      {/* ========================================================= */}
      {activeTab === 'status' && (
        <div>
          {/* Daily Total Ribbon */}
          <div style={{ 
            background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', 
            color: '#ffffff', 
            padding: '1rem 1.5rem', 
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
                Live Floor Production Total (Module E6)
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                {(factoryData.kg_today_total || 0).toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500 }}>kg produced today</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{runningMachines.length}</div>
                <div style={{ fontSize: '0.75rem', color: '#bfdbfe' }}>RUNNING</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{idleMachines.length}</div>
                <div style={{ fontSize: '0.75rem', color: '#bfdbfe' }}>IDLE</div>
              </div>
            </div>
          </div>

          {/* Active Running Machines */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <Cpu size={18} color="#2563eb" /> Active Floor Machines (Fabrication)
              </span>
              <span className="panel-subtitle">Click any machine to inspect full metrics & event history</span>
            </div>
            <div className="panel-body">
              <div className="machine-cards-grid">
                {machines.map(m => (
                  <div key={m.machine_id} className={`machine-card ${m.status}`}>
                    <div>
                      <div className="machine-header">
                        <div>
                          <div className="machine-name">{m.machine_name}</div>
                          <div className="machine-stage">Stage: {m.stage}</div>
                        </div>
                        <span className={`badge ${
                          m.status === 'running' ? 'badge-blue' :
                          m.status === 'idle' ? 'badge-green' :
                          m.status === 'breakdown' ? 'badge-red' : 'badge-navy'
                        }`}>
                          {m.status}
                        </span>
                      </div>

                      {m.status === 'running' && m.job_id ? (
                        <div style={{ margin: '0.5rem 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#334155' }}>
                            <span>Order #{m.order_id} ({m.stage})</span>
                            <span><strong>{m.done_kg}</strong> / {m.target_kg} kg</span>
                          </div>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${Math.min(100, m.progress_pct)}%` }} />
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                            {m.progress_pct}% done
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '0.5rem 0', color: '#059669', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <CheckCircle2 size={16} /> Free &amp; Idle — Ready for FIFO assignment
                        </div>
                      )}

                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Today's Output: <strong>{m.kg_today} kg</strong>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button 
                        className="btn btn-sm btn-outline-blue"
                        onClick={() => handleOpenDetail(m)}
                      >
                        Inspect Details
                      </button>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {m.status === 'idle' && !readOnly && (
                          <button 
                            className="btn btn-sm btn-secondary"
                            title="Remove Machine (Requires reason)"
                            onClick={() => setRemovingMachine(m)}
                          >
                            <Trash2 size={12} color="#dc2626" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CLEAR SEPARATE IDLE MACHINES SECTION (Section 5.6 rule 5 & Module E4) */}
          <div className="card-panel">
            <div className="panel-header">
              <span className="panel-title">
                <CheckCircle2 size={18} color="#059669" /> Idle Machines List (Module E4)
              </span>
              <span className="panel-subtitle">
                Machines currently awaiting orders in their stage queue
              </span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Machine Name</th>
                      <th>Stage</th>
                      <th>Capacity (kg/hr)</th>
                      <th>Output Today</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idleMachines.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No machines are currently idle. All functional machines are running!
                        </td>
                      </tr>
                    ) : (
                      idleMachines.map(m => (
                        <tr key={m.machine_id}>
                          <td><strong>{m.machine_name}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{m.stage}</td>
                          <td>{m.capacity_kg_per_hr ? `${m.capacity_kg_per_hr} kg/hr` : '—'}</td>
                          <td>{m.kg_today} kg</td>
                          <td>
                            <span className="badge badge-green">Idle (Ready)</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button 
                                className="btn btn-sm btn-outline-blue"
                                onClick={() => handleOpenDetail(m)}
                              >
                                Detail
                              </button>
                              {!readOnly && (
                                <button 
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => handleStatusChange(m.machine_id, 'breakdown')}
                                  title="Mark as Breakdown"
                                >
                                  Mark Break
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
      )}

      {/* ========================================================= */}
      {/* TAB 2: ADD MACHINE FORM (Module J1)                       */}
      {/* ========================================================= */}
      {activeTab === 'add' && (
        <div className="card-panel">
          <div className="panel-header">
            <span className="panel-title">
              <PlusCircle size={18} color="#2563eb" /> Module J1: Add New Machine to Mill
            </span>
            <span className="panel-subtitle">Starts as idle, appears on Factory Status immediately & triggers FIFO assigner</span>
          </div>
          <div className="panel-body">
            {addMachMsg && (
              <div className={`alert-banner ${addMachMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                {addMachMsg.text}
              </div>
            )}

            <form onSubmit={handleAddMachine}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Machine Name (Unique) *</label>
                  <input 
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ring Spinning Frame #4 (SP-04)"
                    value={newMachName}
                    onChange={(e) => setNewMachName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Manufacturing Stage *</label>
                  <select 
                    className="form-control"
                    value={newMachStage}
                    onChange={(e) => setNewMachStage(e.target.value)}
                    required
                  >
                    <option value="fabrication">Fabrication</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Capacity (kg per hour) [Optional]</label>
                  <input 
                    type="number"
                    step="0.1"
                    className="form-control"
                    placeholder="e.g. 120.0"
                    value={newMachCapacity}
                    onChange={(e) => setNewMachCapacity(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Installation Date</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={newMachDate}
                    onChange={(e) => setNewMachDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={addMachSubmitting}>
                  {addMachSubmitting ? 'Registering...' : 'Install & Start as Idle (Runs FIFO)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: REMOVED MACHINES HISTORY (Module J5)               */}
      {/* ========================================================= */}
      {activeTab === 'removed' && (
        <div className="card-panel">
          <div className="panel-header">
            <span className="panel-title">
              <History size={18} color="#2563eb" /> Removed Machines (Soft Delete History - Module J5)
            </span>
            <span className="panel-subtitle">Removed machines never get assigned work, but past production & QC records are preserved</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {loadingRemoved ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <RefreshCw size={24} className="spin-animate" color="#2563eb" />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Machine Name</th>
                      <th>Stage</th>
                      <th>Installed On</th>
                      <th>Removed On</th>
                      <th>Removal Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {removedMachines.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          No machines have been removed from service.
                        </td>
                      </tr>
                    ) : (
                      removedMachines.map(rm => (
                        <tr key={rm.machine_id}>
                          <td><strong>{rm.machine_name}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{rm.stage}</td>
                          <td>{rm.installed_on}</td>
                          <td style={{ color: '#dc2626', fontWeight: 500 }}>{rm.removed_on}</td>
                          <td><em>{rm.removal_reason}</em></td>
                          <td>
                            <span className="badge badge-navy">Removed</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MACHINE DETAIL MODAL (Module J2)                          */}
      {/* ========================================================= */}
      {selectedMachine && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">
                  {selectedMachine.machine_name}
                </span>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Stage: {selectedMachine.stage.toUpperCase()} · Installed: {selectedMachine.installed_on}
                </div>
              </div>
              <button 
                className="btn btn-sm btn-secondary"
                onClick={() => { setSelectedMachine(null); setMachineDetail(null); }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw size={24} className="spin-animate" color="#2563eb" />
                </div>
              ) : machineDetail ? (
                <div>
                  {/* Summary Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Current Status</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, textTransform: 'capitalize', color: '#0f2744' }}>
                        {machineDetail.status}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Output Today</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2563eb' }}>
                        {machineDetail.kg_today} kg
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Output This Month</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e3a8a' }}>
                        {machineDetail.kg_month} kg
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Breakdowns</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626' }}>
                        {machineDetail.breakdowns}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>QC Defect Rate</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: machineDetail.defect_rate_pct > 5 ? '#dc2626' : '#059669' }}>
                        {machineDetail.defect_rate_pct}%
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        ({machineDetail.defective_rolls} of {machineDetail.total_rolls} rolls)
                      </div>
                    </div>
                  </div>

                  {/* Actions for this machine */}
                  <div style={{ background: '#eff6ff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e3a8a' }}>
                      Quick Controls:
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {machineDetail.status === 'running' && (
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleStatusChange(machineDetail.machine_id, 'breakdown')}
                        >
                          Mark Breakdown (Return Job to Queue)
                        </button>
                      )}
                      {machineDetail.status === 'breakdown' && (
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleStatusChange(machineDetail.machine_id, 'idle')}
                        >
                          Mark Repaired (Return to Idle)
                        </button>
                      )}
                      {(machineDetail.status === 'idle' || machineDetail.status === 'breakdown') && (
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setRemovingMachine(machineDetail);
                            setSelectedMachine(null);
                          }}
                        >
                          Soft Delete Machine
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dated Event History (Module J2 requirement) */}
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
                      Dated Event History (Audit Trail)
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Event</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {machineDetail.events?.map(ev => (
                            <tr key={ev.event_id}>
                              <td style={{ color: '#64748b' }}>{ev.event_at}</td>
                              <td>
                                <span className={`badge ${
                                  ev.event_type === 'breakdown' ? 'badge-red' :
                                  ev.event_type === 'repaired' ? 'badge-green' :
                                  ev.event_type === 'job_started' ? 'badge-blue' : 'badge-navy'
                                }`}>
                                  {ev.event_type}
                                </span>
                              </td>
                              <td>{ev.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => { setSelectedMachine(null); setMachineDetail(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* REMOVE MACHINE MODAL (Module J4)                          */}
      {/* ========================================================= */}
      {removingMachine && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ color: '#dc2626' }}>
                Confirm Machine Removal: {removingMachine.machine_name}
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => setRemovingMachine(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleConfirmRemove}>
              <div className="modal-body">
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                  A removed machine will no longer appear on Factory Status and will never receive FIFO jobs.
                  Historical output, logs and QC defects will be preserved.
                </p>

                <div className="form-group">
                  <label className="form-label">Mandatory Removal Reason *</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="e.g. Obsolete motor, permanently decommissioned or sold."
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRemovingMachine(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={removingSubmitting}>
                  {removingSubmitting ? 'Removing...' : 'Confirm Soft Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
