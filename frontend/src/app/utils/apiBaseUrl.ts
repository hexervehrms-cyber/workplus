/**
 * Shared API base URL (no imports from api.ts to avoid circular deps).
 */
export function getApiBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl) {
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('hexerve.online') ||
        window.location.hostname.includes('vercel.app'))
    ) {
      return 'https://workplus-backend-sg3a.onrender.com/api';
    }
    return '/api';
  }

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

  if (baseUrl === '/api' || baseUrl.endsWith('/api')) {
    return baseUrl;
  }

  return `${baseUrl}/api`;
}
