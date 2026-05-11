/**
 * API Helper - Centralized API call utility with caching
 * Ensures all API calls use the correct base URL for production and development
 */

import { TokenManager } from './api';

// Simple request cache for GET requests
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get the API base URL
 * In production: uses VITE_API_URL environment variable
 * In development: uses /api (Vite proxy)
 */
export const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (!apiUrl) {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('hexerve.online') || window.location.hostname.includes('vercel.app'))) {
      return 'https://workplus-backend-sg3a.onrender.com/api';
    }
    return '/api';
  }
  
  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  
  if (baseUrl === '/api' || baseUrl.endsWith('/api')) {
    return baseUrl;
  }
  
  return `${baseUrl}/api`;
};

/**
 * Build full API URL
 * @param endpoint - API endpoint (e.g., '/expenses', 'expenses/user/123')
 * @returns Full API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/${cleanEndpoint}`;
};

/**
 * Make an API request with proper headers and error handling
 * @param endpoint - API endpoint
 * @param options - Fetch options
 * @returns Response data
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = buildApiUrl(endpoint);
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const config: RequestInit = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

/**
 * GET request with caching
 */
export const apiGet = async <T = any>(endpoint: string, useCache = true): Promise<T> => {
  // Check cache for GET requests
  if (useCache && requestCache.has(endpoint)) {
    const cached = requestCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`📦 Using cached data for ${endpoint}`);
      return cached.data;
    }
  }

  const data = await apiRequest<T>(endpoint, { method: 'GET' });
  
  // Cache the result
  if (useCache) {
    requestCache.set(endpoint, { data, timestamp: Date.now() });
  }
  
  return data;
};

/**
 * Clear cache for specific endpoint or all
 */
export const clearApiCache = (endpoint?: string) => {
  if (endpoint) {
    requestCache.delete(endpoint);
  } else {
    requestCache.clear();
  }
};

/**
 * POST request
 */
export const apiPost = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  // Clear cache on POST (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined
  });
};

/**
 * PUT request
 */
export const apiPut = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  // Clear cache on PUT (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined
  });
};

/**
 * PATCH request
 */
export const apiPatch = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  // Clear cache on PATCH (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined
  });
};

/**
 * DELETE request
 */
export const apiDelete = async <T = any>(endpoint: string): Promise<T> => {
  // Clear cache on DELETE (data mutation)
  clearApiCache();
  return apiRequest<T>(endpoint, { method: 'DELETE' });
};

/**
 * File upload
 */
export const apiUpload = async <T = any>(
  endpoint: string,
  formData: FormData
): Promise<T> => {
  const url = buildApiUrl(endpoint);
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Upload failed');
  }

  // Clear cache on upload
  clearApiCache();
  return response.json();
};

/**
 * Get backend URL for file downloads and external links
 * Used for receipt downloads, document links, etc.
 */
export const getBackendUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (apiUrl) {
    // Remove /api suffix if present
    return apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
  }
  
  // Production fallback - use the deployed backend URL
  if (import.meta.env.PROD) {
    return 'https://workplus-backend-sg3a.onrender.com';
  }
  
  // Development fallback - use window.location.origin (Vite proxy will handle it)
  return window.location.origin;
};

/**
 * Build file download URL
 * @param filePath - File path from API (e.g., '/uploads/receipts/file.pdf')
 * @returns Full file URL
 */
export const buildFileUrl = (filePath: string): string => {
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  const backendUrl = getBackendUrl();
  return `${backendUrl}${filePath}`;
};
