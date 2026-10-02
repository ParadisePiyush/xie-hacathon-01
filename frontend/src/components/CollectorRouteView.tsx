import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Fuel,
  Loader2,
  MapPin,
  RefreshCw,
  SkipForward,
  Truck,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { PickupRequest, Route, RouteStop, Vehicle } from '../api/types';

interface CollectorRouteViewProps {
  onSelectRequest: (req: PickupRequest) => void;
  onRefreshMap: () => void;
}

export const CollectorRouteView: React.FC<CollectorRouteViewProps> = ({
  onSelectRequest,
  onRefreshMap,
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stop Action Modals / Prompts
  const [completingStop, setCompletingStop] = useState<RouteStop | null>(null);
  const [skippingStop, setSkippingStop] = useState<RouteStop | null>(null);
  const [proofPhotoUrl, setProofPhotoUrl] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Load vehicles on mount
  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const data = await apiClient.getVehicles();
        setVehicles(data);
        if (data.length > 0) {
          setSelectedVehicleId(data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load vehicles:', err);
      }
    };
    loadVehicles();
  }, []);

  // Load assigned route for chosen vehicle
  const loadRoute = async (vId: string) => {
    if (!vId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getMyRoute(vId);
      setRoute(data);
    } catch (err: any) {
      console.error('Failed to load vehicle route:', err);
      setRoute(null);
      setError('No active published route found for this vehicle today.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVehicleId) {
      loadRoute(selectedVehicleId);
    }
  }, [selectedVehicleId]);

  // Handle Stop Completion
  const handleConfirmComplete = async () => {
    if (!completingStop) return;
    try {
      setIsSubmittingAction(true);
      await apiClient.completeRouteStop(completingStop.id, {
        outcome: 'collected',
        proof_photo_url: proofPhotoUrl.trim() || undefined,
      });
      setCompletingStop(null);
      setProofPhotoUrl('');
      await loadRoute(selectedVehicleId);
      onRefreshMap();
    } catch (err: any) {
      alert(err.message || 'Failed to complete stop');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Stop Skip
  const handleConfirmSkip = async () => {
    if (!skippingStop || !skipReason.trim()) {
      alert('Please provide a reason for skipping this stop.');
      return;
    }
    try {
      setIsSubmittingAction(true);
      await apiClient.completeRouteStop(skippingStop.id, {
        outcome: 'skipped',
        reason: skipReason.trim(),
      });
      setSkippingStop(null);
      setSkipReason('');
      await loadRoute(selectedVehicleId);
      onRefreshMap();
    } catch (err: any) {
      alert(err.message || 'Failed to skip stop');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Progress metrics
  const totalStops = route?.stops.length || 0;
  const completedStops = route?.stops.filter((s) => s.outcome === 'collected').length || 0;
  const skippedStops = route?.stops.filter((s) => s.outcome === 'skipped').length || 0;
  const pendingStops = totalStops - completedStops - skippedStops;
  const progressPercent = totalStops > 0 ? Math.round(((completedStops + skippedStops) / totalStops) * 100) : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #FFFFFF, var(--bg-subtle))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <Truck size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>Collector Field Manifest</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Live execution, ETA guidance & proof logging
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Vehicle Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Vehicle:</span>
            <select
              className="form-input"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '180px' }}
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} ({v.capacity_units}u)
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-icon"
            onClick={() => loadRoute(selectedVehicleId)}
            title="Refresh Route"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Progress & Route Stats Bar */}
      {route && (
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--bg-app)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Route Progress: {completedStops}/{totalStops} Done ({progressPercent}%) • {pendingStops} Remaining
            </span>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>
                <Fuel size={13} style={{ display: 'inline', verticalAlign: '-1px' }} />{' '}
                {(route.distance_m / 1000).toFixed(1)} km
              </span>
              <span>
                <Clock size={13} style={{ display: 'inline', verticalAlign: '-1px' }} />{' '}
                {Math.round(route.duration_s / 60)} mins drive
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: '8px',
              width: '100%',
              background: '#E2E8F0',
              borderRadius: '999px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(completedStops / totalStops) * 100}%`,
                background: '#10B981',
                transition: 'width 0.3s ease',
              }}
            />
            <div
              style={{
                height: '100%',
                width: `${(skippedStops / totalStops) * 100}%`,
                background: '#F97316',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
            <p>Loading assigned field route...</p>
          </div>
        ) : error || !route ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3.5rem 1.5rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Compass size={28} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>No Published Route Assigned</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', maxWidth: '400px' }}>
                Use the Dispatcher view to optimize and publish a daily plan for this vehicle.
              </p>
            </div>
          </div>
        ) : route.stops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No stops assigned to this vehicle route.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {route.stops.map((stop) => {
              const isCollected = stop.outcome === 'collected';
              const isSkipped = stop.outcome === 'skipped';
              const isPending = !isCollected && !isSkipped;
              const req = stop.request;

              return (
                <div
                  key={stop.id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '14px',
                    border: `1.5px solid ${
                      isCollected
                        ? '#A7F3D0'
                        : isSkipped
                        ? '#FDBA74'
                        : 'var(--border-subtle)'
                    }`,
                    background: isCollected
                      ? 'var(--color-low-bg)'
                      : isSkipped
                      ? 'var(--color-high-bg)'
                      : 'var(--bg-card)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Stop Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: isCollected
                            ? '#10B981'
                            : isSkipped
                            ? '#F97316'
                            : 'var(--primary)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.9rem',
                        }}
                      >
                        {stop.sequence}
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                          onClick={() => onSelectRequest(req)}
                        >
                          <span>{req.address || `${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}`}</span>
                          <MapPin size={14} color="var(--primary)" />
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {req.waste_type.toUpperCase()} • Volume: <b>{req.volume}</b> • Score:{' '}
                          <b>{Math.round(req.priority_score)}</b>
                        </div>
                      </div>
                    </div>

                    {/* ETA or Outcome Badge */}
                    <div>
                      {isCollected && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: '#10B981',
                            color: 'white',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          <Check size={12} /> Collected
                        </span>
                      )}
                      {isSkipped && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: '#F97316',
                            color: 'white',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          <SkipForward size={12} /> Skipped
                        </span>
                      )}
                      {isPending && stop.eta && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          <Clock size={12} /> ETA:{' '}
                          {new Date(stop.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Outcome details if any */}
                  {isSkipped && stop.outcome_reason && (
                    <div style={{ fontSize: '0.78rem', color: '#C2410C', fontStyle: 'italic' }}>
                      Reason: "{stop.outcome_reason}"
                    </div>
                  )}

                  {/* Actions for Pending Stops */}
                  {isPending && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.6rem',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '0.6rem',
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: '1px solid #FDBA74',
                          color: '#C2410C',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        onClick={() => setSkippingStop(stop)}
                      >
                        <SkipForward size={14} /> Skip Stop
                      </button>

                      <button
                        type="button"
                        style={{
                          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                          border: 'none',
                          color: 'white',
                          padding: '0.35rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                        }}
                        onClick={() => setCompletingStop(stop)}
                      >
                        <CheckCircle2 size={14} /> Mark Collected
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete Modal */}
      {completingStop && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 color="#10B981" size={20} /> Complete Stop #{completingStop.sequence}
              </h3>
              <button className="modal-close-btn" onClick={() => setCompletingStop(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Confirming collection at <b>{completingStop.request.address || 'Location'}</b>.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Camera size={14} /> Proof Photo URL (Optional)
                </label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://images.example.com/proof-123.jpg"
                  value={proofPhotoUrl}
                  onChange={(e) => setProofPhotoUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCompletingStop(null)}
                  disabled={isSubmittingAction}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmComplete}
                  disabled={isSubmittingAction}
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)' }}
                >
                  {isSubmittingAction ? 'Saving...' : 'Confirm Collected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip Modal */}
      {skippingStop && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle color="#F97316" size={20} /> Skip Stop #{skippingStop.sequence}
              </h3>
              <button className="modal-close-btn" onClick={() => setSkippingStop(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Please provide the mandatory operational reason for skipping this scheduled pickup:
              </p>

              <div className="form-group">
                <label className="form-label">Skip Reason *</label>
                <select
                  className="form-input"
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                >
                  <option value="">-- Select Reason --</option>
                  <option value="Road blocked / inaccessible alley">Road blocked / inaccessible alley</option>
                  <option value="No waste found at designated location">No waste found at designated location</option>
                  <option value="Hazardous / unhandled material type">Hazardous / unhandled material type</option>
                  <option value="Vehicle capacity full">Vehicle capacity full</option>
                  <option value="Severe weather / safety hazard">Severe weather / safety hazard</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSkippingStop(null)}
                  disabled={isSubmittingAction}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmSkip}
                  disabled={isSubmittingAction || !skipReason}
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
                >
                  {isSubmittingAction ? 'Skipping...' : 'Confirm Skip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
