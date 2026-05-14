/**
 * Centralized API Client - Production Ready
 * Features: Auto auth header, timeout, retry, error handling
 */

// API Configuration - Production Ready
// In production, VITE_API_URL should be the full backend URL (e.g., https://workplus-backend-sg3a.onrender.com)
// In development, it falls back to /api which uses Vite proxy
const getApiBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  // If no API URL is set, use the production backend URL as fallback if on a production domain
  if (!apiUrl) {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('hexerve.online') || window.location.hostname.includes('vercel.app'))) {
      return 'https://workplus-backend-sg3a.onrender.com/api';
    }
    return '/api';
  }
  
  // Remove trailing slash if present
  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  
  // If it's already /api or ends with /api, return as is
  if (baseUrl === '/api' || baseUrl.endsWith('/api')) {
    return baseUrl;
  }
  
  // Otherwise add /api prefix
  return `${baseUrl}/api`;
};

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
        return 'Your session has expired. Please log in again.';
      case 'UNAUTHORIZED':
        return 'Invalid credentials. Please check your email and password.';
      case 'FORBIDDEN':
        return 'You do not have permission to perform this action.';
      case 'VALIDATION_ERROR':
        return this.message || 'Please check your input and try again.';
      case 'NETWORK_ERROR':
        return 'Unable to connect to server. Please check your internet connection.';
      default:
        if (this.status === 401) return 'Invalid credentials. Please try again.';
        if (this.status === 403) return 'Access denied.';
        if (this.status === 404) return 'Resource not found.';
        if (this.status === 429) return 'Too many requests. Please wait a moment.';
        if (this.status && this.status >= 500) return 'Server error. Please try again later.';
        return this.message || 'An unexpected error occurred.';
    }
  }
}

