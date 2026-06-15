/**
 * Centralized API Client - Production Ready
 * Features: Auto auth header, timeout, retry, error handling
 */

import {
  loadAccessTokenFromIndexedDB,
  getAccessTokenMirror,
  getRefreshTokenMirror,
  setAccessTokenMirror,
  clearAccessTokenMirror
} from './sessionAccessMirror';
import {
  ensureAccessToken,
  refreshAccessToken,
  hydrateAccessToken,
  setRefreshToken as persistRefreshToken,
} from './sessionAuth';
import { getApiBaseUrl } from './apiBaseUrl';

const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 1;

// API response interface
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// Error handling class
export class ApiError extends Error {
  public status?: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // Get user-friendly error message
  getUserMessage(): string {
    switch (this.code) {
      case 'DATABASE_UNAVAILABLE':
      case 'DATABASE_ERROR':
        return 'Service temporarily unavailable. Please try again in a moment.';
      case 'INVALID_TOKEN':
      case 'TOKEN_EXPIRED':
        return 'Your session has expired. Please sign in again.';
      case 'NO_TOKEN':
      case 'AUTH_REQUIRED':
      case 'AUTH_FAILED':
        return this.message || 'Please sign in again to continue.';
      case 'UNAUTHORIZED':
        return 'Invalid credentials. Please check your email and password.';
      case 'FORBIDDEN':
      case 'INSUFFICIENT_PERMISSIONS':
      case 'PERMISSION_DENIED':
        return this.message || 'You do not have permission to perform this action.';
      case 'VALIDATION_ERROR':
        return this.message || 'Please check your input and try again.';
      case 'NETWORK_ERROR':
        return 'Unable to connect to server. Please check your internet connection.';
      default:
        if (this.status === 401) {
          return this.message || 'Please sign in again to continue.';
        }
        if (this.status === 403) {
          return this.message || 'Access denied.';
        }
        if (this.status === 404) return 'Resource not found.';
        if (this.status === 429) return 'Too many requests. Please wait a moment.';
        if (this.status && this.status >= 500) return 'Server error. Please try again later.';
        return this.message || 'An unexpected error occurred.';
    }
  }
}

// Token management (httpOnly cookie + optional IndexedDB mirror for Authorization header)
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export const TokenManager = {
  get(): string | null {
    return getAccessTokenMirror();
  },

  /** Prime memory from IndexedDB — call once during app bootstrap before API calls. */
  async hydrateFromIndexedDB(): Promise<void> {
    await loadAccessTokenFromIndexedDB();
  },
  
  set(token: string): void {
    setAccessTokenMirror(token || null);
  },
  
  getRefreshToken(): string | null {
    return getRefreshTokenMirror();
  },
  
  remove(): void {
    // Cookies are cleared by backend on logout
  },
  
  getUser(): any {
    // Extract user data from JWT token in httpOnly cookie
    // This is done via the /api/auth/me endpoint
    return null;
  },
  
  setUser(user: any): void {
    // User data is stored in Redis on backend
    // Frontend doesn't store it locally
  },
  
  clear(): void {
    clearAccessTokenMirror();
  },

  setRefresh(token: string): void {
    persistRefreshToken(token);
  },

  /** Remove only access tokens (keep user + refresh) — use when session uses httpOnly access cookie. */
  clearAccessTokens(): void {
    clearAccessTokenMirror();
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }
};

// Check if token is expired
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= exp;
  } catch {
    return true;
  }
}

