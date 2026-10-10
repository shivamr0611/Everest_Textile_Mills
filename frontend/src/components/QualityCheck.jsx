import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Search, ShieldAlert, BarChart2, X, ClipboardCheck 
} from 'lucide-react';
import { api } from '../api';

export default function QualityCheck({
  rolls = [],
  onRefresh,
  readOnly = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [qcStatusFilter, setQcStatusFilter] = useState('ALL');
  const [selectedRoll, setSelectedRoll] = useState(null);

  // Inspection modal state (Module F3)
  const [qcResult, setQcResult] = useState('passed');
  const [defectType, setDefectType] = useState('hole');
  const [qcNotes, setQcNotes] = useState('');
  const [submittingQc, setSubmittingQc] = useState(false);

  // Defect summary state (Module F5)
  const [defectSummary, setDefectSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    loadDefectSummary();
  }, []);

  const loadDefectSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await api.getQCDefectSummary();
      setDefectSummary(data);
    } catch (err) {
      console.error("Failed to load defect summary", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSubmitInspection = async (e) => {
    e.preventDefault();
    if (!selectedRoll) return;

    if ((qcResult === 'rework' || qcResult === 'rejected') && !defectType) {
      alert("Defect type is mandatory for rework or rejected results");
      return;
    }

    setSubmittingQc(true);
    try {
      await api.submitQC({
        roll_id: selectedRoll.roll_id,
        result: qcResult,
        defect_type: qcResult === 'passed' ? null : defectType,
        notes: qcNotes.trim()
      });
      setSelectedRoll(null);
      setQcNotes('');
      onRefresh();
      loadDefectSummary();
    } catch (err) {
      alert("Error submitting QC inspection: " + err.message);
    } finally {
      setSubmittingQc(false);
    }
  };

  const getQcBadge = (status) => {
    switch (status) {
      case 'passed':
        return <span className="badge badge-green"><CheckCircle2 size={12} /> Passed</span>;
      case 'pending':
        return <span className="badge badge-yellow">Pending QC</span>;
      case 'rework':
        return <span className="badge badge-red"><AlertTriangle size={12} /> Rework</span>;
      case 'rejected':
        return <span className="badge badge-red"><XCircle size={12} /> Rejected</span>;
      default:
        return <span className="badge badge-blue">{status}</span>;
    }
  };

  const filteredRolls = rolls.filter(r => {
    const matchesSearch = 
      r.roll_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(r.order_id).includes(searchTerm);
    const matchesStatus = qcStatusFilter === 'ALL' || r.qc_status === qcStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Top Defect Traceability Summary (Module F5) */}
      <div className="card-panel">
        <div className="panel-header">
          <span className="panel-title">
            <BarChart2 size={18} color="#2563eb" /> Defect Traceability by Machine (Module F5)
          </span>
          <span className="panel-subtitle">
            Cross-links every rejected/rework roll to its origin machine to pinpoint production flaws
          </span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loadingSummary ? (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <RefreshCw size={20} className="spin-animate" color="#2563eb" />
            </div>
          ) : defectSummary.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#059669', fontSize: '0.85rem' }}>
              <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Zero recorded machine defects! All inspected fabric rolls meet premium quality standards.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Machine Origin</th>
                    <th>Stage</th>
                    <th>Defect Type Encountered</th>
                    <th>Defect Count</th>
                    <th>Severity / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {defectSummary.map((ds, idx) => (
                    <tr key={idx}>
                      <td><strong>{ds.machine_name}</strong></td>
                      <td style={{ textTransform: 'capitalize' }}>{ds.stage}</td>
                      <td style={{ textTransform: 'capitalize', color: '#b91c1c', fontWeight: 600 }}>
                        {ds.defect_type?.replace('_', ' ')}
                      </td>
                      <td><strong>{ds.defect_count} roll(s)</strong></td>
                      <td>
                        <span className="badge badge-red">Needs Tuning / Check</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rolls Inspection Table (Module F1-F4) */}
      <div className="card-panel">
        <div className="panel-header">
          <div>
            <span className="panel-title">
              <ClipboardCheck size={18} color="#2563eb" /> Fabric Rolls Quality Check (QC Inspector)
            </span>
            <div className="panel-subtitle">
              Every roll has unique code, order & machine traceability · Passed rolls move to Finished Goods Store
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text"
                className="form-control"
                placeholder="Search roll code, order..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2rem', width: '220px', fontSize: '0.82rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '0.65rem', color: '#94a3b8' }} />
            </div>

            <select 
              className="form-control"
              style={{ width: '160px', fontSize: '0.82rem' }}
              value={qcStatusFilter}
              onChange={(e) => setQcStatusFilter(e.target.value)}
            >
              <option value="ALL">All QC Statuses</option>
              <option value="pending">Pending QC</option>
              <option value="passed">Passed</option>
              <option value="rework">Rework</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Code</th>
                  <th>Order #</th>
                  <th>Buyer</th>
                  <th>Machine Source</th>
                  <th>Weight (kg)</th>
                  <th>Produced At</th>
                  <th>QC Status</th>
                  <th>Store Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRolls.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No fabric rolls found. Dyeing completion automatically creates fabric rolls here!
                    </td>
                  </tr>
                ) : (
                  filteredRolls.map(r => (
                    <tr key={r.roll_id}>
                      <td><strong>{r.roll_code}</strong></td>
                      <td>Order #{r.order_id}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.machine_name}</td>
                      <td><strong>{r.weight_kg} kg</strong></td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.produced_at}</td>
                      <td>{getQcBadge(r.qc_status)}</td>
                      <td>
                        <span className={`badge ${
                          r.store_status === 'in_stock' ? 'badge-blue' :
                          r.store_status === 'dispatched' ? 'badge-navy' : 'badge-yellow'
                        }`}>
                          {r.store_status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {!readOnly ? (
                          <button 
                            className={`btn btn-sm ${r.qc_status === 'pending' ? 'btn-primary' : 'btn-outline-blue'}`}
                            onClick={() => {
                              setSelectedRoll(r);
                              setQcResult(r.qc_status === 'pending' ? 'passed' : r.qc_status);
                            }}
                          >
                            {r.qc_status === 'pending' ? 'Inspect Roll' : 'Re-Inspect'}
                          </button>
                        ) : (
                          <span className="badge badge-gray" style={{fontSize:'0.7rem'}}>View Only</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* QC Inspection Modal (Module F3) */}
      {selectedRoll && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <span className="modal-title">
                QC Inspection: Roll {selectedRoll.roll_code} ({selectedRoll.weight_kg} kg)
              </span>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedRoll(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitInspection}>
              <div className="modal-body">
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                  <div>Order: <strong>#{selectedRoll.order_id} ({selectedRoll.customer_name})</strong></div>
                  <div>Traceability Origin: <strong>{selectedRoll.machine_name}</strong></div>
                  <div>Material: <strong>{selectedRoll.type_name} ({selectedRoll.colour_name})</strong></div>
                </div>

                <div className="form-group">
                  <label className="form-label">Inspection Verdict *</label>
                  <select 
                    className="form-control"
                    value={qcResult}
                    onChange={(e) => setQcResult(e.target.value)}
                    required
                  >
                    <option value="passed">Passed (Move to Finished Goods Shelf / in_stock)</option>
                    <option value="rework">Rework (Return to Production Floor)</option>
                    <option value="rejected">Rejected (Discard / Exclude from Dispatch)</option>
                  </select>
                </div>

                {(qcResult === 'rework' || qcResult === 'rejected') && (
                  <div className="form-group">
                    <label className="form-label" style={{ color: '#b91c1c' }}>
                      Defect Type (Mandatory for Rework/Reject) *
                    </label>
                    <select 
                      className="form-control"
                      value={defectType}
                      onChange={(e) => setDefectType(e.target.value)}
                      required
                    >
                      <option value="hole">Hole in Fabric</option>
                      <option value="colour_mismatch">Colour Mismatch (Off Pantone Spec)</option>
                      <option value="uneven_weaving">Uneven Weaving Pattern</option>
                      <option value="other">Other Surface / Tension Defect</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Inspector Observations / Notes</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Enter visual inspection details, GSM, selvedge observations..."
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedRoll(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingQc}>
                  {submittingQc ? 'Recording QC...' : 'Save Inspection Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
