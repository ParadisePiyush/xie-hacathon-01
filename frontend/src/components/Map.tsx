import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Depot, PickupRequest, Zone } from '../api/types';

interface MapProps {
  requests: PickupRequest[];
  depots: Depot[];
  zones: Zone[];
  selectedRequest: PickupRequest | null;
  onSelectRequest: (req: PickupRequest) => void;
  isDroppingPin: boolean;
  droppedPin: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
}

export const Map: React.FC<MapProps> = ({
  requests,
  depots,
  zones,
  selectedRequest,
  onSelectRequest,
  isDroppingPin,
  droppedPin,
  onMapClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const droppedPinMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (e.g., around 19.9975, 73.7898 or first request/depot)
    const map = L.map(mapContainerRef.current, {
      center: [19.9975, 73.7898],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Map click handler for pin drop
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

  // Update Request & Depot Markers
  useEffect(() => {
    const layerGroup = markersLayerRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    // 1. Depots
    depots.forEach((depot) => {
      const depotIcon = L.divIcon({
        className: 'depot-map-pin',
        html: `<span>🏢</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([depot.latitude, depot.longitude], { icon: depotIcon });
      marker.bindPopup(`<b>${depot.name}</b><br/><span style="color:#64748B;">Central Depot Station</span>`);
      layerGroup.addLayer(marker);
    });

    // 2. Pickup Requests
    requests.forEach((req) => {
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
  }, [requests, depots]);

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

  return (
    <div className="map-pane">
      <div className="map-floating-overlay">
        <span className="map-mode-badge">
          {isDroppingPin ? '📍 Click anywhere on the map to set location' : '🗺️ Interactive Dispatch Map'}
        </span>
        <span style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          • {requests.length} open points
        </span>
      </div>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