// Token management
const TOKEN_KEY = 'authToken';
/** Legacy key used by older code paths; must be honored so session checks match API calls. */
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export const TokenManager = {
  get(): string | null {
    const primary = localStorage.getItem(TOKEN_KEY);
    if (primary) return primary;
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      return legacy;
    }
    return null;
  },
  
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  
  setRefreshToken(refreshToken: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  
  remove(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  
  getUser(): any {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },
  
  setUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /** Remove only access tokens (keep user + refresh) — use when session uses httpOnly access cookie. */
  clearAccessTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
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
    let authToken = TokenManager.get();

    if (authToken && isTokenExpired(authToken)) {
      try {
        const refreshService = new TokenRefreshService();
        const refreshResult = await refreshService.refreshToken();
        if (refreshResult.success && refreshResult.data?.token) {
          authToken = refreshResult.data.token;
        } else {
          TokenManager.clear();
          throw new ApiError('Session expired', 401, 'TOKEN_EXPIRED');
        }
      } catch {
        TokenManager.clear();
        throw new ApiError('Session expired', 401, 'TOKEN_EXPIRED');
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
      const response = await apiClient.post<any>('/auth/login', {
        email: email.toLowerCase().trim(),
        password
      });

      console.log('Login response:', response);

      // Backend can return token and user in two formats:
      // 1. Nested in data: response.data.token, response.data.user
      // 2. At top level: response.token, response.user
      const token = response.data?.token || response.token;
      const user = response.data?.user || response.user;
      const refreshToken = response.data?.refreshToken || response.refreshToken;

      if (response.success && user) {
        TokenManager.clearAccessTokens();

        let userId = user.id || user.userId;
        let orgId = user.orgId || user.tenantId || 'system';
        if (token) {
          try {
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            userId = userId || tokenPayload.userId;
            orgId = tokenPayload.orgId || orgId;
          } catch {
            /* ignore */
          }
        }

        if (refreshToken) {
          TokenManager.setRefreshToken(refreshToken);
        }

        // Store access token for API calls (needed for exports and other requests)
        if (token) {
          TokenManager.set(token);
        }

        const userData = {
          id: String(userId),
          userId,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          organization: user.organization,
          tenantId: user.tenantId || orgId,
          orgId: orgId,
          employeeId: user.employeeId,
          employeeCode: user.employeeCode
        };

        TokenManager.setUser(userData);

        console.log('Login successful - token stored in localStorage:', userData);

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

  static async register(userData: any) {
    try {
      const response = await apiClient.post<any>('/auth/register', userData);

      if (response.success && response.data) {
        TokenManager.clearAccessTokens();
        const token = response.data.token;
        let orgId = response.data.user?.orgId || response.data.user?.tenantId || 'system';
        if (token) {
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
          orgId: u.orgId || orgId,
          tenantId: u.tenantId || orgId
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
  static async getAllEmployees() {
    const response = await apiClient.get<any>('/employees?simple=true');
    console.log('getAllEmployees full response:', response);
    
    // Handle paginated response structure
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    // Fallback for direct array response
    if (Array.isArray(response)) {
      return response;
    }
    
    return [];
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

// ============================================
// Leave Request Service
// ============================================
export class LeaveRequestService {
  static async getAllLeaveRequests() {
    const response = await apiClient.get<any>('/leave-requests');
    // Handle paginated response
    if (response.data?.data) {
      return response.data.data;
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  static async getLeaveRequestsByUserId(userId: string) {
    const response = await apiClient.get<any>(`/leave-requests/user/${userId}`);
    // Return the full response so frontend can access response.success and response.data
    return response;
  }

  static async createLeaveRequest(leaveData: any) {
    const response = await apiClient.post<any>('/leave-requests', leaveData);
    return response;
  }

  static async approveLeaveRequest(requestId: string, data?: any) {
    const response = await apiClient.patch<any>(`/leave-requests/${requestId}/approve`, data || {});
    return response.data;
  }

  static async rejectLeaveRequest(requestId: string, data?: any) {
    const response = await apiClient.patch<any>(`/leave-requests/${requestId}/reject`, data || {});
    return response.data;
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

  static async deleteLeaveRequest(requestId: string) {
    const response = await apiClient.delete<any>(`/leave-requests/${requestId}`);
    return response;
  }

  static async updateLeaveRequest(requestId: string, data: any) {
    const response = await apiClient.patch<any>(`/leave-requests/${requestId}`, data);
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
    const response = await apiClient.get<any[]>(`/holidays/organization/${organizationId}`);
    return response.data || [];
  }

  static async createHoliday(holidayData: any) {
    const response = await apiClient.post<any>('/holidays', holidayData);
    return response.data;
  }
}

// ============================================
// Payroll Service
// ============================================
export class PayrollService {
  static async getAllPayslips() {
    const response = await apiClient.get<any[]>('/payslips');
    return response.data || [];
  }

  static async getEmployeePayslips(employeeId: string) {
    const response = await apiClient.get<any[]>(`/payslips/employee/${employeeId}`);
    return response.data || [];
  }

  static async getMyPayslips() {
    const response = await apiClient.get<any[]>('/payslips/my-payslips');
    return response.data || [];
  }

  static async createPayslip(payslipData: any) {
    const response = await apiClient.post<any>('/payslips', payslipData);
    return response.data;
  }

  static async markPayslipAsPaid(payslipId: string) {
    const response = await apiClient.patch<any>(`/payslips/${payslipId}/pay`, {});
    return response.data;
  }

  static async deletePayslip(payslipId: string) {
    await apiClient.delete(`/payslips/${payslipId}`);
    return { success: true };
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
    const refreshToken = TokenManager.getRefreshToken();

    if (!refreshToken) {
      throw new ApiError('No refresh token available', 401, 'NO_REFRESH_TOKEN');
    }

    const url = `${getApiBaseUrl()}/security/auth/refresh-token`;
    const REFRESH_TIMEOUT = 15000;

    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        },
        REFRESH_TIMEOUT
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        TokenManager.clear();
        throw new ApiError(
          data.message || 'Token refresh failed',
          response.status,
          data.code
        );
      }

      if (data.data?.accessToken) {
        TokenManager.set(data.data.accessToken);
      }
      if (data.data?.user) {
        TokenManager.setUser(data.data.user);
      }

      return {
        success: !!data.success,
        data: data.data?.accessToken
          ? { token: data.data.accessToken as string, user: data.data.user }
          : undefined,
        message: data.message
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Unable to refresh session', 0, 'NETWORK_ERROR');
    }
  }
}

export class LeaveAllocationService {
  static async getEmployeeAllocations(employeeId: string, year?: number, month?: number) {
    let endpoint = `/leave-allocation/employee/${employeeId}`;
    if (year && month) {
      endpoint += `?year=${year}&month=${month}`;
    }
    const response = await apiClient.get<any>(endpoint);
    return response.data;
  }

  static async getOrganizationAllocations(orgId: string, year?: number, month?: number, status?: string) {
    let endpoint = `/leave-allocation/organization/${orgId}`;
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    if (status) params.append('status', status);
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    const response = await apiClient.get<any>(endpoint);
    return response.data;
  }

  static async createAllocation(data: any) {
    const response = await apiClient.post<any>('/leave-allocation', data);
    return response;
  }

  static async updateAllocation(allocationId: string, data: any) {
    const response = await apiClient.patch<any>(`/leave-allocation/${allocationId}`, data);
    return response.data;
  }

  static async deleteAllocation(allocationId: string) {
    const response = await apiClient.delete<any>(`/leave-allocation/${allocationId}`);
    return response.data;
  }

  static async getEmployeeBalance(employeeId: string, year?: number, month?: number) {
    let endpoint = `/leave-allocation/balance/${employeeId}`;
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }
    
    const response = await apiClient.get<any>(endpoint);
    // Return the entire response so frontend can access response.success and response.data
    return response;
  }

  static async deductLeaves(employeeId: string, leaveType: string, days: number, leaveRequestId?: string) {
    const response = await apiClient.post<any>('/leave-allocation/deduct', {
      employeeId,
      leaveType,
      days,
      leaveRequestId
    });
    return response.data;
  }

  static async restoreLeaves(employeeId: string, leaveType: string, days: number, leaveRequestId?: string) {
    const response = await apiClient.post<any>('/leave-allocation/restore', {
      employeeId,
      leaveType,
      days,
      leaveRequestId
    });
    return response.data;
  }

  static async bulkAllocate(orgId: string, year: number, month: number, employees: string[], allocations: any, allocatedBy: string) {
    const response = await apiClient.post<any>('/leave-allocation/bulk-allocate', {
      orgId,
      year,
      month,
      employees,
      allocations,
      allocatedBy
    });
    return response.data;
  }

  static async yearlyAllocate(orgId: string, year: number, employees: string[], casualLeave: number, earnedLeave: number, medicalLeave: number, allocatedBy: string) {
    const response = await apiClient.post<any>('/leave-allocation/yearly-allocate', {
      orgId,
      year,
      employees,
      casualLeave,
      earnedLeave,
      medicalLeave,
      allocatedBy
    });
    return response;
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

  static async updateSettings(orgId: string, enabledLeaveTypes: any, updatedBy: string) {
    const response = await apiClient.put<any>(`/leave-type-settings/${orgId}`, {
      enabledLeaveTypes,
      updatedBy
    });
    return response;
  }

  static async getEnabledLeaveTypes(orgId: string) {
    const response = await apiClient.get<any>(`/leave-type-settings/${orgId}/enabled`);
    return response;
  }
}