export { ensureAccessToken, refreshAccessToken, hydrateAccessToken };

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// API Client class
export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  // Build full URL
  private buildUrl(endpoint: string): string {
    // Remove leading /api/ from endpoint if present (base URL already has /api)
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const baseUrl = getApiBaseUrl();
    
    // Remove /api prefix from endpoint if present to avoid duplication
    const finalEndpoint = cleanEndpoint.startsWith('api/') ? cleanEndpoint.slice(4) : cleanEndpoint;
    
    return `${baseUrl}/${finalEndpoint}`;
  }

  // Make request with retry
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    let authToken = (await ensureAccessToken()) || TokenManager.get();

    if (authToken && isTokenExpired(authToken) && TokenManager.getRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        authToken = refreshed;
        TokenManager.set(refreshed);
      }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
      ...options.headers
    };

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include' // Enable cookie support for CORS
    };

    try {
      const response = await fetchWithTimeout(url, config, this.timeout);
      let data: any;

      // Try to parse JSON
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      // Handle non-OK responses
      if (!response.ok) {
        if (response.status === 401 && retryCount < MAX_RETRIES) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            TokenManager.set(refreshed);
            return this.request<T>(endpoint, options, retryCount + 1);
          }
        }
        const error = new ApiError(
          data.message || data.error || `Request failed with status ${response.status}`,
          response.status,
          data.code,
          data
        );
        throw error;
      }

      // Ensure success field
      if (data.success === undefined) {
        data.success = true;
      }

      return data;
    } catch (error: any) {
      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out', 0, 'TIMEOUT');
      }

      // Handle network errors with retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying request to ${endpoint}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        throw new ApiError('Network error - unable to reach server', 0, 'NETWORK_ERROR');
      }

      // Re-throw ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Unknown error
      throw new ApiError(error.message || 'Unknown error', 500, 'UNKNOWN_ERROR');
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE'
    });
  }

  // File upload
  async upload<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const token = TokenManager.get();

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: formData
    }, this.timeout);

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.message || 'Upload failed', response.status, data.code);
    }

    return data;
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// ============================================
// Authentication Service
// ============================================
export class AuthService {
  static async login(email: string, password: string) {
    try {
      type LoginPayload = {
        token?: string;
        user?: Record<string, unknown>;
        refreshToken?: string;
      };
      const response = await apiClient.post<LoginPayload>('/auth/login', {
        email: email.toLowerCase().trim(),
        password
      });

      console.log('Login response:', response);

      // Backend may return token and user in response.data or at top level
      const root = response as ApiResponse<LoginPayload> & LoginPayload;
      const loginPayload = response.data ?? root;
      const token =
        loginPayload.token ||
        (loginPayload as LoginPayload & { data?: LoginPayload }).data?.token ||
        root.token;
      const user = loginPayload.user || root.user;
      const refreshToken =
        loginPayload.refreshToken ||
        (loginPayload as LoginPayload & { data?: LoginPayload }).data?.refreshToken ||
        root.data?.refreshToken;

      if (response.success && user) {
        // Extract role from JWT token
        let role = user.role;
        if (token && !role) {
          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            role = tokenPayload.role;
          } catch {
            /* ignore */
          }
        }

        console.log('✅ Login successful - Role from JWT:', role);

        // Return user data with role from JWT
        // Do NOT store in localStorage - only in memory
        const userData = {
          id: String(user.id || user.userId),
          userId: user.userId || user.id,
          name: user.name,
          email: user.email,
          role: role || user.role, // Use role from JWT
          avatar: user.avatar,
          organization: user.organization,
          tenantId: user.tenantId || user.orgId,
          orgId: user.orgId || user.tenantId,
          employeeId: user.employeeId,
          employeeCode: user.employeeCode
        };

        console.log('User data to return:', userData);

        if (token) {
          TokenManager.set(token);
        }
        if (refreshToken) {
          TokenManager.setRefresh(refreshToken);
        }

        return {
          success: true,
          user: userData,
          token: token || ''
        };
      }

      throw new ApiError(response.message || 'Login failed', 401, 'LOGIN_FAILED');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /** Requires `inviteToken` from an admin onboarding link; role/org are set server-side. */
  static async register(userData: { name: string; email: string; password: string; inviteToken: string }) {
    try {
      const response = await apiClient.post<any>('/auth/register', userData);

      if (response.success && response.data) {
        TokenManager.clearAccessTokens();
        const token = response.data.token;
        let orgId = response.data.user?.orgId || response.data.user?.tenantId;
        if (!orgId && token) {
          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            orgId = tokenPayload.orgId || orgId;
          } catch {
            /* ignore */
          }
        }
        const u = response.data.user;
        TokenManager.setUser({
          ...u,
          id: u.id || u._id,
          ...(orgId ? { orgId: u.orgId || orgId, tenantId: u.tenantId || orgId } : {})
        });

        return {
          success: true,
          user: response.data.user,
          token: token || ''
        };
      }

      throw new ApiError(response.message || 'Registration failed');
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  static async getCurrentUser() {
    try {
      await ensureAccessToken();
      const response = await apiClient.get<any>('/auth/me');
      
      if (response.success && response.data) {
        return {
          id: response.data._id || response.data.id || response.data.userId,
          userId: response.data._id || response.data.id || response.data.userId,
          name: response.data.firstName && response.data.lastName 
            ? `${response.data.firstName} ${response.data.lastName}`
            : response.data.name || '',
          email: response.data.email,
          role: response.data.role,
          avatar: response.data.avatar,
          organization: response.data.organization,
          employeeId: response.data.employeeId,
          employeeCode: response.data.employeeCode,
          tenantId: response.data.tenantId,
          orgId: response.data.orgId
        };
      }

      return null;
    } catch (error: any) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  static async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      TokenManager.clear();
    }
    return { success: true };
  }

  /**
   * Verify user's role and session validity
   * Used to ensure correct dashboard routing
   */
  static async verifyRole() {
    try {
      const response = await apiClient.get<any>('/auth/verify-role');
      
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        };
      }

      return {
        success: false,
        error: response.message || 'Role verification failed'
      };
    } catch (error: any) {
      console.error('Role verification error:', error);
      return {
        success: false,
        error: error.message || 'Role verification failed'
      };
    }
  }

  static async createAdmin(adminData: any) {
    try {
      const response = await apiClient.post<any>('/auth/create-admin', adminData);

      if (response.success && response.data) {
        return { success: true, user: response.data };
      }

      throw new ApiError(response.message || 'Failed to create admin');
    } catch (error: any) {
      console.error('Create admin error:', error);
      throw error;
    }
  }
}

