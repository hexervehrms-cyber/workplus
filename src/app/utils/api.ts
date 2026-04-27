/**
 * Centralized API Client - Production Ready
 * Features: Auto auth header, timeout, retry, error handling
 */

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://workplus-backend-sg3a.onrender.com';
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
const USER_KEY = 'user';

export const TokenManager = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  remove(): void {
    localStorage.removeItem(TOKEN_KEY);
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
    localStorage.removeItem(USER_KEY);
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
    const base = this.baseUrl.endsWith('/api') ? this.baseUrl : `${this.baseUrl}/api`;
    return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  // Make request with retry
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const token = TokenManager.get();

    // Check token expiration before request
    if (token && isTokenExpired(token)) {
      TokenManager.clear();
      throw new ApiError('Session expired', 401, 'TOKEN_EXPIRED');
    }

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

      if (response.success && response.data) {
        TokenManager.set(response.data.token);
        TokenManager.setUser({
          id: response.data.user.id,
          name: response.data.user.name,
          email: response.data.user.email,
          role: response.data.user.role,
          avatar: response.data.user.avatar,
          organization: response.data.user.organization
        });

        return {
          success: true,
          user: response.data.user,
          token: response.data.token
        };
      }

      throw new ApiError(response.message || 'Login failed');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  static async register(userData: any) {
    try {
      const response = await apiClient.post<any>('/auth/register', userData);

      if (response.success && response.data) {
        TokenManager.set(response.data.token);
        TokenManager.setUser(response.data.user);

        return {
          success: true,
          user: response.data.user,
          token: response.data.token
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
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          role: response.data.role,
          avatar: response.data.avatar,
          organization: response.data.organization
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
    const response = await apiClient.get<any[]>('/employees');
    return response.data || [];
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
    const response = await apiClient.patch<any>(`/expenses/${expenseId}/approve`, {});
    return response.data;
  }

  static async rejectExpense(expenseId: string, rejectionReason: string) {
    const response = await apiClient.patch<any>(`/expenses/${expenseId}/reject`, { rejectionReason });
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
    const response = await apiClient.get<any[]>('/leave-requests');
    return response.data || [];
  }

  static async getLeaveRequestsByUserId(userId: string) {
    const response = await apiClient.get<any[]>(`/leave-requests/user/${userId}`);
    return response.data || [];
  }

  static async createLeaveRequest(leaveData: any) {
    const response = await apiClient.post<any>('/leave-requests', leaveData);
    return response.data;
  }

  static async approveLeaveRequest(requestId: string) {
    const response = await apiClient.patch<any>(`/leave-requests/${requestId}/approve`, {});
    return response.data;
  }

  static async rejectLeaveRequest(requestId: string, rejectionReason: string) {
    const response = await apiClient.patch<any>(`/leave-requests/${requestId}/reject`, { rejectionReason });
    return response.data;
  }

  static async bulkApproveLeaveRequests(requestIds: string[]) {
    const response = await apiClient.post<any[]>('/leave-requests/bulk-approve', { requestIds });
    return response.data || [];
  }

  static async bulkRejectLeaveRequests(requestIds: string[], rejectionReason: string) {
    const response = await apiClient.post<any[]>('/leave-requests/bulk-reject', { requestIds, rejectionReason });
    return response.data || [];
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
