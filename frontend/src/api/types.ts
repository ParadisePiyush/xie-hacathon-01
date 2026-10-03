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

export interface Team {
  id: string;
  name: string;
  depot_id?: string | null;
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

export interface Vehicle {
  id: string;
  team_id?: string | null;
  plate: string;
  capacity_units: number;
  shift_start: string;
  shift_end: string;
  is_active: boolean;
  created_at: string;
  team_name?: string | null;
}

export interface RouteStop {
  id: string;
  route_id: string;
  request_id: string;
  sequence: number;
  eta?: string | null;
  outcome?: string | null; // collected, skipped
  outcome_reason?: string | null;
  proof_photo_url?: string | null;
  completed_at?: string | null;
  request: PickupRequest;
}

export interface Route {
  id: string;
  plan_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  distance_m: number;
  duration_s: number;
  polyline?: string | null;
  stops: RouteStop[];
}

export interface Plan {
  id: string;
  plan_date: string;
  status: string;
  total_distance_m: number;
  total_duration_s: number;
  routes: Route[];
  unserved_request_ids: string[];
  created_at: string;
}

export interface PlanGenerateRequest {
  plan_date?: string;
  vehicle_ids?: string[];
  team_ids?: string[];
  request_ids?: string[];
  depot_id?: string;
}

export interface RouteStopCompleteRequest {
  outcome: 'collected' | 'skipped';
  reason?: string;
  proof_photo_url?: string;
}

// Phase 5 Auth & RBAC
export type UserRole = 'admin' | 'dispatcher' | 'collector' | 'reporter';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  team_id?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  payload?: Record<string, any> | null;
  created_at: string;
}

// Phase 6 Analytics & Realtime
export interface AnalyticsSummary {
  total_requests: number;
  open_backlog: number;
  collected_requests: number;
  sla_compliance_pct: number;
  avg_response_time_minutes: number;
  estimated_km_saved: number;
  efficiency_gain_pct: number;
  status_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  waste_type_distribution: Record<string, number>;
  total_active_plans: number;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  request_count: number;
  avg_priority_score: number;
  dominant_waste_type: string;
}

export interface TeamProductivity {
  team_id: string;
  team_name: string;
  stops_completed: number;
  stops_scheduled: number;
  total_distance_km: number;
  total_drive_time_minutes: number;
  active_vehicles: number;
}

export interface SystemNotification {
  id: string;
  channel: string;
  recipient: string;
  title: string;
  message: string;
  request_id?: string | null;
  created_at: string;
}

// AI Assistant & Gemini Chat types
export interface ChatMessage {
  id?: string;
  role: 'user' | 'model' | 'assistant';
  content: string;
  timestamp?: string;
  model?: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  suggestions: string[];
  model: string;
}

// Geoapify Geocoding & Search types
export interface GeoapifyAddressResult {
  formatted: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  lat: number;
  lon: number;
}