// ============================================
// User Service
// ============================================
export class UserService {
  static async getUserById(userId: string) {
    const response = await apiClient.get<any>(`/users/${userId}`);
    return response.data;
  }

  static async getAllUsers() {
    const response = await apiClient.get<any[]>('/users');
    return response.data || [];
  }

  static async updateUser(userId: string, userData: any) {
    const response = await apiClient.put<any>(`/users/${userId}`, userData);
    return response.data;
  }

  static async deleteUser(userId: string) {
    await apiClient.delete(`/users/${userId}`);
    return { success: true };
  }
}

// ============================================
// Employee Service
// ============================================
export class EmployeeService {
  static async getAllEmployees(orgContext?: { role?: string; orgId?: string; tenantId?: string }) {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    let url = '/employees?simple=true&limit=1000';
    if (orgContext?.role === 'super_admin') {
      const oid = orgContext.orgId || orgContext.tenantId;
      if (oid && oid !== 'system') {
        url += `&orgId=${encodeURIComponent(oid)}`;
      }
    }
    const response = await apiGet<unknown>(url, false);
    return extractApiList(response);
  }

  static async getEmployeeById(employeeId: string) {
    const response = await apiClient.get<any>(`/employees/${employeeId}`);
    return response.data;
  }

  static async getEmployeeByUserId(userId: string) {
    const response = await apiClient.get<any>(`/employees/user/${userId}`);
    return response.data;
  }

  static async createEmployee(employeeData: any) {
    const response = await apiClient.post<any>('/employees', employeeData);
    return response.data;
  }

  static async updateEmployee(employeeId: string, employeeData: any) {
    const response = await apiClient.put<any>(`/employees/${employeeId}`, employeeData);
    return response.data;
  }

  static async deleteEmployee(employeeId: string) {
    await apiClient.delete(`/employees/${employeeId}`);
    return { success: true };
  }
}

// ============================================
// Department Service
// ============================================
export interface DepartmentRecord {
  _id: string | null;
  name: string;
  description?: string;
  headName?: string;
  code?: string;
  employeeCount?: number;
  isActive?: boolean;
  source?: 'database' | 'employees';
}

export class DepartmentService {
  static async getAll(options?: {
    search?: string;
    status?: 'active' | 'inactive' | 'all';
    orgId?: string;
  }): Promise<DepartmentRecord[]> {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const params = new URLSearchParams();
    if (options?.search?.trim()) params.set('search', options.search.trim());
    if (options?.status && options.status !== 'active') params.set('status', options.status);
    if (options?.orgId) params.set('orgId', options.orgId);
    const qs = params.toString();
    const response = await apiGet<unknown>(`/departments${qs ? `?${qs}` : ''}`);
    return extractApiList<DepartmentRecord>(response);
  }

