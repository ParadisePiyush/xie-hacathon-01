import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Depot, PickupRequest, Plan, Zone } from '../api/types';

interface MapProps {
  requests: PickupRequest[];
  depots: Depot[];
  zones: Zone[];
  activePlan?: Plan | null;
  selectedRequest: PickupRequest | null;
  onSelectRequest: (req: PickupRequest) => void;
  isDroppingPin: boolean;
  droppedPin: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
}

const ROUTE_COLORS = [
  '#4F46E5', // Electric Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F97316', // Orange
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

export const Map: React.FC<MapProps> = ({
  requests,
  depots,
  zones,
  activePlan,
  selectedRequest,
  onSelectRequest,
  isDroppingPin,
  droppedPin,
  onMapClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const droppedPinMarkerRef = useRef<L.Marker | null>(null);

  const [isHeatmapMode, setIsHeatmapMode] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.9975, 73.7898],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const routesGroup = L.layerGroup().addTo(map);
    const markersGroup = L.layerGroup().addTo(map);
    const heatmapGroup = L.layerGroup().addTo(map);
    routesLayerRef.current = routesGroup;
    markersLayerRef.current = markersGroup;
    heatmapLayerRef.current = heatmapGroup;
    mapInstanceRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !zones.length) return;

    const zoneLayers: L.Polygon[] = [];
    zones.forEach((zone) => {
      if (zone.boundary_coordinates && zone.boundary_coordinates.length >= 3) {
        const poly = L.polygon(
          zone.boundary_coordinates.map((pt) => [pt[0], pt[1]] as [number, number]),
          {
            color: zone.color || '#4F46E5',
            fillColor: zone.color || '#4F46E5',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '4, 4',
          }
        ).addTo(map);
        poly.bindTooltip(`<b>${zone.name}</b>`, { sticky: true });
        zoneLayers.push(poly);
      }
    });

    return () => {
      zoneLayers.forEach((l) => l.remove());
    };
  }, [zones]);

  // Update Routes Polyline & Stop Numbers from active plan
  useEffect(() => {
    const routesGroup = routesLayerRef.current;
    if (!routesGroup) return;

    routesGroup.clearLayers();
    if (!activePlan || !activePlan.routes || activePlan.routes.length === 0) return;

    // Depot coordinate
    const depotLat = depots.length > 0 ? depots[0].latitude : 19.9975;
    const depotLng = depots.length > 0 ? depots[0].longitude : 73.7898;

    activePlan.routes.forEach((route, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      if (!route.stops || route.stops.length === 0) return;

      // Construct points: depot -> stop 1 -> ... -> stop N -> depot
      const polylinePoints: [number, number][] = [
        [depotLat, depotLng],
        ...route.stops.map((s) => [s.request.latitude, s.request.longitude] as [number, number]),
        [depotLat, depotLng],
      ];

      // Draw Route Polyline
      const line = L.polyline(polylinePoints, {
        color,
        weight: 5,
        opacity: 0.85,
        dashArray: undefined,
        lineCap: 'round',
        lineJoin: 'round',
      });
      line.bindTooltip(
        `<b>Vehicle: ${route.vehicle_plate}</b><br/>Stops: ${route.stops.length} • Distance: ${(route.distance_m / 1000).toFixed(1)} km`,
        { sticky: true }
      );
      routesGroup.addLayer(line);

      // Draw Numbered Sequence Badges along route
      route.stops.forEach((stop) => {
        const seqIcon = L.divIcon({
          className: 'route-sequence-badge',
          html: `<div style="
            background: ${color};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 0.85rem;
            border: 2.5px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            cursor: pointer;
          ">${stop.sequence}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([stop.request.latitude, stop.request.longitude], { icon: seqIcon });
        marker.on('click', () => {
          onSelectRequest(stop.request);
        });
        marker.bindTooltip(
          `<b>Stop #${stop.sequence} (${route.vehicle_plate})</b><br/>${stop.request.waste_type.toUpperCase()} • ${stop.request.volume}<br/>ETA: ${stop.eta ? new Date(stop.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}`,
          { direction: 'top', offset: [0, -15] }
        );
        routesGroup.addLayer(marker);
      });
    });
  }, [activePlan, depots]);

  // Update Request & Depot Markers (for requests not on active plan or overall layer)
  useEffect(() => {
    const layerGroup = markersLayerRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    // 1. Depots
    depots.forEach((depot) => {
      const depotIcon = L.divIcon({
        className: 'depot-map-pin',
        html: `<span>🏢</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([depot.latitude, depot.longitude], { icon: depotIcon });
      marker.bindPopup(`<b>${depot.name}</b><br/><span style="color:#64748B;">Central Depot Station</span>`);
      layerGroup.addLayer(marker);
    });

    // 2. Pickup Requests (if no active plan, or for requests not planned)
    const plannedRequestIds = new Set<string>();
    if (activePlan) {
      activePlan.routes.forEach((r) => r.stops.forEach((s) => plannedRequestIds.add(s.request_id)));
    }

    requests.forEach((req) => {
      // If stop is drawn with sequence number in route layer, skip drawing regular pin to prevent duplicate overlap
      if (plannedRequestIds.has(req.id)) return;

      const band = req.priority_band || 'low';
      const icon = L.divIcon({
        className: `custom-map-pin ${band}`,
        html: `<span>${Math.round(req.priority_score)}</span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([req.latitude, req.longitude], { icon });
      marker.on('click', () => {
        onSelectRequest(req);
      });

      marker.bindTooltip(
        `<b>${req.waste_type.toUpperCase()}</b> (${req.volume})<br/>Score: <b>${req.priority_score}</b> [${band.toUpperCase()}]`,
        { direction: 'top', offset: [0, -15] }
      );

      layerGroup.addLayer(marker);
    });
  }, [requests, depots, activePlan]);

  // Handle Selected Request Map Pan
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedRequest) return;

    map.flyTo([selectedRequest.latitude, selectedRequest.longitude], 15, {
      duration: 1.0,
    });
  }, [selectedRequest]);

  // Handle Dropped Pin Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (droppedPin) {
      if (!droppedPinMarkerRef.current) {
        const dropIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `<span style="font-size:1.2rem;">📍</span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 42],
        });
        droppedPinMarkerRef.current = L.marker([droppedPin.lat, droppedPin.lng], {
          icon: dropIcon,
        }).addTo(map);
      } else {
        droppedPinMarkerRef.current.setLatLng([droppedPin.lat, droppedPin.lng]);
      }
    } else if (droppedPinMarkerRef.current) {
      droppedPinMarkerRef.current.remove();
      droppedPinMarkerRef.current = null;
    }
  }, [droppedPin]);

  // Heatmap rendering effect
  useEffect(() => {
    const heatGroup = heatmapLayerRef.current;
    if (!heatGroup) return;

    heatGroup.clearLayers();
    if (!isHeatmapMode) return;

    requests.forEach((req) => {
      const isCritical = req.priority_band === 'critical';
      const isHigh = req.priority_band === 'high';
      const color = isCritical ? '#EF4444' : isHigh ? '#F97316' : '#F59E0B';
      const radius = 250 + req.priority_score * 2.5;

      const circle = L.circle([req.latitude, req.longitude], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 1.5,
      });

      circle.bindTooltip(
        `<b>${req.waste_type.toUpperCase()} Hotspot</b><br/>Score: ${Math.round(req.priority_score)}`,
        { sticky: true }
      );
      heatGroup.addLayer(circle);
    });
  }, [requests, isHeatmapMode]);

  return (
    <div className="map-pane">
      <div className="map-floating-overlay">
        <span className="map-mode-badge">
          {isDroppingPin
            ? '📍 Click anywhere on the map to set location'
            : activePlan
            ? '🚚 Optimized Multi-Vehicle Plan Active'
            : '🗺️ Dispatch Map'}
        </span>
        <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          • {requests.length} open points {activePlan ? `• ${activePlan.routes.length} vehicle routes` : ''}
        </span>
        <button
          type="button"
          onClick={() => setIsHeatmapMode(!isHeatmapMode)}
          style={{
            background: isHeatmapMode ? 'var(--color-critical-bg)' : 'white',
            color: isHeatmapMode ? 'var(--color-critical)' : 'var(--text-main)',
            border: `1.5px solid ${isHeatmapMode ? '#FCA5A5' : 'var(--border-subtle)'}`,
            borderRadius: '8px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            marginLeft: '0.5rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          {isHeatmapMode ? '📍 Standard Pins' : '🔥 Density Heatmap'}
        </button>
      </div>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
