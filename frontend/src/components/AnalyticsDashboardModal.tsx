import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Truck,
  X,
} from 'lucide-react';
import { apiClient } from '../api/client';
import type { AnalyticsSummary, TeamProductivity } from '../api/types';

interface AnalyticsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsDashboardModal: React.FC<AnalyticsDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [teams, setTeams] = useState<TeamProductivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [sumData, teamData] = await Promise.all([
        apiClient.getAnalyticsSummary(),
        apiClient.getTeamProductivity(),
      ]);
      setSummary(sumData);
      setTeams(teamData);
    } catch (err: any) {
      console.error('Failed to load analytics metrics:', err);
      setError(err.message || 'Failed to fetch analytics metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMetrics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    window.open(apiClient.getExportUrl(), '_blank');
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '920px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
                Operations Telemetry & Performance Analytics
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                SLA compliance, routing efficiency gains & crew productivity
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCSV}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
              title="Download CSV Report"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={loadMetrics}
              title="Refresh Analytics"
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                background: 'var(--color-critical-bg)',
                color: 'var(--color-critical)',
                border: '1px solid #FCA5A5',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {isLoading || !summary ? (
            <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-light)' }}>
              <Loader2 size={36} className="spin" style={{ margin: '0 auto 1rem' }} />
              <p>Aggregating operations KPIs and SLA metrics...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 4 Hero KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.85rem',
                }}
              >
                {/* 1. Backlog */}
                <div
                  style={{
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '1rem',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    ACTIVE BACKLOG
                  </div>
                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--primary)',
                      lineHeight: 1.2,
                      marginTop: '0.2rem',
                    }}
                  >
                    {summary.open_backlog}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                    of {summary.total_requests} total reports ({summary.collected_requests} collected)
                  </div>
                </div>

                {/* 2. SLA Compliance */}
                <div
                  style={{
                    background: 'var(--color-low-bg)',
                    border: '1.5px solid #A7F3D0',
                    borderRadius: '14px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857' }}>
                    SLA COMPLIANCE
                  </div>
                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-heading)',
                      color: '#059669',
                      lineHeight: 1.2,
                      marginTop: '0.2rem',
                    }}
                  >
                    {summary.sla_compliance_pct}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#065F46', marginTop: '0.2rem' }}>
                    <CheckCircle2 size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> Target: &gt;90%
                  </div>
                </div>

                {/* 3. Distance Saved */}
                <div
                  style={{
                    background: '#F0F9FF',
                    border: '1.5px solid #BAE6FD',
                    borderRadius: '14px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369A1' }}>
                    EST. KM SAVED
                  </div>
                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-heading)',
                      color: '#0284C7',
                      lineHeight: 1.2,
                      marginTop: '0.2rem',
                    }}
                  >
                    {summary.estimated_km_saved} km
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0C4A6E', marginTop: '0.2rem' }}>
                    <TrendingUp size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> +{summary.efficiency_gain_pct}% vs baseline
                  </div>
                </div>

                {/* 4. Avg Response Time */}
                <div
                  style={{
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    AVG RESPONSE TIME
                  </div>
                  <div
                    style={{
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--text-main)',
                      lineHeight: 1.2,
                      marginTop: '0.2rem',
                    }}
                  >
                    {Math.round(summary.avg_response_time_minutes)}m
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                    <Clock size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> From submission to dispatch
                  </div>
                </div>
              </div>

              {/* Distributions Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Priority Breakdown */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Flame size={16} color="var(--color-critical)" /> Priority Band Breakdown
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {Object.entries({
                      Critical: summary.priority_distribution.critical || 0,
                      High: summary.priority_distribution.high || 0,
                      Medium: summary.priority_distribution.medium || 0,
                      Low: summary.priority_distribution.low || 0,
                    }).map(([band, count]) => {
                      const pct = summary.total_requests > 0 ? (count / summary.total_requests) * 100 : 0;
                      const color =
                        band === 'Critical'
                          ? '#EF4444'
                          : band === 'High'
                          ? '#F97316'
                          : band === 'Medium'
                          ? '#F59E0B'
                          : '#10B981';
                      return (
                        <div key={band}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontWeight: 600 }}>{band}</span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {count} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div style={{ height: '6px', width: '100%', background: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Waste Type Breakdown */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} color="var(--primary)" /> Waste Material Categories
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {Object.entries(summary.waste_type_distribution).map(([type, count]) => {
                      const pct = summary.total_requests > 0 ? (count / summary.total_requests) * 100 : 0;
                      return (
                        <div key={type}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{type}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{count} items</span>
                          </div>
                          <div style={{ height: '6px', width: '100%', background: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-gradient)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Field Crew Productivity Table */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Truck size={16} color="#059669" /> Field Response Crew Productivity
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                    Active Vehicles: {teams.reduce((acc, t) => acc + t.active_vehicles, 0)}
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-app)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Response Team</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Assigned Fleet</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Stops Completed</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Distance Driven</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Total Drive Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => (
                        <tr key={t.team_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{t.team_name}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{t.active_vehicles} vehicle(s)</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#059669' }}>
                            {t.stops_completed} of {t.stops_scheduled}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{t.total_distance_km.toFixed(1)} km</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>{Math.round(t.total_drive_time_minutes)} mins</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
