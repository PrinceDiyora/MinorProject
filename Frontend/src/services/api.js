import axios from "axios";

// Create an Axios instance with base URL and credentials
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  withCredentials: true,
});

const refreshApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  withCredentials: true,
});

// Request interceptor to add Authorization header if token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const hasAccessToken = Boolean(localStorage.getItem("accessToken"));
    const isAuthEndpoint = /\/admin\/(login|register|refresh-token|logout)$/i.test(requestUrl);

    // Only try refresh for authenticated requests that are not auth endpoints.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      hasAccessToken &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const response = await refreshApi.post("/admin/refresh-token");
        const newToken = response.data.data.accessToken;

        localStorage.setItem("accessToken", newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear token and redirect to login
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Admin Authentication and Profile endpoints
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post("/admin/login", credentials);
    // Store token in localStorage for subsequent requests
    if (response.data.data?.accessToken) {
      localStorage.setItem("accessToken", response.data.data.accessToken);
    }
    return response.data;
  },
  register: async (data) => {
    // Note: Register endpoint is currently a placeholder as it's not defined in the backend routes yet
    const response = await api.post("/admin/register", data);
    // Clear token from localStorage
    localStorage.removeItem("accessToken");
    return response.data;
  },
  logout: async () => {
    const response = await api.post("/admin/logout");
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get("/admin/profile");
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.patch("/admin/profile", data);
    return response.data;
  },
  changePassword: async (data) => {
    const response = await api.patch("/admin/change-password", data);
    return response.data;
  },
  refreshToken: async () => {
    const response = await api.post("/admin/refresh-token");
    return response.data;
  },
};

// Food Items endpoints
export const foodItemsAPI = {
  getAll: async (params) => {
    const response = await api.get("/food-items", { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/food-items/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post("/food-items", data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/food-items/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/food-items/${id}`);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/food-items/${id}`, data);
    return response.data;
  },
  toggleAvailability: async (id) => {
    const response = await api.patch(`/food-items/${id}/toggle-availability`);
    return response.data;
  },
};

// Categories endpoints
export const categoriesAPI = {
  getAll: async () => {
    const response = await api.get("/categories");
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post("/categories", data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/categories/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};

// Orders endpoints
export const ordersAPI = {
  getAll: async (params) => {
    const response = await api.get("/orders", { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post("/orders", data);
    return response.data;
  },
  updateStatus: async (id, status) => {
    const response = await api.patch(`/orders/${id}/status`, { status });
    return response.data;
  },
  cancel: async (id) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
  },
  // options can be { period } for presets OR { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } for custom range
  getProfitability: async (options = {}) => {
    const params = typeof options === "string" ? { period: options } : options;
    const response = await api.get("/orders/analytics/profitability", { params });
    return response.data;
  },
};

// Customers endpoints
export const customersAPI = {
  getAll: async (params) => {
    const response = await api.get("/customers", { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post("/customers", data);
    return response.data;
  },
  update: async (id, data) => {
    const response = await api.patch(`/customers/${id}`, data);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
  getOrders: async (id) => {
    const response = await api.get(`/customers/${id}/orders`);
    return response.data;
  },
};

// Recommendations endpoints
export const recommendationsAPI = {
  get: async (data) => {
    const response = await api.post("/recommendations", data);
    return response.data;
  },
};

// ML-Powered Pricing endpoints
export const pricingAPI = {
  getSuggestions: async () => {
    const response = await api.get("/pricing/suggestions");
    return response.data;
  },
  getDynamic: async (data) => {
    const response = await api.post("/pricing/dynamic", data);
    return response.data;
  },
  getStrategic: async (data) => {
    const response = await api.post("/pricing/optimize", data);
    return response.data;
  },
};

// ML-Powered Upsell endpoints
export const upsellAPI = {
  getSuggestion: async (data) => {
    const response = await api.post("/upsell", data);
    return response.data;
  },
};

export default api;
