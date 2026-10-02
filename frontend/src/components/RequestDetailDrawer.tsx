import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import type { PickupRequest, RequestStatus } from '../api/types';

interface RequestDetailDrawerProps {
  request: PickupRequest | null;
  onClose: () => void;
  onTransition: (id: string, toStatus: RequestStatus, note?: string, reason?: string) => Promise<void>;
  onCancel: (id: string, reason: string) => Promise<void>;
}

export const RequestDetailDrawer: React.FC<RequestDetailDrawerProps> = ({
  request,
  onClose,
  onTransition,
  onCancel,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transitionNote, setTransitionNote] = useState('');
  const [promptAction, setPromptAction] = useState<'skip' | 'reject' | 'cancel' | null>(null);
  const [promptReason, setPromptReason] = useState('');

  if (!request) return null;

  const handleAction = async (status: RequestStatus) => {
    try {
      setIsProcessing(true);
      await onTransition(request.id, status, transitionNote);
      setTransitionNote('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReasonSubmit = async () => {
    if (!promptReason.trim()) {
      alert('A reason is required for this action.');
      return;
    }

    try {
      setIsProcessing(true);
      if (promptAction === 'cancel') {
        await onCancel(request.id, promptReason);
      } else if (promptAction === 'skip') {
        await onTransition(request.id, 'skipped', undefined, promptReason);
      } else if (promptAction === 'reject') {
        await onTransition(request.id, 'rejected', undefined, promptReason);
      }
      setPromptAction(null);
      setPromptReason('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366F1' }}>
              REQUEST #{request.id.slice(0, 8)}
            </div>
            <h3 style={{ fontSize: '1.2rem', marginTop: '0.15rem' }}>Pickup Stop Details</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Priority Score Banner */}
          <div
            style={{
              padding: '1.1rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background:
                request.priority_band === 'critical'
                  ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
                  : request.priority_band === 'high'
                  ? 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)'
                  : 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
              border: `1px solid ${
                request.priority_band === 'critical'
                  ? '#FCA5A5'
                  : request.priority_band === 'high'
                  ? '#FDBA74'
                  : '#86EFAC'
              }`,
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>
                Priority Assessment
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'Outfit' }}>
                {Math.round(request.priority_score)}{' '}
                <span style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  / 100
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Band: {request.priority_band}
              </div>
            </div>

            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  request.priority_band === 'critical' ? '#EF4444' : request.priority_band === 'high' ? '#F97316' : '#10B981',
                color: 'white',
              }}
            >
              <ShieldAlert size={26} />
            </div>
          </div>

          {/* Details Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <div>
                <div className="stat-label">Waste Type</div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{request.waste_type}</div>
              </div>
            </div>

            <div className="stat-card" style={{ padding: '0.75rem' }}>
              <div>
                <div className="stat-label">Volume Level</div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{request.volume}</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} color="#6366F1" />
              <span>
                <b>Location:</b> {request.address || `${request.latitude}, ${request.longitude}`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} color="#64748B" />
              <span>
                <b>Reporter:</b> {request.reporter_id || 'Citizen (Portal)'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} color="#059669" />
              <span>
                <b>SLA Target:</b>{' '}
                {request.sla_due_at
                  ? new Date(request.sla_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '48h standard'}
              </span>
            </div>

            {request.duplicate_of && (
              <div
                style={{
                  background: '#FFF1F2',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  color: '#BE123C',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginTop: '0.25rem',
                }}
              >
                ⚠️ Merged duplicate report. Primary stop ID: {request.duplicate_of.slice(0, 8)}
              </div>
            )}
          </div>

          {/* Action Prompt (Reason input for skip, reject, cancel) */}
          {promptAction ? (
            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Reason required to {promptAction.toUpperCase()}
              </h4>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder={`Provide reason for ${promptAction}...`}
                value={promptReason}
                onChange={(e) => setPromptReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <button
                  className="btn-primary"
                  style={{ background: '#EF4444', flex: 1 }}
                  onClick={handleReasonSubmit}
                  disabled={isProcessing}
                >
                  Confirm {promptAction}
                </button>
                <button className="btn-secondary" onClick={() => setPromptAction(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Workflow State Machine Actions */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                LIFECYCLE ACTIONS
              </div>

              {request.status === 'submitted' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleAction('verified')}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 size={16} /> Verify Request
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setPromptAction('reject')}
                    disabled={isProcessing}
                  >
                    Reject
                  </button>
                </div>
              )}

              {request.status === 'verified' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)' }}
                    onClick={() => handleAction('planned')}
                    disabled={isProcessing}
                  >
                    🚀 Assign to Plan
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setPromptAction('cancel')}
                    disabled={isProcessing}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {request.status === 'planned' && (
                <button
                  className="btn-primary"
                  style={{ width: '100%', background: '#0284C7' }}
                  onClick={() => handleAction('in_progress')}
                  disabled={isProcessing}
                >
                  🚛 Start Collection (In Progress)
                </button>
              )}

              {request.status === 'in_progress' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, background: '#10B981' }}
                    onClick={() => handleAction('collected')}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 size={16} /> Mark Collected
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ color: '#D97706' }}
                    onClick={() => setPromptAction('skip')}
                    disabled={isProcessing}
                  >
                    Skip Stop
                  </button>
                </div>
              )}

              {request.status === 'skipped' && (
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleAction('verified')}
                  disabled={isProcessing}
                >
                  🔄 Re-queue for Next Route
                </button>
              )}
            </div>
          )}

          {/* Audit History Timeline */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
              AUDIT TRAIL & HISTORY
            </div>

            <div className="timeline">
              {request.history && request.history.length > 0 ? (
                request.history.map((hist) => (
                  <div key={hist.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-title">
                      {hist.from_status ? `${hist.from_status} ➔ ` : ''}
                      <span style={{ color: '#4F46E5' }}>{hist.to_status}</span>
                    </div>
                    <div className="timeline-time">
                      {new Date(hist.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {hist.actor_id || 'System'}
                    </div>
                    {hist.note && <div className="timeline-note">{hist.note}</div>}
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>No recorded transitions yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
