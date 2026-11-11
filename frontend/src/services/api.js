import axios from 'axios';

// Resolve base URL from Vite environment or default to local backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s timeout to handle Render cold-starts gracefully
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Response interceptor for unified error formatting
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const formattedError = {
      message: 'Failed to communicate with backend service.',
      status: error.response?.status || 500,
      details: error.response?.data?.message || error.message,
      isNetworkError: !error.response,
    };

    if (error.code === 'ECONNABORTED') {
      formattedError.message = 'Backend request timed out. If running on free tier, the server may be waking up.';
    } else if (!error.response) {
      formattedError.message = 'Unable to connect to the backend server. Please verify network connectivity.';
    }

    return Promise.reject(formattedError);
  }
);

export default apiClient;
