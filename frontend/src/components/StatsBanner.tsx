import React from 'react';
import { AlertTriangle, Clock, Layers, ShieldAlert } from 'lucide-react';
import type { PickupRequest } from '../api/types';

interface StatsBannerProps {
  requests: PickupRequest[];
}

export const StatsBanner: React.FC<StatsBannerProps> = ({ requests }) => {
  const totalOpen = requests.filter(
    (r) => r.status !== 'collected' && r.status !== 'cancelled' && r.status !== 'rejected'
  ).length;

  const criticalCount = requests.filter((r) => r.priority_band === 'critical').length;
  const highCount = requests.filter((r) => r.priority_band === 'high').length;

  const avgPriority =
    requests.length > 0
      ? Math.round(requests.reduce((acc, r) => acc + r.priority_score, 0) / requests.length)
      : 0;

  return (
    <div className="stats-banner">
      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
          <Layers size={22} />
        </div>
        <div>
          <div className="stat-value" style={{ color: '#4F46E5' }}>{totalOpen}</div>
          <div className="stat-label">Active Backlog</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: '#FEF2F2', color: '#EF4444' }}>
          <ShieldAlert size={22} />
        </div>
        <div>
          <div className="stat-value" style={{ color: '#EF4444' }}>{criticalCount}</div>
          <div className="stat-label">Critical Urgent</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: '#FFF7ED', color: '#F97316' }}>
          <AlertTriangle size={22} />
        </div>
        <div>
          <div className="stat-value" style={{ color: '#F97316' }}>{highCount}</div>
          <div className="stat-label">High Priority</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: '#ECFDF5', color: '#10B981' }}>
          <Clock size={22} />
        </div>
        <div>
          <div className="stat-value" style={{ color: '#10B981' }}>{avgPriority} / 100</div>
          <div className="stat-label">Avg Urgency Score</div>
        </div>
      </div>
    </div>
  );
};
