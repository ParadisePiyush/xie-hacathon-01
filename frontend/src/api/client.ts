import type {
  Depot,
  PaginatedResponse,
  PickupRequest,
  PickupRequestCreate,
  PickupRequestTransition,
  PriorityConfig,
  Zone,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});

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
};
