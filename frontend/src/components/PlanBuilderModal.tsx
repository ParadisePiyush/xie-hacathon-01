import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck,
  Fuel,
  Info,
  Loader2,
  Navigation,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { Depot, Plan, Vehicle } from '../api/types';

interface PlanBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanGenerated: (plan: Plan) => void;
  depots: Depot[];
  openRequestsCount: number;
}

export const PlanBuilderModal: React.FC<PlanBuilderModalProps> = ({
  isOpen,
  onClose,
  onPlanGenerated,
  depots,
  openRequestsCount,
}) => {
  const [planDate, setPlanDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedDepotId, setSelectedDepotId] = useState<string>('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load vehicles when opened
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setGeneratedPlan(null);

    const loadVehicles = async () => {
      try {
        setIsLoadingVehicles(true);
        const data = await apiClient.getVehicles();
        setVehicles(data);
        // Select all active vehicles by default
        const activeIds = data.filter((v) => v.is_active).map((v) => v.id);
        setSelectedVehicleIds(activeIds);
      } catch (err: any) {
        console.error('Failed to load vehicles:', err);
        setError('Failed to load vehicles from fleet repository');
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    loadVehicles();

    if (depots.length > 0 && !selectedDepotId) {
      setSelectedDepotId(depots[0].id);
    }
  }, [isOpen, depots]);

  if (!isOpen) return null;

  const toggleVehicle = (id: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((vId) => vId !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedVehicleIds.length === 0) {
      setError('Please select at least one vehicle to dispatch.');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      const plan = await apiClient.generatePlan({
        plan_date: planDate,
        vehicle_ids: selectedVehicleIds,
        depot_id: selectedDepotId || undefined,
      });
      setGeneratedPlan(plan);
      onPlanGenerated(plan);
    } catch (err: any) {
      console.error('Failed to generate plan:', err);
      setError(err.message || 'Optimization solver failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!generatedPlan) return;

    try {
      setIsPublishing(true);
      const updated = await apiClient.publishPlan(generatedPlan.id);
      setGeneratedPlan(updated);
      onPlanGenerated(updated);
    } catch (err: any) {
      console.error('Failed to publish plan:', err);
      setError(err.message || 'Failed to publish route plan.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '780px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
                Daily Route Optimization & Dispatch
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Solve Capacitated VRP with OR-Tools, Priority Penalties & Time Windows
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {error && (
            <div
              style={{
                background: 'var(--color-critical-bg)',
                color: 'var(--color-critical)',
                border: '1px solid #FCA5A5',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Info size={16} />
              <span>{error}</span>
            </div>
          )}

          {!generatedPlan ? (
            <>
              {/* Form Inputs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={15} color="var(--primary)" /> Plan Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Compass size={15} color="var(--primary)" /> Central Starting Depot
                  </label>
                  <select
                    className="form-input"
                    value={selectedDepotId}
                    onChange={(e) => setSelectedDepotId(e.target.value)}
                  >
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        🏢 {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Banner Info */}
              <div
                style={{
                  background: 'var(--primary-light)',
                  border: '1px solid #C7D2FE',
                  borderRadius: '12px',
                  padding: '0.85rem 1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.92rem' }}>
                    Candidate Requests Pool
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Pending, triaged, and scheduled waste pickup reports in queue
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {openRequestsCount} Stops
                </div>
              </div>

              {/* Fleet Selection */}
              <div className="form-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                    <Truck size={16} color="var(--primary)" /> Select Dispatch Fleet (
                    {selectedVehicleIds.length} of {vehicles.length} selected)
                  </label>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (selectedVehicleIds.length === vehicles.length) {
                        setSelectedVehicleIds([]);
                      } else {
                        setSelectedVehicleIds(vehicles.map((v) => v.id));
                      }
                    }}
                  >
                    {selectedVehicleIds.length === vehicles.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {isLoadingVehicles ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-light)' }}>
                    <Loader2 size={24} className="spin" />
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    {vehicles.map((v) => {
                      const isSelected = selectedVehicleIds.includes(v.id);
                      return (
                        <div
                          key={v.id}
                          onClick={() => toggleVehicle(v.id)}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                            background: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{v.plate}</span>
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: isSelected ? 'var(--primary)' : '#E2E8F0',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                              }}
                            >
                              {isSelected ? '✓' : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {v.team_name || 'Field Team'} • Shift: {v.shift_start.slice(0, 5)} - {v.shift_end.slice(0, 5)}
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                            Capacity: {v.capacity_units} units
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={onClose} disabled={isGenerating}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedVehicleIds.length === 0}
                  style={{ minWidth: '180px' }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="spin" /> Solving VRP...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Optimize & Generate
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Optimization Results View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* KPIs Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: generatedPlan.status === 'published' ? 'var(--color-low)' : 'var(--primary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {generatedPlan.status}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL DISTANCE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    {(generatedPlan.total_distance_m / 1000).toFixed(1)} km
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EST. DRIVE TIME</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                    {Math.round(generatedPlan.total_duration_s / 60)} mins
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.85rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>STOPS SCHEDULED</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-low)' }}>
                    {generatedPlan.routes.reduce((acc, r) => acc + r.stops.length, 0)} Stops
                  </div>
                </div>
              </div>

              {/* Unserved Warning if any */}
              {generatedPlan.unserved_request_ids && generatedPlan.unserved_request_ids.length > 0 && (
                <div
                  style={{
                    background: 'var(--color-medium-bg)',
                    border: '1px solid #FDE68A',
                    color: '#B45309',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Info size={16} />
                  <span>
                    <b>{generatedPlan.unserved_request_ids.length} lower-priority requests</b> were skipped due to vehicle
                    capacity / shift constraints. They remain safely queued in the backlog.
                  </span>
                </div>
              )}

              {/* Route Breakdown List */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.65rem' }}>Vehicle Route Assignments</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
                  {generatedPlan.routes.map((route, i) => (
                    <div
                      key={route.id}
                      style={{
                        padding: '0.85rem 1.15rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-sm)',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: ['#4F46E5', '#06B6D4', '#10B981', '#F97316'][i % 4],
                            }}
                          />
                          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                            Vehicle {route.vehicle_plate}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                          <span>
                            <Fuel size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                            {(route.distance_m / 1000).toFixed(1)} km
                          </span>
                          <span>
                            <Clock size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                            {Math.round(route.duration_s / 60)} mins
                          </span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {route.stops.length} stops
                          </span>
                        </div>
                      </div>

                      {/* Stops sequence pills */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {route.stops.map((stop) => (
                          <div
                            key={stop.id}
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              background: 'var(--bg-subtle)',
                              fontSize: '0.75rem',
                              color: 'var(--text-main)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                color: 'var(--primary)',
                              }}
                            >
                              #{stop.sequence}
                            </span>
                            <span>{stop.request.waste_type}</span>
                            <span style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>
                              ({stop.request.volume})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.5rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setGeneratedPlan(null)}
                  disabled={isPublishing}
                >
                  Adjust Parameters
                </button>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn-secondary" onClick={onClose}>
                    <Navigation size={16} /> View on Map
                  </button>

                  {generatedPlan.status !== 'published' ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handlePublish}
                      disabled={isPublishing}
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                      }}
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 size={16} className="spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          <FileCheck size={16} /> Publish Plan to Field
                        </>
                      )}
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: 'var(--color-low)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '10px',
                        background: 'var(--color-low-bg)',
                      }}
                    >
                      <CheckCircle2 size={18} /> Plan Active & Dispatched
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
