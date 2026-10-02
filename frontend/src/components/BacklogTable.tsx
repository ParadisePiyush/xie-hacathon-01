import React from 'react';
import { AlertCircle, Flame, MapPin, RefreshCw, Search } from 'lucide-react';
import type { PickupRequest, PriorityBand, RequestStatus, WasteType } from '../api/types';

interface BacklogTableProps {
  requests: PickupRequest[];
  selectedRequest: PickupRequest | null;
  onSelectRequest: (req: PickupRequest) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBand: PriorityBand | 'all';
  onBandChange: (band: PriorityBand | 'all') => void;
  selectedType: WasteType | 'all';
  onTypeChange: (type: WasteType | 'all') => void;
  selectedStatus: RequestStatus | 'all';
  onStatusChange: (status: RequestStatus | 'all') => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const BacklogTable: React.FC<BacklogTableProps> = ({
  requests,
  selectedRequest,
  onSelectRequest,
  searchQuery,
  onSearchChange,
  selectedBand,
  onBandChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  onRefresh,
  isLoading,
}) => {
  return (
    <div className="backlog-pane">
      <div className="filter-bar">
        <div className="filter-row">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by address, description, or ID..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <button
            className="btn-secondary"
            style={{ padding: '0.55rem 0.85rem' }}
            onClick={onRefresh}
            title="Refresh requests"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="filter-row">
          <select
            className="filter-select"
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as WasteType | 'all')}
          >
            <option value="all">All Waste Types</option>
            <option value="hazardous">Hazardous (Bio/Chem)</option>
            <option value="medical">Medical</option>
            <option value="e_waste">E-Waste</option>
            <option value="construction">Construction Debris</option>
            <option value="general">General Waste</option>
            <option value="recyclable">Recyclable</option>
            <option value="organic">Organic</option>
          </select>

          <select
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as RequestStatus | 'all')}
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="collected">Collected</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        <div className="priority-pills">
          <button
            className={`pill-btn ${selectedBand === 'all' ? 'active' : ''}`}
            onClick={() => onBandChange('all')}
            style={selectedBand === 'all' ? { background: '#4F46E5', color: 'white' } : {}}
          >
            All ({requests.length})
          </button>
          <button
            className={`pill-btn critical ${selectedBand === 'critical' ? 'active' : ''}`}
            onClick={() => onBandChange('critical')}
          >
            <Flame size={13} /> Critical
          </button>
          <button
            className={`pill-btn high ${selectedBand === 'high' ? 'active' : ''}`}
            onClick={() => onBandChange('high')}
          >
            <AlertCircle size={13} /> High
          </button>
          <button
            className={`pill-btn medium ${selectedBand === 'medium' ? 'active' : ''}`}
            onClick={() => onBandChange('medium')}
          >
            Medium
          </button>
          <button
            className={`pill-btn low ${selectedBand === 'low' ? 'active' : ''}`}
            onClick={() => onBandChange('low')}
          >
            Low
          </button>
        </div>
      </div>

      <div className="request-list-wrapper">
        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94A3B8' }}>
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>No pickup requests match filters</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Try clearing your search or status criteria.</p>
          </div>
        ) : (
          requests.map((req) => {
            const isSelected = selectedRequest?.id === req.id;
            return (
              <div
                key={req.id}
                className={`request-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectRequest(req)}
              >
                <div className="request-card-header">
                  <div className="request-type-badge">
                    <span>
                      {req.waste_type === 'hazardous' && '☣️'}
                      {req.waste_type === 'medical' && '💉'}
                      {req.waste_type === 'e_waste' && '🔋'}
                      {req.waste_type === 'construction' && '🧱'}
                      {req.waste_type === 'general' && '🗑️'}
                      {req.waste_type === 'recyclable' && '♻️'}
                      {req.waste_type === 'organic' && '🍏'}
                    </span>
                    <span>{req.waste_type}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
                      ({req.volume})
                    </span>
                  </div>

                  <div className={`priority-badge ${req.priority_band}`}>
                    <span>{Math.round(req.priority_score)}</span>
                    <span>• {req.priority_band.toUpperCase()}</span>
                  </div>
                </div>

                <div className="request-card-body">
                  <div className="request-address">
                    <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#6366F1' }} />
                    {req.address || `GPS: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}`}
                  </div>
                  {req.description && (
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {req.description}
                    </div>
                  )}
                </div>

                <div className="request-card-footer">
                  <span className="status-indicator" style={{
                    color: req.status === 'verified' ? '#0284C7' : req.status === 'planned' ? '#7C3AED' : req.status === 'collected' ? '#059669' : '#D97706'
                  }}>
                    ● {req.status}
                  </span>

                  {req.duplicate_of && (
                    <span style={{ color: '#E11D48', fontWeight: 700, fontSize: '0.72rem' }}>
                      🔗 Duplicate
                    </span>
                  )}

                  <span>
                    {new Date(req.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
