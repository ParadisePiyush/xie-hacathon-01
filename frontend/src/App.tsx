import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  FileUp,
  LogOut,
  Plus,
  Shield,
  Sparkles,
  TableProperties,
  Truck,
  User as UserIcon,
} from 'lucide-react';
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
import { AdminPanelModal } from './components/AdminPanelModal';
import { AnalyticsDashboardModal } from './components/AnalyticsDashboardModal';
import { BacklogTable } from './components/BacklogTable';
import { CollectorRouteView } from './components/CollectorRouteView';
import { CSVImportModal } from './components/CSVImportModal';
import { LoginModal } from './components/LoginModal';
import { Map } from './components/Map';
import { PlanBuilderModal } from './components/PlanBuilderModal';
import { RequestDetailDrawer } from './components/RequestDetailDrawer';
import { RequestFormModal } from './components/RequestFormModal';
import { StatsBanner } from './components/StatsBanner';
import { useAuth } from './context/AuthContext';
import { useRealtime } from './hooks/useRealtime';

export const App: React.FC = () => {
  const { user, role, logout, isAdmin, isDispatcher } = useAuth();

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
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
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

  // Adapt view mode based on active user role
  useEffect(() => {
    if (role === 'collector') {
      setViewMode('collector');
    } else if (role === 'dispatcher' || role === 'admin') {
      setViewMode('dispatcher');
    }
  }, [role]);

  // Real-time live update stream (Phase 6)
  const { isConnected, criticalAlert, dismissAlert } = useRealtime((event) => {
    if (
      event.event === 'REQUEST_CREATED' ||
      event.event === 'REQUEST_TRANSITIONED' ||
      event.event === 'PLAN_PUBLISHED' ||
      event.event === 'STOP_COMPLETED'
    ) {
      loadData();
    }
  });

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="brand-title">Smart Waste Collection Optimizer</div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: isConnected ? '#059669' : '#94A3B8',
                  background: isConnected ? '#ECFDF5' : '#F1F5F9',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '999px',
                  border: `1px solid ${isConnected ? '#A7F3D0' : 'var(--border-subtle)'}`,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: isConnected ? '#10B981' : '#CBD5E1',
                    boxShadow: isConnected ? '0 0 6px #10B981' : 'none',
                  }}
                />
                {isConnected ? 'LIVE SYNC' : 'OFFLINE'}
              </span>
            </div>
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
          {/* Analytics Dashboard */}
          <button className="btn-secondary" onClick={() => setIsAnalyticsOpen(true)}>
            <BarChart3 size={16} /> Analytics
          </button>

          {isAdmin && (
            <button
              className="btn-secondary"
              onClick={() => setIsAdminOpen(true)}
              style={{
                border: '1.5px solid #C7D2FE',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                fontWeight: 700,
              }}
            >
              <Shield size={16} /> Admin Console
            </button>
          )}

          {(isDispatcher || isAdmin) && (
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
          )}

          {(isDispatcher || isAdmin) && (
            <button className="btn-secondary" onClick={() => setIsImportOpen(true)}>
              <FileUp size={16} /> Import CSV
            </button>
          )}

          <button
            className="btn-primary"
            onClick={() => {
              setPinnedCoords(null);
              setIsFormOpen(true);
            }}
          >
            <Plus size={18} /> Report Waste Pin
          </button>

          {/* User Profile & Role Switcher */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.35rem 0.65rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
                onClick={() => setIsLoginOpen(true)}
                title="Click to Switch Persona or Role"
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background:
                      role === 'admin'
                        ? 'var(--primary)'
                        : role === 'collector'
                        ? '#059669'
                        : role === 'dispatcher'
                        ? '#0284C7'
                        : '#D97706',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {user.full_name[0]}
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  {user.full_name.split(' ')[0]}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0.12rem 0.4rem',
                    borderRadius: '5px',
                    background:
                      role === 'admin'
                        ? 'var(--primary-light)'
                        : role === 'collector'
                        ? 'var(--color-low-bg)'
                        : role === 'dispatcher'
                        ? '#F0F9FF'
                        : 'var(--color-medium-bg)',
                    color:
                      role === 'admin'
                        ? 'var(--primary)'
                        : role === 'collector'
                        ? '#047857'
                        : role === 'dispatcher'
                        ? '#0369A1'
                        : '#B45309',
                  }}
                >
                  {role}
                </span>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={logout}
                title="Sign Out"
                style={{ color: 'var(--text-light)' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsLoginOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            >
              <UserIcon size={16} /> Sign In / Roles
            </button>
          )}
        </div>
      </header>

      {/* Critical Hazard Alert Emergency Re-plan Banner (Phase 6) */}
      {criticalAlert && (
        <div
          style={{
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)',
            borderBottom: '2px solid #EF4444',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.12)',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#EF4444',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: '0.92rem' }}>
                {criticalAlert.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7F1D1D' }}>
                {criticalAlert.message}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
                padding: '0.35rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
              onClick={() => {
                setIsPlanBuilderOpen(true);
                dismissAlert();
              }}
            >
              <Sparkles size={14} /> Auto Re-plan Routes
            </button>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#991B1B',
                fontSize: '1.25rem',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                lineHeight: 1,
              }}
              onClick={dismissAlert}
              title="Dismiss Alert"
            >
              ×
            </button>
          </div>
        </div>
      )}

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

      {/* Sign In & Persona Selector Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      {/* Admin Operations & Audit Panel */}
      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* Operations Analytics Dashboard Modal (Phase 6) */}
      <AnalyticsDashboardModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
    </div>
  );
};

export default App;