  static async getEmployeesByDepartment(
    departmentName: string,
    orgId?: string
  ): Promise<unknown[]> {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const params = new URLSearchParams({
      department: departmentName,
      simple: 'true',
      limit: '500',
    });
    if (orgId) params.set('orgId', orgId);
    const response = await apiGet<unknown>(`/employees?${params.toString()}`);
    return extractApiList(response);
  }
}

// ============================================
// Expense Service
// ============================================
export class ExpenseService {
  static async getAllExpenses() {
    const response = await apiClient.get<any[]>('/expenses');
    return response.data || [];
  }

  static async getExpensesByUserId(userId: string) {
    const response = await apiClient.get<any[]>(`/expenses/user/${userId}`);
    return response.data || [];
  }

  static async createExpense(expenseData: any) {
    const response = await apiClient.post<any>('/expenses', expenseData);
    return response.data;
  }

  static async updateExpense(expenseId: string, expenseData: any) {
    const response = await apiClient.put<any>(`/expenses/${expenseId}`, expenseData);
    return response.data;
  }

  static async deleteExpense(expenseId: string) {
    await apiClient.delete(`/expenses/${expenseId}`);
    return { success: true };
  }

  static async approveExpense(expenseId: string) {
    const response = await apiClient.put<any>(`/expenses/${expenseId}/approve`, {});
    return response.data;
  }

  static async rejectExpense(expenseId: string, rejectionReason: string) {
    const response = await apiClient.put<any>(`/expenses/${expenseId}/reject`, { rejectionReason });
    return response.data;
  }

  static async bulkApproveExpenses(expenseIds: string[]) {
    const response = await apiClient.post<any[]>('/expenses/bulk-approve', { expenseIds });
    return response.data || [];
  }

  static async bulkRejectExpenses(expenseIds: string[], rejectionReason: string) {
    const response = await apiClient.post<any[]>('/expenses/bulk-reject', { expenseIds, rejectionReason });
    return response.data || [];
  }
}

