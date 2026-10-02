export type WasteType =
  | 'general'
  | 'recyclable'
  | 'hazardous'
  | 'medical'
  | 'e_waste'
  | 'organic'
  | 'construction';

export type Volume = 'small' | 'medium' | 'large' | 'overflow';

export type RequestStatus =
  | 'submitted'
  | 'verified'
  | 'planned'
  | 'in_progress'
  | 'collected'
  | 'skipped'
  | 'rejected'
  | 'cancelled';

export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export interface StatusHistoryItem {
  id: string;
  request_id: string;
  from_status?: string | null;
  to_status: string;
  actor_id?: string | null;
  note?: string | null;
  created_at: string;
}

export interface PickupRequest {
  id: string;
  reporter_id?: string | null;
  latitude: float;
  longitude: float;
  address?: string | null;
  waste_type: WasteType;
  volume: Volume;
  description?: string | null;
  photo_url?: string | null;
  status: RequestStatus;
  priority_score: number;
  priority_band: PriorityBand;
  zone_id?: string | null;
  duplicate_of?: string | null;
  repeat_count: number;
  sla_due_at?: string | null;
  created_at: string;
  updated_at: string;
  history: StatusHistoryItem[];
}

// Temporary alias
type float = number;

export interface PickupRequestCreate {
  latitude: number;
  longitude: number;
  address?: string;
  waste_type: WasteType;
  volume: Volume;
  description?: string;
  photo_url?: string;
  reporter_id?: string;
  zone_id?: string;
}

export interface PickupRequestTransition {
  to_status: RequestStatus;
  note?: string;
  reason?: string;
  actor_id?: string;
  proof_photo_url?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Depot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  created_at: string;
}

export interface Zone {
  id: string;
  name: string;
  color?: string | null;
  boundary_coordinates: [number, number][];
  created_at: string;
}

export interface PriorityWeights {
  w_hazard: number;
  w_age: number;
  w_volume: number;
  w_repeat: number;
  w_sla_risk: number;
}

export interface PriorityConfig {
  weights: PriorityWeights;
  max_sla_hours: number;
  repeat_radius_meters: number;
  repeat_saturation_count: number;
  hazard_scores: Record<string, number>;
  volume_scores: Record<string, number>;
}
