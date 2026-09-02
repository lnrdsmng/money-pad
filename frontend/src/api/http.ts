import axios from 'axios';

// Set up the base Axios instance
const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // required for Sanctum cookie-based auth
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Interceptor for handling CSRF token and Bearer token
http.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

// Interceptor to normalize errors
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized (e.g., redirect to login)
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default http;
