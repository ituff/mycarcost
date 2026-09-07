const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Session expired or not logged in: go to the login page,
    // except for the auth endpoints themselves (they report errors inline).
    if (res.status === 401 && !path.startsWith('/auth')) {
      window.location.href = '/login';
    }
    throw { status: res.status, ...body };
  }
  return res.json();
}

// Vehicles
export const api = {
  // Vehicles
  getVehicles: () => request<{ vehicles: any[] }>('/vehicles'),
  createVehicle: (data: { name: string; type: string }) =>
    request<any>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: { name?: string; type?: string }) =>
    request<any>(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVehicle: (id: string) =>
    request<any>(`/vehicles/${id}`, { method: 'DELETE' }),

  // Consumptions
  getConsumptions: (vehicleId: string, params?: { page?: number; pageSize?: number; startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    return request<{ consumptions: any[]; pagination: any }>(`/vehicles/${vehicleId}/consumptions?${qs}`);
  },
  createConsumption: (vehicleId: string, data: any) =>
    request<any>(`/vehicles/${vehicleId}/consumptions`, { method: 'POST', body: JSON.stringify(data) }),
  getConsumption: (id: string) =>
    request<any>(`/consumptions/${id}`),
  updateConsumption: (id: string, data: any) =>
    request<any>(`/consumptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteConsumption: (id: string) =>
    request<any>(`/consumptions/${id}`, { method: 'DELETE' }),

  // Locations
  getLocations: () => request<any[]>('/locations'),
  searchLocations: (q: string) => request<any[]>(`/locations/search?q=${encodeURIComponent(q)}`),
  createLocation: (data: { name: string; address?: string }) =>
    request<any>('/locations', { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (id: string, data: { name: string; address?: string }) =>
    request<any>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (id: string) =>
    request<any>(`/locations/${id}`, { method: 'DELETE' }),

  // Expense Types
  getExpenseTypes: () => request<any[]>('/expense-types'),
  createExpenseType: (data: any) =>
    request<any>('/expense-types', { method: 'POST', body: JSON.stringify(data) }),
  updateExpenseType: (id: string, data: any) =>
    request<any>(`/expense-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpenseType: (id: string) =>
    request<any>(`/expense-types/${id}`, { method: 'DELETE' }),

  // Expenses
  getExpenses: (vehicleId: string, params?: { page?: number; startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    return request<{ expenses: any[]; pagination: any }>(`/vehicles/${vehicleId}/expenses?${qs}`);
  },
  getExpenseNotes: (vehicleId: string) =>
    request<{ notes: string[] }>(`/vehicles/${vehicleId}/expenses/notes`),
  createExpense: (vehicleId: string, data: any) =>
    request<any>(`/vehicles/${vehicleId}/expenses`, { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: any) =>
    request<any>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) =>
    request<any>(`/expenses/${id}`, { method: 'DELETE' }),

  // Periodic Expenses
  getPeriodicExpenses: (vehicleId: string) =>
    request<{ periodicExpenses: any[] }>(`/vehicles/${vehicleId}/periodic-expenses`),
  createPeriodicExpense: (vehicleId: string, data: any) =>
    request<any>(`/vehicles/${vehicleId}/periodic-expenses`, { method: 'POST', body: JSON.stringify(data) }),
  updatePeriodicExpense: (id: string, data: any) =>
    request<any>(`/periodic-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePeriodicExpense: (id: string) =>
    request<any>(`/periodic-expenses/${id}`, { method: 'DELETE' }),

  // Incomes
  getIncomes: (vehicleId: string, params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<{ incomes: any[]; pagination: any }>(`/vehicles/${vehicleId}/incomes?${qs}`);
  },
  createIncome: (vehicleId: string, data: { date: string; amount: number; typeName?: string; note?: string }) =>
    request<any>(`/vehicles/${vehicleId}/incomes`, { method: 'POST', body: JSON.stringify(data) }),
  updateIncome: (id: string, data: { date: string; amount: number; typeName?: string; note?: string }) =>
    request<any>(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIncome: (id: string) =>
    request<any>(`/incomes/${id}`, { method: 'DELETE' }),

  // Charging stations (historical, for quick-select)
  getChargingStations: () => request<{ stations: string[] }>('/charging-stations'),

  // Reports
  getConsumptionReport: (vehicleId: string, params?: { startDate?: string; endDate?: string; all?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.all) qs.set('all', '1');
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    return request<any>(`/vehicles/${vehicleId}/reports/consumption?${qs}`);
  },
  getExpenseReport: (vehicleId: string, params?: { startDate?: string; endDate?: string; all?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.all) qs.set('all', '1');
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    return request<any>(`/vehicles/${vehicleId}/reports/expense?${qs}`);
  },

  // Image Recognition
  recognizeImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return fetch(`${API_BASE}/image-recognition`, { method: 'POST', body: formData }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw { status: res.status, ...body };
      return body;
    });
  },

  // Settings
  getSettings: () => request<Record<string, string>>('/settings'),
  updateSettings: (data: Record<string, string>) =>
    request<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Auth
  getAuthStatus: () =>
    request<{ enabled: boolean; needsSetup: boolean; authenticated: boolean }>('/auth/status'),
  setupPassword: (password: string) =>
    request<{ success: boolean }>('/auth/setup', { method: 'POST', body: JSON.stringify({ password }) }),
  login: (password: string) =>
    request<{ success: boolean }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
