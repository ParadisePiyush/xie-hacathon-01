import type {
  AnalyticsSummary,
  AuditLog,
  AuthResponse,
  Depot,
  HeatmapPoint,
  LoginCredentials,
  PaginatedResponse,
  PickupRequest,
  PickupRequestCreate,
  PickupRequestTransition,
  Plan,
  PlanGenerateRequest,
  PriorityConfig,
  RegisterCredentials,
  Route,
  RouteStop,
  RouteStopCompleteRequest,
  SystemNotification,
  TeamProductivity,
  User,
  Vehicle,
  Zone,
  ChatResponse,
  GeoapifyAddressResult,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});

  const token = localStorage.getItem('access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = 'API Request Failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson?.error?.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = `${res.status} ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const apiClient = {
  // Requests
  async getRequests(params: {
    status?: string;
    type?: string;
    band?: string;
    zone_id?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    size?: number;
  } = {}): Promise<PaginatedResponse<PickupRequest>> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.type) query.set('type', params.type);
    if (params.band) query.set('band', params.band);
    if (params.zone_id) query.set('zone_id', params.zone_id);
    if (params.search) query.set('search', params.search);
    if (params.sort_by) query.set('sort_by', params.sort_by);
    if (params.sort_order) query.set('sort_order', params.sort_order);
    if (params.page) query.set('page', params.page.toString());
    if (params.size) query.set('size', params.size.toString());

    return request<PaginatedResponse<PickupRequest>>(`/requests?${query.toString()}`);
  },

  async getRequestById(id: string): Promise<PickupRequest> {
    return request<PickupRequest>(`/requests/${id}`);
  },

  async createRequest(payload: PickupRequestCreate): Promise<PickupRequest> {
    return request<PickupRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async transitionRequest(id: string, payload: PickupRequestTransition): Promise<PickupRequest> {
    return request<PickupRequest>(`/requests/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async cancelRequest(id: string, reason?: string): Promise<PickupRequest> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return request<PickupRequest>(`/requests/${id}${query}`, {
      method: 'DELETE',
    });
  },

  async getNearbyRequests(lat: number, lng: number, radius = 1000): Promise<{ request: PickupRequest; distance_meters: number }[]> {
    return request<{ request: PickupRequest; distance_meters: number }[]>(
      `/requests/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    );
  },

  // Resources
  async getDepots(): Promise<Depot[]> {
    return request<Depot[]>('/depots');
  },

  async getZones(): Promise<Zone[]> {
    return request<Zone[]>('/zones');
  },

  // Config
  async getPriorityConfig(): Promise<PriorityConfig> {
    return request<PriorityConfig>('/config/priority');
  },

  async updatePriorityConfig(config: PriorityConfig): Promise<PriorityConfig> {
    return request<PriorityConfig>('/config/priority', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  // CSV Import
  async importCSV(file: File): Promise<{
    total_rows: number;
    imported_count: number;
    failed_count: number;
    errors: { row_number: number; error: string }[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return request('/requests/import', {
      method: 'POST',
      body: formData,
    });
  },

  // Vehicles
  async getVehicles(teamId?: string): Promise<Vehicle[]> {
    const q = teamId ? `?team_id=${teamId}` : '';
    return request<Vehicle[]>(`/vehicles${q}`);
  },

  // Planning & Optimization (Phase 4)
  async generatePlan(payload: PlanGenerateRequest = {}): Promise<Plan> {
    return request<Plan>('/plans/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getPlans(): Promise<Plan[]> {
    return request<Plan[]>('/plans');
  },

  async getPlanById(id: string): Promise<Plan> {
    return request<Plan>(`/plans/${id}`);
  },

  async publishPlan(id: string): Promise<Plan> {
    return request<Plan>(`/plans/${id}/publish`, {
      method: 'POST',
    });
  },

  async getMyRoute(vehicleId?: string): Promise<Route> {
    const q = vehicleId ? `?vehicle_id=${vehicleId}` : '';
    return request<Route>(`/routes/mine${q}`);
  },

  async completeRouteStop(stopId: string, payload: RouteStopCompleteRequest): Promise<RouteStop> {
    return request<RouteStop>(`/route-stops/${stopId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Auth & RBAC (Phase 5)
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data;
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const data = await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  async getMe(): Promise<User> {
    return request<User>('/auth/me');
  },

  // User Management (Admin)
  async getUsers(role?: string, teamId?: string): Promise<User[]> {
    const q = new URLSearchParams();
    if (role) q.set('role', role);
    if (teamId) q.set('team_id', teamId);
    return request<User[]>(`/users?${q.toString()}`);
  },

  async createUser(payload: any): Promise<User> {
    return request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateUser(id: string, payload: any): Promise<User> {
    return request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deactivateUser(id: string): Promise<void> {
    return request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return request<AuditLog[]>(`/audit-logs?limit=${limit}`);
  },

  // Analytics & Realtime (Phase 6)
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return request<AnalyticsSummary>('/analytics/summary');
  },

  async getHeatmapPoints(): Promise<HeatmapPoint[]> {
    return request<HeatmapPoint[]>('/analytics/heatmap');
  },

  async getTeamProductivity(): Promise<TeamProductivity[]> {
    return request<TeamProductivity[]>('/analytics/teams');
  },

  async getNotifications(): Promise<SystemNotification[]> {
    return request<SystemNotification[]>('/analytics/notifications');
  },

  getExportUrl(): string {
    return `${API_BASE}/analytics/export`;
  },

  // AI Assistant Chatbot (Gemini)
  async sendChatMessage(
    message: string,
    history?: { role: string; content: string }[]
  ): Promise<ChatResponse> {
    return request<ChatResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  async getChatSuggestions(): Promise<string[]> {
    return request<string[]>('/chat/suggestions');
  },

  // Geoapify Maps & Geocoding Services
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY || '';
    if (!key) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${key}`
      );
      if (!res.ok) throw new Error('Failed to reverse geocode');
      const data = await res.json();
      const features = data?.features;
      if (features && features.length > 0) {
        return features[0]?.properties?.formatted || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
      console.warn('Geoapify reverse geocode failed:', err);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  },

  async autocompleteAddress(text: string): Promise<GeoapifyAddressResult[]> {
    if (!text || text.trim().length < 2) return [];
    const key = import.meta.env.VITE_GEOAPIFY_API_KEY || '';
    if (!key) return [];
    try {
      const encoded = encodeURIComponent(text.trim());
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encoded}&apiKey=${key}&limit=6`
      );
      if (!res.ok) return [];
      const data = await res.json();
      const features = data?.features || [];
      return features.map((f: any) => ({
        formatted: f.properties?.formatted || '',
        address_line1: f.properties?.address_line1,
        address_line2: f.properties?.address_line2,
        city: f.properties?.city,
        state: f.properties?.state,
        postcode: f.properties?.postcode,
        country: f.properties?.country,
        lat: f.properties?.lat,
        lon: f.properties?.lon,
      }));
    } catch (err) {
      console.warn('Geoapify autocomplete failed:', err);
      return [];
    }
  },
};