/** Normalize list payloads from paginated or flat API responses. */
export function extractApiList<T = unknown>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== 'object') return [];
  const body = response as { data?: unknown };
  if (Array.isArray(body.data)) return body.data as T[];
  if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    const nested = (body.data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

// ============================================
// Leave Request Service
// ============================================
export class LeaveRequestService {
  static async getAllLeaveRequests() {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const response = await apiGet<{ success?: boolean; data?: unknown }>(
      '/leave-requests?limit=500',
      false
    );
    return response;
  }

  static async getLeaveRequestsByUserId(userId: string) {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiGet<{ success?: boolean; data?: unknown }>(
      `/leave-requests/user/${userId}?limit=200`,
      false
    );
  }

  static async createLeaveRequest(leaveData: any) {
    const { apiPost } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPost<{ success?: boolean; message?: string; data?: unknown }>(
      '/leave-requests',
      leaveData
    );
  }

  static async approveLeaveRequest(requestId: string, data?: any) {
    const { apiPatch } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPatch<{ success?: boolean; message?: string; data?: unknown }>(
      `/leave-requests/${requestId}/approve`,
      data || {}
    );
  }

  static async rejectLeaveRequest(requestId: string, data?: any) {
    const { apiPatch } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPatch<{ success?: boolean; message?: string; data?: unknown }>(
      `/leave-requests/${requestId}/reject`,
      data || {}
    );
  }

  static async bulkApproveLeaveRequests(requestIds: string[]) {
    const response = await apiClient.post<any>('/leave-requests/bulk-approve', { requestIds });
    if (response.data?.data) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  static async bulkRejectLeaveRequests(requestIds: string[], rejectionReason: string) {
    const response = await apiClient.post<any>('/leave-requests/bulk-reject', { requestIds, rejectionReason });
    if (response.data?.data) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  static async bulkDeleteLeaveRequests(requestIds: string[]) {
    const response = await apiClient.post<any>('/leave-requests/bulk-delete', { requestIds });
    if (response.data?.data) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  static async deleteLeaveRequest(requestId: string) {
    const { apiDelete, clearApiCache } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const response = await apiDelete<{ success?: boolean; message?: string }>(
      `/leave-requests/${requestId}`
    );
    clearApiCache('/leave-requests');
    return response;
  }

  static async updateLeaveRequest(requestId: string, data: any) {
    const { apiPatch, clearApiCache } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    const response = await apiPatch<{ success?: boolean; message?: string; data?: unknown }>(
      `/leave-requests/${requestId}`,
      data
    );
    clearApiCache('/leave-requests');
    return response;
  }

  static async cleanupAllLeaveRequests() {
    const response = await apiClient.delete<any>('/leave-requests/cleanup/all');
    return response;
  }
}

// ============================================
// Document Service
// ============================================
export class DocumentService {
  static async getDocumentsByUserId(userId: string) {
    const response = await apiClient.get<any[]>(`/documents/${userId}`);
    return response.data || [];
  }

  static async uploadDocument(documentData: any) {
    const formData = new FormData();
    formData.append('userId', documentData.userId);
    formData.append('name', documentData.name);
    formData.append('type', documentData.type);
    formData.append('document', documentData.file);

    return apiClient.upload<any>('/documents/upload', formData);
  }
}

// ============================================
// Holiday Service
// ============================================
export class HolidayService {
  static async getAllHolidays() {
    const response = await apiClient.get<any[]>('/holidays');
    return response.data || [];
  }

  static async getHolidaysByOrganization(organizationId: string) {
    const year = new Date().getFullYear();
    const response = await apiClient.get<any[]>(
      `/holidays?year=${year}&limit=500&orgId=${encodeURIComponent(organizationId)}`
    );
    return response.data || [];
  }

  static async createHoliday(holidayData: any) {
    const response = await apiClient.post<any>('/holidays', holidayData);
    return response.data;
  }
}

// ============================================
// Payroll Service (legacy — use /api/salary routes via employee Payroll page)
// ============================================
/** @deprecated Legacy /payslips API is not mounted; use SalarySlip routes under /api/salary */
export class PayrollService {
  private static deprecated(): never {
    throw new Error(
      'PayrollService is deprecated. Use employee Payroll (/salary/slips) or admin Payroll pages instead.'
    );
  }

  static async getAllPayslips() {
    return PayrollService.deprecated();
  }

  static async getEmployeePayslips(_employeeId: string) {
    return PayrollService.deprecated();
  }

  static async getMyPayslips() {
    return PayrollService.deprecated();
  }

  static async createPayslip(_payslipData: unknown) {
    return PayrollService.deprecated();
  }

  static async markPayslipAsPaid(_payslipId: string) {
    return PayrollService.deprecated();
  }

  static async deletePayslip(_payslipId: string) {
    return PayrollService.deprecated();
  }
}

// ============================================
// Advance/Loan Service
// ============================================
export class AdvanceLoanService {
  static async getAllAdvancesLoans() {
    const response = await apiClient.get<any[]>('/advances-loans');
    return response.data || [];
  }

  static async getEmployeeAdvancesLoans(employeeId: string) {
    const response = await apiClient.get<any[]>(`/advances-loans/employee/${employeeId}`);
    return response.data || [];
  }

  static async getMyAdvancesLoans() {
    const response = await apiClient.get<any[]>('/advances-loans/my-requests');
    return response.data || [];
  }

  static async createAdvanceLoan(data: any) {
    const response = await apiClient.post<any>('/advances-loans', data);
    return response.data;
  }

  static async approveAdvanceLoan(id: string) {
    const response = await apiClient.patch<any>(`/advances-loans/${id}/approve`, {});
    return response.data;
  }

  static async rejectAdvanceLoan(id: string, rejectionReason: string) {
    const response = await apiClient.patch<any>(`/advances-loans/${id}/reject`, { rejectionReason });
    return response.data;
  }

  static async payInstallment(id: string) {
    const response = await apiClient.patch<any>(`/advances-loans/${id}/pay-installment`, {});
    return response.data;
  }

  static async deleteAdvanceLoan(id: string) {
    await apiClient.delete(`/advances-loans/${id}`);
    return { success: true };
  }
}

// ============================================
// Token Refresh Service
// ============================================
export class TokenRefreshService {
  async refreshToken(): Promise<ApiResponse<{ token: string; user: any }>> {
    const accessToken = await refreshAccessToken();
    if (accessToken) {
      TokenManager.set(accessToken);
      return {
        success: true,
        data: { token: accessToken, user: TokenManager.getUser() },
      };
    }
    throw new ApiError('Unable to refresh session', 401, 'AUTH_REQUIRED');
  }
}

export class LeaveAllocationService {
  static async getEmployeeAllocations(employeeId: string, year?: number, month?: number) {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    let endpoint = `/leave-allocation/employee/${employeeId}`;
    if (year && month) {
      endpoint += `?year=${year}&month=${month}`;
    }
    return apiGet(endpoint, false);
  }

  static async getOrganizationAllocations(
    orgId: string,
    year?: number,
    month?: number | null,
    status?: string
  ) {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    let endpoint = `/leave-allocation/organization/${orgId}`;
    const params = new URLSearchParams({ limit: '500' });
    if (year) params.append('year', year.toString());
    if (month != null && month > 0) params.append('month', month.toString());
    if (status) params.append('status', status);
    endpoint += `?${params.toString()}`;
    const response = await apiGet<unknown>(endpoint, false);
    return extractApiList(response);
  }

  static async createAllocation(data: any) {
    const { apiPost } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPost<{ success?: boolean; message?: string; data?: unknown }>(
      '/leave-allocation',
      data
    );
  }

  static async updateAllocation(allocationId: string, data: any) {
    const { apiPatch } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPatch<{ success?: boolean; message?: string; data?: unknown }>(
      `/leave-allocation/${allocationId}`,
      data
    );
  }

  static async deleteAllocation(allocationId: string) {
    const { apiDelete } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiDelete<{ success?: boolean; message?: string }>(
      `/leave-allocation/${allocationId}`
    );
  }

  static async getEmployeeBalance(employeeId: string, year?: number, month?: number) {
    const { apiGet } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    let endpoint = `/leave-allocation/balance/${employeeId}`;
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    return apiGet<{ success?: boolean; data?: unknown }>(endpoint, false);
  }

  static async deductLeaves(employeeId: string, leaveType: string, days: number, leaveRequestId?: string) {
    const { apiPost } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPost<{ success?: boolean; data?: unknown }>('/leave-allocation/deduct', {
      employeeId,
      leaveType,
      days,
      leaveRequestId,
    });
  }

  static async restoreLeaves(employeeId: string, leaveType: string, days: number, leaveRequestId?: string) {
    const { apiPost } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPost<{ success?: boolean; data?: unknown }>('/leave-allocation/restore', {
      employeeId,
      leaveType,
      days,
      leaveRequestId,
    });
  }

  static async bulkAllocate(orgId: string, year: number, month: number, employees: string[], allocations: any, allocatedBy: string) {
    const { apiPost } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPost<{ success?: boolean; data?: unknown }>('/leave-allocation/bulk-allocate', {
      orgId,
      year,
      month,
      employees,
      allocations,
      allocatedBy,
    });
  }

  static async yearlyAllocate(orgId: string, year: number, employees: string[], casualLeave: number, earnedLeave: number, medicalLeave: number, allocatedBy: string) {
    const { apiPost } = await import('./apiHelper');
    const { ensureAccessToken } = await import('./sessionAuth');
    await ensureAccessToken();
    return apiPost<{ success?: boolean; data?: unknown }>('/leave-allocation/yearly-allocate', {
      orgId,
      year,
      employees,
      casualLeave,
      earnedLeave,
      medicalLeave,
      allocatedBy,
    });
  }
}

// ============================================
// Leave Type Settings Service
// ============================================
export class LeaveTypeSettingsService {
  static async getSettings(orgId: string) {
    const response = await apiClient.get<any>(`/leave-type-settings/${orgId}`);
    return response;
  }

  static async updateSettings(
    orgId: string,
    enabledLeaveTypes: any,
    updatedBy: string,
    balanceKpiVisibility?: Record<string, boolean>
  ) {
    const response = await apiClient.put<any>(`/leave-type-settings/${orgId}`, {
      enabledLeaveTypes,
      updatedBy,
      ...(balanceKpiVisibility ? { balanceKpiVisibility } : {})
    });
    return response;
  }

  static async getEnabledLeaveTypes(orgId: string) {
    const response = await apiClient.get<any>(`/leave-type-settings/${orgId}/enabled`);
    return response;
  }
}
