const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const trimmed = envUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API_BASE = getApiBase();

// Staff auth token helpers
export const getAuthToken = () => {
  return localStorage.getItem('ssc_auth_token');
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('ssc_auth_token', token);
  } else {
    localStorage.removeItem('ssc_auth_token');
  }
};

export const clearAuthToken = () => {
  localStorage.removeItem('ssc_auth_token');
  localStorage.removeItem('ssc_user_profile');
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('ssc_user_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem('ssc_user_profile', JSON.stringify(user));
  } else {
    localStorage.removeItem('ssc_user_profile');
  }
};

// Master auth token helpers
export const getMasterToken = () => {
  return localStorage.getItem('ssc_master_token');
};

export const setMasterToken = (token) => {
  if (token) {
    localStorage.setItem('ssc_master_token', token);
  } else {
    localStorage.removeItem('ssc_master_token');
  }
};

export const clearMasterToken = () => {
  localStorage.removeItem('ssc_master_token');
  localStorage.removeItem('ssc_master_user');
};

export const getStoredMasterUser = () => {
  try {
    const raw = localStorage.getItem('ssc_master_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredMasterUser = (user) => {
  if (user) {
    localStorage.setItem('ssc_master_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('ssc_master_user');
  }
};

// Fallback URL for dev environment if proxy drops
const getFallbackUrl = (endpoint) => {
  if (typeof window !== 'undefined' && window.location.port !== '5000') {
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000/api${endpoint}`;
  }
  return null;
};

// Central fetch wrapper with automatic Authorization + X-Master-Token headers
async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const masterToken = getMasterToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (masterToken) {
    headers['X-Master-Token'] = masterToken;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch {
    // If running in development (e.g. port 5173) and Vite proxy fails, try direct backend on 5000
    const fallbackUrl = getFallbackUrl(endpoint);
    if (fallbackUrl) {
      try {
        res = await fetch(fallbackUrl, {
          ...options,
          headers
        });
      } catch {
        throw new Error('Unable to connect to SSC TechCare server. Please visit http://localhost:5000 or ensure the backend server is running.');
      }
    } else {
      throw new Error('Unable to connect to SSC TechCare server. Please ensure the backend server is running on http://localhost:5000 and try again.');
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Master Authentication (Main Login Gateway)
  masterLogin: async (credentials) => {
    const data = await request('/auth/master-login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (data.masterToken) {
      setMasterToken(data.masterToken);
      setStoredMasterUser(data.masterUser);
    }
    return data;
  },

  getMasterMe: async () => {
    return request('/auth/master-me');
  },

  changeMasterPassword: async (passwords) => {
    return request('/auth/master-password', {
      method: 'PUT',
      body: JSON.stringify(passwords)
    });
  },

  masterForgotPassword: async (payload) => {
    return request('/auth/master-forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  masterVerifyCode: async (payload) => {
    return request('/auth/master-verify-code', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  masterResetPassword: async (payload) => {
    return request('/auth/master-reset-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  masterLogout: async () => {
    try {
      await request('/auth/master-logout', { method: 'POST' });
    } catch {
      // Continue client cleanup regardless
    }
    clearMasterToken();
    clearAuthToken();
    return { success: true };
  },

  // Staff Authentication
  login: async (credentials) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (data.token) {
      setAuthToken(data.token);
      setStoredUser(data.user);
    }
    return data;
  },

  getMe: async () => {
    return request('/auth/me');
  },

  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // Continue client cleanup regardless
    }
    clearAuthToken();
    return { success: true };
  },

  getUsers: async () => {
    return request('/auth/users');
  },

  createUser: async (userData) => {
    return request('/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  changePassword: async (passwordData) => {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(passwordData)
    });
  },

  toggleUserStatus: async (userId) => {
    return request(`/auth/users/${userId}/toggle`, {
      method: 'PUT'
    });
  },

  deleteUser: async (userId) => {
    return request(`/auth/users/${userId}`, {
      method: 'DELETE'
    });
  },

  // Dashboard
  getDashboard: async () => {
    return request('/dashboard');
  },

  // Revenue & Financial Analytics
  getRevenueAnalytics: async () => {
    return request('/revenue/analytics');
  },

  // Tickets
  getTickets: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/tickets${query ? '?' + query : ''}`);
  },

  getTicket: async (id) => {
    return request(`/tickets/${id}`);
  },

  createTicket: async (data) => {
    return request('/tickets', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTicket: async (id, data) => {
    return request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  updateTicketStatus: async (id, status, note, actor) => {
    return request(`/tickets/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note, actor })
    });
  },

  addTicketPart: async (ticketId, partData) => {
    return request(`/tickets/${ticketId}/parts`, {
      method: 'POST',
      body: JSON.stringify(partData)
    });
  },

  removeTicketPart: async (ticketId, partId) => {
    return request(`/tickets/${ticketId}/parts/${partId}`, {
      method: 'DELETE'
    });
  },

  addTimelineNote: async (ticketId, data) => {
    return request(`/tickets/${ticketId}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Inventory
  getInventory: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/inventory${query ? '?' + query : ''}`);
  },

  getCategories: async () => {
    return request('/inventory/categories');
  },

  getInventoryItem: async (id) => {
    return request(`/inventory/${id}`);
  },

  createInventoryItem: async (data) => {
    return request('/inventory', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateInventoryItem: async (id, data) => {
    return request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  adjustStock: async (id, change, reason) => {
    return request(`/inventory/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ change, reason })
    });
  },

  deleteInventoryItem: async (id) => {
    return request(`/inventory/${id}`, {
      method: 'DELETE'
    });
  },

  deduplicateInventory: async () => {
    return request('/inventory/deduplicate', {
      method: 'POST'
    });
  },

  // Customers
  getCustomers: async (search = '') => {
    return request(`/customers?search=${encodeURIComponent(search)}`);
  },

  getCustomer: async (id) => {
    return request(`/customers/${id}`);
  },

  createCustomer: async (data) => {
    return request('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateCustomer: async (id, data) => {
    return request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteCustomer: async (id, force = false) => {
    return request(`/customers/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE'
    });
  },

  // Technicians
  getTechnicians: async () => {
    return request('/technicians');
  },

  createTechnician: async (data) => {
    return request('/technicians', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTechnician: async (id, data) => {
    return request(`/technicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteTechnician: async (id) => {
    return request(`/technicians/${id}`, {
      method: 'DELETE'
    });
  },

  getTechnicianTickets: async (id) => {
    return request(`/technicians/${id}/tickets`);
  },

  // Invoices
  getInvoices: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/invoices${query ? '?' + query : ''}`);
  },

  getInvoice: async (id) => {
    return request(`/invoices/${id}`);
  },

  createInvoice: async (data) => {
    return request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  recordPayment: async (id, data) => {
    return request(`/invoices/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Public Track (Unauthenticated)
  trackTicket: async (identifier) => {
    const res = await fetch(`${API_BASE}/track/${encodeURIComponent(identifier)}`);
    return res.json();
  },

  // Settings
  getSettings: async () => {
    return request('/settings');
  },

  updateSettings: async (data) => {
    return request('/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  getSystemStats: async () => {
    return request('/settings/system-stats');
  },

  downloadBackup: async () => {
    const token = getAuthToken();
    const masterToken = getMasterToken();
    const res = await fetch(`${API_BASE}/settings/backup`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(masterToken ? { 'X-Master-Token': masterToken } : {})
      }
    });
    if (!res.ok) {
      throw new Error('Failed to download database backup');
    }
    const blob = await res.blob();
    const dateStr = new Date().toISOString().slice(0, 10);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SSC_TechCare_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return { success: true };
  },

  restoreBackup: async (file) => {
    const token = getAuthToken();
    const masterToken = getMasterToken();

    let bodyPayload;
    let contentType = 'application/json';

    if (file.name.endsWith('.json')) {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || !parsed.tables) {
          throw new Error('Invalid snapshot file: missing database tables data.');
        }
      } catch (err) {
        throw new Error('Invalid JSON file: ' + err.message);
      }
      bodyPayload = text;
    } else {
      bodyPayload = await file.arrayBuffer();
      contentType = 'application/octet-stream';
    }

    const res = await fetch(`${API_BASE}/settings/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(masterToken ? { 'X-Master-Token': masterToken } : {})
      },
      body: bodyPayload
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Database restore failed');
    }
    return data;
  }
};
