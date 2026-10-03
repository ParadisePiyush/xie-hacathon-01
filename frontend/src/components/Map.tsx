import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Loader2, MapPin, Search, X } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Depot, GeoapifyAddressResult, PickupRequest, Plan, Zone } from '../api/types';

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

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY || '';

export type MapTileTheme = 'osm-bright' | 'dark-matter' | 'positron' | 'osm-liberty';

interface ThemeOption {
  id: MapTileTheme;
  label: string;
  badge: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'osm-bright', label: 'Geoapify Bright', badge: '☀️ Clean' },
  { id: 'dark-matter', label: 'Geoapify Dark', badge: '🌙 Dispatch' },
  { id: 'positron', label: 'Geoapify Positron', badge: '◻️ Minimal' },
  { id: 'osm-liberty', label: 'Geoapify Liberty', badge: '🎨 Vivid' },
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
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const droppedPinMarkerRef = useRef<L.Marker | null>(null);

  const [mapTheme, setMapTheme] = useState<MapTileTheme>('osm-bright');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);

  // Geoapify Address Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoapifyAddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Dropped Pin Address
  const [reverseAddress, setReverseAddress] = useState<string | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.9975, 73.7898],
      zoom: 13,
      zoomControl: true,
    });

    const tileUrl = GEOAPIFY_KEY
      ? `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const initialTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: GEOAPIFY_KEY
        ? 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> | © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    tileLayerRef.current = initialTileLayer;

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

  // Update Tile Layer on Theme Change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl = GEOAPIFY_KEY
      ? `https://maps.geoapify.com/v1/tile/${mapTheme}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: GEOAPIFY_KEY
        ? 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> | © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [mapTheme]);

  // Geoapify Live Address Search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await apiClient.autocompleteAddress(searchQuery.trim());
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (err) {
        console.error('Address search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const handleSelectSearchResult = (result: GeoapifyAddressResult) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setShowSearchResults(false);
    setSearchQuery(result.formatted);

    map.flyTo([result.lat, result.lon], 16, { duration: 1.2 });
    onMapClick(result.lat, result.lon);
  };

  // Geoapify Reverse Geocode on Dropped Pin
  useEffect(() => {
    if (!droppedPin) {
      setReverseAddress(null);
      return;
    }

    let isMounted = true;
    apiClient.reverseGeocode(droppedPin.lat, droppedPin.lng).then((addr) => {
      if (isMounted) setReverseAddress(addr);
    });

    return () => {
      isMounted = false;
    };
  }, [droppedPin]);

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

    const depotLat = depots.length > 0 ? depots[0].latitude : 19.9975;
    const depotLng = depots.length > 0 ? depots[0].longitude : 73.7898;

    activePlan.routes.forEach((route, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      if (!route.stops || route.stops.length === 0) return;

      const polylinePoints: [number, number][] = [
        [depotLat, depotLng],
        ...route.stops.map((s) => [s.request.latitude, s.request.longitude] as [number, number]),
        [depotLat, depotLng],
      ];

      const line = L.polyline(polylinePoints, {
        color,
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      });
      line.bindTooltip(
        `<b>Vehicle: ${route.vehicle_plate}</b><br/>Stops: ${route.stops.length} • Distance: ${(route.distance_m / 1000).toFixed(1)} km`,
        { sticky: true }
      );
      routesGroup.addLayer(line);

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
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([depot.latitude, depot.longitude], { icon: depotIcon });
      marker.bindPopup(`<b>${depot.name}</b><br/><span style="color:#64748B;">Central Operations Depot</span>`);
      layerGroup.addLayer(marker);
    });

    // 2. Pickup Requests
    const plannedRequestIds = new Set<string>();
    if (activePlan) {
      activePlan.routes.forEach((r) => r.stops.forEach((s) => plannedRequestIds.add(s.request_id)));
    }

    requests.forEach((req) => {
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
          html: `<span style="font-size:1.3rem;">📍</span>`,
          iconSize: [42, 42],
          iconAnchor: [21, 42],
        });
        const marker = L.marker([droppedPin.lat, droppedPin.lng], {
          icon: dropIcon,
        }).addTo(map);

        if (reverseAddress) {
          marker.bindTooltip(`<b>Pinned Location</b><br/>${reverseAddress}`, {
            permanent: true,
            direction: 'top',
            offset: [0, -40],
          }).openTooltip();
        }
        droppedPinMarkerRef.current = marker;
      } else {
        droppedPinMarkerRef.current.setLatLng([droppedPin.lat, droppedPin.lng]);
        if (reverseAddress) {
          droppedPinMarkerRef.current.setTooltipContent(`<b>Pinned Location</b><br/>${reverseAddress}`);
        }
      }
    } else if (droppedPinMarkerRef.current) {
      droppedPinMarkerRef.current.remove();
      droppedPinMarkerRef.current = null;
    }
  }, [droppedPin, reverseAddress]);

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
    <div className="map-pane" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Top Floating Control Bar */}
      <div className="map-floating-overlay" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
        {/* Mode / Status Badge */}
        <span className="map-mode-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isDroppingPin ? (
            <>
              <MapPin size={14} className="animate-bounce" /> Click map or search address
            </>
          ) : activePlan ? (
            <>🚚 Optimized Routes Active</>
          ) : (
            <>🗺️ Geoapify Vector Dispatch Map</>
          )}
        </span>

        {/* Geoapify Live Address Autocomplete Search Bar */}
        <div style={{ position: 'relative', minWidth: '240px', maxWidth: '340px', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'white',
              borderRadius: '8px',
              border: '1.5px solid var(--border-subtle, #E2E8F0)',
              padding: '0.25rem 0.6rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <Search size={14} style={{ color: '#64748B', marginRight: '0.4rem' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              placeholder="Search address (Geoapify)..."
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '0.8rem',
                width: '100%',
                background: 'transparent',
              }}
            />
            {isSearching ? (
              <Loader2 size={13} className="animate-spin" style={{ color: '#6366F1' }} />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94A3B8',
                }}
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                right: 0,
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                border: '1px solid #E2E8F0',
                zIndex: 1000,
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {searchResults.map((res, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectSearchResult(res)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    borderBottom: index < searchResults.length - 1 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <MapPin size={14} style={{ color: '#4F46E5', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>{res.formatted}</div>
                    {res.city && (
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                        {res.city} {res.postcode ? `• ${res.postcode}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Theme Selector */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            style={{
              background: 'white',
              border: '1.5px solid var(--border-subtle, #E2E8F0)',
              borderRadius: '8px',
              padding: '0.25rem 0.6rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}
          >
            <Layers size={13} style={{ color: '#4F46E5' }} />
            <span>{THEME_OPTIONS.find((t) => t.id === mapTheme)?.badge || 'Theme'}</span>
          </button>

          {isThemeMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                border: '1px solid #E2E8F0',
                zIndex: 1000,
                minWidth: '160px',
                padding: '0.35rem 0',
              }}
            >
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#94A3B8',
                  padding: '0.25rem 0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Geoapify Tiles
              </div>
              {THEME_OPTIONS.map((theme) => (
                <div
                  key={theme.id}
                  onClick={() => {
                    setMapTheme(theme.id);
                    setIsThemeMenuOpen(false);
                  }}
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: mapTheme === theme.id ? 700 : 500,
                    color: mapTheme === theme.id ? '#4F46E5' : '#1E293B',
                    background: mapTheme === theme.id ? '#EEF2FF' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => {
                    if (mapTheme !== theme.id) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (mapTheme !== theme.id) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>{theme.label}</span>
                  <span style={{ fontSize: '0.7rem' }}>{theme.badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Heatmap Toggle */}
        <button
          type="button"
          onClick={() => setIsHeatmapMode(!isHeatmapMode)}
          style={{
            background: isHeatmapMode ? 'var(--color-critical-bg, #FEF2F2)' : 'white',
            color: isHeatmapMode ? 'var(--color-critical, #EF4444)' : 'var(--text-main, #1E293B)',
            border: `1.5px solid ${isHeatmapMode ? '#FCA5A5' : 'var(--border-subtle, #E2E8F0)'}`,
            borderRadius: '8px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          {isHeatmapMode ? '📍 Standard Pins' : '🔥 Density Heatmap'}
        </button>

        {/* Points stats */}
        <span style={{ color: '#64748B', fontSize: '0.78rem', display: 'flex', alignItems: 'center' }}>
          • {requests.length} open points
        </span>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {/* Geoapify Attribution Badge */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          zIndex: 400,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '6px',
          padding: '2px 8px',
          fontSize: '0.68rem',
          color: '#475569',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{GEOAPIFY_KEY ? '🗺️ Geoapify Maps' : '🗺️ OpenStreetMap'}</span>
        <span style={{ color: '#CBD5E1' }}>•</span>
        <span style={{ color: '#10B981', fontWeight: 600 }}>Active</span>
      </div>
    </div>
  );
};
