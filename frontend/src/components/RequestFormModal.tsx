import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, Plus, X } from 'lucide-react';
import { apiClient } from '../api/client';
import type { GeoapifyAddressResult, PickupRequestCreate, Volume, WasteType } from '../api/types';

interface RequestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PickupRequestCreate) => Promise<void>;
  pinnedCoords: { lat: number; lng: number } | null;
  onStartPinDrop: () => void;
}

export const RequestFormModal: React.FC<RequestFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  pinnedCoords,
  onStartPinDrop,
}) => {
  const [latitude, setLatitude] = useState<number>(pinnedCoords?.lat || 19.9975);
  const [longitude, setLongitude] = useState<number>(pinnedCoords?.lng || 73.7898);
  const [address, setAddress] = useState('');
  const [wasteType, setWasteType] = useState<WasteType>('general');
  const [volume, setVolume] = useState<Volume>('medium');
  const [description, setDescription] = useState('');
  const [reporterId, setReporterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Geoapify Autocomplete & Reverse Geocode State
  const [addressSuggestions, setAddressSuggestions] = useState<GeoapifyAddressResult[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Auto reverse-geocode on pin drop or coordinate change
  useEffect(() => {
    if (pinnedCoords) {
      setLatitude(pinnedCoords.lat);
      setLongitude(pinnedCoords.lng);
      setIsReverseGeocoding(true);
      apiClient.reverseGeocode(pinnedCoords.lat, pinnedCoords.lng).then((addr) => {
        setAddress(addr);
        setIsReverseGeocoding(false);
      });
    }
  }, [pinnedCoords]);

  // Geoapify Address Autocomplete
  const handleAddressInputChange = (val: string) => {
    setAddress(val);
    if (!val || val.trim().length < 3) {
      setAddressSuggestions([]);
      setShowAddressDropdown(false);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearchingAddress(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await apiClient.autocompleteAddress(val);
        setAddressSuggestions(results);
        setShowAddressDropdown(results.length > 0);
      } catch (err) {
        console.error('Geoapify autocomplete error:', err);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 300);
  };

  const handleSelectAddressSuggestion = (item: GeoapifyAddressResult) => {
    setAddress(item.formatted);
    setLatitude(Number(item.lat.toFixed(5)));
    setLongitude(Number(item.lon.toFixed(5)));
    setShowAddressDropdown(false);
    setAddressSuggestions([]);
  };

  if (!isOpen) return null;

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          setLatitude(lat);
          setLongitude(lng);
          setIsReverseGeocoding(true);
          apiClient.reverseGeocode(lat, lng).then((addr) => {
            setAddress(addr);
            setIsReverseGeocoding(false);
          });
        },
        () => {
          alert('Could not retrieve current location.');
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit({
        latitude,
        longitude,
        address: address.trim() || undefined,
        waste_type: wasteType,
        volume,
        description: description.trim() || undefined,
        reporter_id: reporterId.trim() || 'citizen',
      });
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.25rem' }}>Report Waste on Map</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
              Drop a pin or enter coordinates to prioritize immediate pickup.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Location picker */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Location (Coordinates)</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                  onClick={onStartPinDrop}
                >
                  <MapPin size={13} color="#4F46E5" /> Drop Pin on Map
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                  onClick={handleGetCurrentLocation}
                >
                  <Crosshair size={13} /> GPS
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="Latitude"
                required
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
              />
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="Longitude"
                required
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Street Address / Landmark</label>
              <span style={{ fontSize: '0.72rem', color: '#6366F1', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {isReverseGeocoding ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Geoapify Resolving...
                  </>
                ) : (
                  <>🗺️ Geoapify Autocomplete</>
                )}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search or enter address (Geoapify powered)..."
                value={address}
                onChange={(e) => handleAddressInputChange(e.target.value)}
                onFocus={() => {
                  if (addressSuggestions.length > 0) setShowAddressDropdown(true);
                }}
              />
              {isSearchingAddress && (
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: '#6366F1' }} />
                </div>
              )}
            </div>

            {/* Suggestions dropdown */}
            {showAddressDropdown && addressSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                  border: '1px solid #E2E8F0',
                  zIndex: 1100,
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {addressSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectAddressSuggestion(item)}
                    style={{
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      borderBottom: idx < addressSuggestions.length - 1 ? '1px solid #F1F5F9' : 'none',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.4rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <MapPin size={13} style={{ color: '#4F46E5', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#1E293B' }}>{item.formatted}</div>
                      {item.city && (
                        <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                          {item.city} {item.postcode ? `• ${item.postcode}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waste Type */}
          <div className="form-group">
            <label className="form-label">Waste Category</label>
            <select
              className="form-select"
              value={wasteType}
              onChange={(e) => setWasteType(e.target.value as WasteType)}
            >
              <option value="hazardous">☣️ Hazardous (Chemical/Battery) - Urgent</option>
              <option value="medical">💉 Medical / Bio-Hazard - High Priority</option>
              <option value="e_waste">🔋 E-Waste / Electronics</option>
              <option value="construction">🧱 Construction / Heavy Debris</option>
              <option value="general">🗑️ General / Municipal Waste</option>
              <option value="recyclable">♻️ Recyclables (Plastic/Paper)</option>
              <option value="organic">🍏 Organic / Food Waste</option>
            </select>
          </div>

          {/* Volume Selection Cards */}
          <div className="form-group">
            <label className="form-label">Estimated Volume</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {(['small', 'medium', 'large', 'overflow'] as Volume[]).map((v) => (
                <div
                  key={v}
                  onClick={() => setVolume(v)}
                  style={{
                    padding: '0.65rem 0.4rem',
                    textAlign: 'center',
                    borderRadius: '10px',
                    border: volume === v ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                    background: volume === v ? '#EEF2FF' : '#F8FAFC',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'capitalize',
                    color: volume === v ? '#4F46E5' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {v === 'overflow' ? '🚨 Overflow' : v}
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description / Extra Details</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Spill details, access constraints, or bin overflow situation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Reporter Identification */}
          <div className="form-group">
            <label className="form-label">Reporter Name / ID (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Citizen Jane / Sanitation Lead"
              value={reporterId}
              onChange={(e) => setReporterId(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1, padding: '0.75rem' }}
              disabled={isSubmitting}
            >
              <Plus size={18} /> Submit Pickup Request
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
