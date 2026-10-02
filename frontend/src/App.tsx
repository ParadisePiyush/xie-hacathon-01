import React, { useEffect, useState } from 'react';
import { FileUp, Plus, Sparkles, TableProperties, Truck } from 'lucide-react';
import { apiClient } from './api/client';
import type {
  Depot,
  PickupRequest,
  Plan,
  PriorityBand,
  RequestStatus,
  WasteType,
  Zone,
} from './api/types';
import { BacklogTable } from './components/BacklogTable';
import { CollectorRouteView } from './components/CollectorRouteView';
import { CSVImportModal } from './components/CSVImportModal';
import { Map } from './components/Map';
import { PlanBuilderModal } from './components/PlanBuilderModal';
import { RequestDetailDrawer } from './components/RequestDetailDrawer';
import { RequestFormModal } from './components/RequestFormModal';
import { StatsBanner } from './components/StatsBanner';

export const App: React.FC = () => {
  // Navigation / View state
  const [viewMode, setViewMode] = useState<'dispatcher' | 'collector'>('dispatcher');

  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PickupRequest | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBand, setSelectedBand] = useState<PriorityBand | 'all'>('all');
  const [selectedType, setSelectedType] = useState<WasteType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'all'>('all');

  // Modals & pin drop state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPlanBuilderOpen, setIsPlanBuilderOpen] = useState(false);
  const [isDroppingPin, setIsDroppingPin] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load Data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [reqData, depotData, zoneData, plansData] = await Promise.all([
        apiClient.getRequests({
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          type: selectedType !== 'all' ? selectedType : undefined,
          band: selectedBand !== 'all' ? selectedBand : undefined,
          search: searchQuery.trim() || undefined,
          size: 100,
        }),
        apiClient.getDepots(),
        apiClient.getZones(),
        apiClient.getPlans(),
      ]);

      setRequests(reqData.items || []);
      setDepots(depotData || []);
      setZones(zoneData || []);

      if (plansData && plansData.length > 0) {
        // Find published plan first or most recent
        const published = plansData.find((p) => p.status === 'published');
        setActivePlan((prev) => prev || published || plansData[0]);
      }

      // If selectedRequest is currently open, refresh its data too
      if (selectedRequest) {
        const updated = reqData.items.find((r) => r.id === selectedRequest.id);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedType, selectedBand, searchQuery]);

  // Handle map click
  const handleMapClick = (lat: number, lng: number) => {
    if (isDroppingPin) {
      setPinnedCoords({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
      setIsDroppingPin(false);
      setIsFormOpen(true);
    }
  };

  // Create request
  const handleCreateRequest = async (data: any) => {
    await apiClient.createRequest(data);
    await loadData();
    setPinnedCoords(null);
  };

  // Status transition
  const handleTransition = async (
    id: string,
    toStatus: RequestStatus,
    note?: string,
    reason?: string
  ) => {
    const updated = await apiClient.transitionRequest(id, {
      to_status: toStatus,
      note,
      reason,
      actor_id: 'dispatcher_ui',
    });
    setSelectedRequest(updated);
    await loadData();
  };

  // Cancel request
  const handleCancel = async (id: string, reason: string) => {
    const updated = await apiClient.cancelRequest(id, reason);
    setSelectedRequest(updated);
    await loadData();
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="topbar">
        <div className="brand-section">
          <div className="brand-logo">♻️</div>
          <div>
            <div className="brand-title">Smart Waste Collection Optimizer</div>
            <div className="brand-subtitle">Prioritized Pickup & Route Dispatch System</div>
          </div>
        </div>

        {/* View Switcher: Dispatcher vs Collector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-subtle)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('dispatcher')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: viewMode === 'dispatcher' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'dispatcher' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'dispatcher' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <TableProperties size={16} /> Dispatcher Backlog
          </button>

          <button
            type="button"
            onClick={() => setViewMode('collector')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: viewMode === 'collector' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'collector' ? '#059669' : 'var(--text-muted)',
              boxShadow: viewMode === 'collector' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Truck size={16} /> Field Collector Mode
          </button>
        </div>

        {/* Topbar Actions */}
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => setIsPlanBuilderOpen(true)}
            style={{
              border: '1.5px solid #C7D2FE',
              background: activePlan ? 'var(--primary-light)' : undefined,
              color: activePlan ? 'var(--primary)' : undefined,
            }}
          >
            <Sparkles size={16} /> {activePlan ? 'Routes Planned' : 'Optimize Routes'}
          </button>

          <button className="btn-secondary" onClick={() => setIsImportOpen(true)}>
            <FileUp size={16} /> Import CSV
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              setPinnedCoords(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={18} /> Report Waste Pin
          </button>
        </div>
      </header>

      {/* KPI Stats Banner */}
      <StatsBanner requests={requests} />

      {/* Main Split Interface */}
      <main className="main-content">
        <Map
          requests={requests}
          depots={depots}
          zones={zones}
          activePlan={activePlan}
          selectedRequest={selectedRequest}
          onSelectRequest={(req) => setSelectedRequest(req)}
          isDroppingPin={isDroppingPin}
          droppedPin={pinnedCoords}
          onMapClick={handleMapClick}
        />

        {viewMode === 'dispatcher' ? (
          <BacklogTable
            requests={requests}
            selectedRequest={selectedRequest}
            onSelectRequest={(req) => setSelectedRequest(req)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedBand={selectedBand}
            onBandChange={setSelectedBand}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        ) : (
          <CollectorRouteView
            onSelectRequest={(req) => setSelectedRequest(req)}
            onRefreshMap={loadData}
          />
        )}
      </main>

      {/* Detail Drawer */}
      <RequestDetailDrawer
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onTransition={handleTransition}
        onCancel={handleCancel}
      />

      {/* Report Waste Modal */}
      <RequestFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateRequest}
        pinnedCoords={pinnedCoords}
        onStartPinDrop={() => {
          setIsFormOpen(false);
          setIsDroppingPin(true);
        }}
      />

      {/* Bulk CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={() => loadData()}
      />

      {/* Route Optimization Plan Builder Modal */}
      <PlanBuilderModal
        isOpen={isPlanBuilderOpen}
        onClose={() => setIsPlanBuilderOpen(false)}
        onPlanGenerated={(plan) => {
          setActivePlan(plan);
          loadData();
        }}
        depots={depots}
        openRequestsCount={
          requests.filter((r) => ['pending', 'triaged', 'scheduled'].includes(r.status)).length
        }
      />
    </div>
  );
};

export default App;

