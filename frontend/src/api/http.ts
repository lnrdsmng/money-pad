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

// Axios sends the same-origin CSRF cookie header; browser authentication uses HttpOnly sessions.
http.interceptors.request.use(async (config) => {
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
