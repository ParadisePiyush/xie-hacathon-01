import React, { useEffect, useState } from 'react';
import { FileUp, Plus } from 'lucide-react';
import { apiClient } from './api/client';
import type { Depot, PickupRequest, PriorityBand, RequestStatus, WasteType, Zone } from './api/types';
import { BacklogTable } from './components/BacklogTable';
import { CSVImportModal } from './components/CSVImportModal';
import { Map } from './components/Map';
import { RequestDetailDrawer } from './components/RequestDetailDrawer';
import { RequestFormModal } from './components/RequestFormModal';
import { StatsBanner } from './components/StatsBanner';

export const App: React.FC = () => {
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PickupRequest | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBand, setSelectedBand] = useState<PriorityBand | 'all'>('all');
  const [selectedType, setSelectedType] = useState<WasteType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'all'>('all');

  // Modals & pin drop state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDroppingPin, setIsDroppingPin] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load Data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [reqData, depotData, zoneData] = await Promise.all([
        apiClient.getRequests({
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          type: selectedType !== 'all' ? selectedType : undefined,
          band: selectedBand !== 'all' ? selectedBand : undefined,
          search: searchQuery.trim() || undefined,
          size: 100,
        }),
        apiClient.getDepots(),
        apiClient.getZones(),
      ]);

      setRequests(reqData.items || []);
      setDepots(depotData || []);
      setZones(zoneData || []);

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

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => setIsImportOpen(true)}
          >
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
          selectedRequest={selectedRequest}
          onSelectRequest={(req) => setSelectedRequest(req)}
          isDroppingPin={isDroppingPin}
          droppedPin={pinnedCoords}
          onMapClick={handleMapClick}
        />

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
    </div>
  );
};

export default App;
