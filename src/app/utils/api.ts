// API service layer for frontend-backend communication
import { useAuth } from '../context/AuthContext';

// API base URL - should be configured in environment
// Remove /api suffix if present in VITE_API_URL
const baseUrl = import.meta.env.VITE_API_URL || 'https://workplus-backend-sg3a.onrender.com';
const API_BASE_URL = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;

// API response interface
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Error handling wrapper
export class ApiError extends Error {
  public status?: number;
  public details?: any;

  constructor(
    public message: string,
    status?: number,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 500;
    this.details = details;
  }
}

// Generic API client
export class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  // Set authentication token
  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // Get authentication token
  getToken(): string | null {
    return this.token || localStorage.getItem('authToken');
  }

  // Clear authentication token
  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: any = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const config: any = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers || {})
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.message || data.error || 'Request failed',
          response.status,
          data
        );
      }

      // Ensure response has success field
      if (data.success === undefined) {
        data.success = true;
      }

      return data;
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors
      if (error instanceof TypeError) {
        throw new ApiError(
          'Network error - unable to reach server',
          0,
          error
        );
      }
      
      throw new ApiError(
        error.message || 'Network error',
        500,
        error
      );
    }
  }

  // GET requests
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  // POST requests
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(`${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // PUT requests
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(`${endpoint}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE requests
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(`${endpoint}`, {
      method: 'DELETE'
    });
  }

  // PATCH requests
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(`${endpoint}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }
}

// Create singleton API client instance
const apiClient = new ApiClient();

// Export API client and utilities
export { apiClient };

// Authentication service
export class AuthService {
  // Login
  static async login(email: string, password: string) {
    try {
      const response = await apiClient.post<any>('/auth/login', {
        email,
        password
      });

      if (response.success && response.data) {
        // Store token and user data
        apiClient.setToken(response.data.token);
        
        // Return user data in expected format
        return {
          success: true,
          user: {
            id: response.data.user.id,
            name: response.data.user.name,
            email: response.data.user.email,
            role: response.data.user.role,
            avatar: response.data.user.avatar,
            organization: response.data.user.organization
          },
          token: response.data.token
        };
      }

      throw new ApiError(response.message || 'Login failed');
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register
  static async register(userData: any) {
    try {
      const response = await apiClient.post<any>('/auth/register', userData);

      if (response.success && response.data) {
        // Store token and user data
        apiClient.setToken(response.data.token);
        
        return {
          success: true,
          user: {
            id: response.data.user.id,
            name: response.data.user.name,
            email: response.data.user.email,
            role: response.data.user.role,
            avatar: response.data.user.avatar,
            organization: response.data.user.organization
          },
          token: response.data.token
        };
      }

      throw new ApiError(response.message || 'Registration failed');
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Get current user
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

  // Logout
  static async logout() {
    try {
      await apiClient.post('/auth/logout', {});
      apiClient.clearToken();
      return { success: true };
    } catch (error: any) {
      console.error('Logout error:', error);
      // Clear token even if logout fails
      apiClient.clearToken();
      return { success: true };
    }
  }

  // Create Admin (Super Admin only)
  static async createAdmin(adminData: { name: string; email: string; password: string; organization?: string; orgId?: string }) {
    try {
      const response = await apiClient.post<any>('/auth/create-admin', adminData);

      if (response.success && response.data) {
        return {
          success: true,
          user: response.data
        };
      }

      throw new ApiError(response.message || 'Failed to create admin');
    } catch (error: any) {
      console.error('Create admin error:', error);
      throw error;
    }
  }
}

// User service
export class UserService {
  // Get user by ID
  static async getUserById(userId: string) {
    try {
      const response = await apiClient.get<any>(`/users/${userId}`);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('User not found');
    } catch (error: any) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  // Get all users (admin only)
  static async getAllUsers() {
    try {
      const response = await apiClient.get<any[]>('/users');
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get users');
    } catch (error: any) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  // Update user
  static async updateUser(userId: string, userData: any) {
    try {
      const response = await apiClient.put<any>(`/users/${userId}`, userData);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to update user');
    } catch (error: any) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  // Delete user
  static async deleteUser(userId: string) {
    try {
      const response = await apiClient.delete(`/users/${userId}`);
      
      if (response.success) {
        return { success: true };
      }

      throw new ApiError('Failed to delete user');
    } catch (error: any) {
      console.error('Delete user error:', error);
      throw error;
    }
  }
}

// Expense service
export class ExpenseService {
  // Get all expenses
  static async getAllExpenses() {
    try {
      const response = await apiClient.get<any[]>('/expenses');
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get expenses');
    } catch (error: any) {
      console.error('Get all expenses error:', error);
      throw error;
    }
  }

  // Get expenses by user ID
  static async getExpensesByUserId(userId: string) {
    try {
      const response = await apiClient.get<any[]>(`/expenses/user/${userId}`);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get user expenses');
    } catch (error: any) {
      console.error('Get user expenses error:', error);
      throw error;
    }
  }

  // Create expense
  static async createExpense(expenseData: any) {
    try {
      const response = await apiClient.post<any>('/expenses', expenseData);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError(response.message || 'Failed to create expense');
    } catch (error: any) {
      console.error('Create expense error:', error);
      throw error;
    }
  }

  // Update expense
  static async updateExpense(expenseId: string, expenseData: any) {
    try {
      const response = await apiClient.put<any>(`/expenses/${expenseId}`, expenseData);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to update expense');
    } catch (error: any) {
      console.error('Update expense error:', error);
      throw error;
    }
  }

  // Delete expense
  static async deleteExpense(expenseId: string) {
    try {
      const response = await apiClient.delete(`/expenses/${expenseId}`);
      
      if (response.success) {
        return { success: true };
      }

      throw new ApiError('Failed to delete expense');
    } catch (error: any) {
      console.error('Delete expense error:', error);
      throw error;
    }
  }

  // Approve expense
  static async approveExpense(expenseId: string) {
    try {
      const response = await apiClient.patch<any>(`/expenses/${expenseId}/approve`, {});
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to approve expense');
    } catch (error: any) {
      console.error('Approve expense error:', error);
      throw error;
    }
  }

  // Reject expense
  static async rejectExpense(expenseId: string, rejectionReason: string) {
    try {
      const response = await apiClient.patch<any>(`/expenses/${expenseId}/reject`, {
        rejectionReason
      });
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to reject expense');
    } catch (error: any) {
      console.error('Reject expense error:', error);
      throw error;
    }
  }

  // Bulk approve expenses
  static async bulkApproveExpenses(expenseIds: string[]) {
    try {
      const response = await apiClient.post<any[]>('/expenses/bulk-approve', {
        expenseIds
      });
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to bulk approve expenses');
    } catch (error: any) {
      console.error('Bulk approve expenses error:', error);
      throw error;
    }
  }

  // Bulk reject expenses
  static async bulkRejectExpenses(expenseIds: string[], rejectionReason: string) {
    try {
      const response = await apiClient.post<any[]>('/expenses/bulk-reject', {
        expenseIds,
        rejectionReason
      });
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to bulk reject expenses');
    } catch (error: any) {
      console.error('Bulk reject expenses error:', error);
      throw error;
    }
  }
}

// Leave request service
export class LeaveRequestService {
  // Get all leave requests
  static async getAllLeaveRequests() {
    try {
      const response = await apiClient.get<any[]>('/leave-requests');
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get leave requests');
    } catch (error: any) {
      console.error('Get all leave requests error:', error);
      throw error;
    }
  }

  // Get leave requests by user ID
  static async getLeaveRequestsByUserId(userId: string) {
    try {
      const response = await apiClient.get<any[]>(`/leave-requests/user/${userId}`);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get user leave requests');
    } catch (error: any) {
      console.error('Get user leave requests error:', error);
      throw error;
    }
  }

  // Create leave request
  static async createLeaveRequest(leaveData: any) {
    try {
      const response = await apiClient.post<any>('/leave-requests', leaveData);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError(response.message || 'Failed to create leave request');
    } catch (error: any) {
      console.error('Create leave request error:', error);
      throw error;
    }
  }

  // Approve leave request
  static async approveLeaveRequest(requestId: string) {
    try {
      const response = await apiClient.patch<any>(`/leave-requests/${requestId}/approve`, {});
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to approve leave request');
    } catch (error: any) {
      console.error('Approve leave request error:', error);
      throw error;
    }
  }

  // Reject leave request
  static async rejectLeaveRequest(requestId: string, rejectionReason: string) {
    try {
      const response = await apiClient.patch<any>(`/leave-requests/${requestId}/reject`, {
        rejectionReason
      });
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to reject leave request');
    } catch (error: any) {
      console.error('Reject leave request error:', error);
      throw error;
    }
  }

  // Bulk approve leave requests
  static async bulkApproveLeaveRequests(requestIds: string[]) {
    try {
      const response = await apiClient.post<any[]>('/leave-requests/bulk-approve', {
        requestIds
      });
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to bulk approve leave requests');
    } catch (error: any) {
      console.error('Bulk approve leave requests error:', error);
      throw error;
    }
  }

  // Bulk reject leave requests
  static async bulkRejectLeaveRequests(requestIds: string[], rejectionReason: string) {
    try {
      const response = await apiClient.post<any[]>('/leave-requests/bulk-reject', {
        requestIds,
        rejectionReason
      });
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to bulk reject leave requests');
    } catch (error: any) {
      console.error('Bulk reject leave requests error:', error);
      throw error;
    }
  }
}

// Document service
export class DocumentService {
  // Get documents by user ID
  static async getDocumentsByUserId(userId: string) {
    try {
      const response = await apiClient.get<any[]>(`/documents/${userId}`);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get documents');
    } catch (error: any) {
      console.error('Get documents error:', error);
      throw error;
    }
  }

  // Upload document
  static async uploadDocument(documentData: any) {
    try {
      const formData = new FormData();
      formData.append('userId', documentData.userId);
      formData.append('name', documentData.name);
      formData.append('type', documentData.type);
      formData.append('document', documentData.file);

      const token = apiClient.getToken();
      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return data.data || data;
      }

      throw new ApiError(data.message || 'Failed to upload document');
    } catch (error: any) {
      console.error('Upload document error:', error);
      throw error;
    }
  }
}

// Holiday service
export class HolidayService {
  // Get all holidays
  static async getAllHolidays() {
    try {
      const response = await apiClient.get<any[]>('/holidays');
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get holidays');
    } catch (error: any) {
      console.error('Get all holidays error:', error);
      throw error;
    }
  }

  // Get holidays by organization
  static async getHolidaysByOrganization(organizationId: string) {
    try {
      const response = await apiClient.get<any[]>(`/holidays/organization/${organizationId}`);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError('Failed to get organization holidays');
    } catch (error: any) {
      console.error('Get organization holidays error:', error);
      throw error;
    }
  }

  // Create holiday
  static async createHoliday(holidayData: any) {
    try {
      const response = await apiClient.post<any>('/holidays', holidayData);
      
      if (response.success && response.data) {
        return response.data;
      }

      throw new ApiError(response.message || 'Failed to create holiday');
    } catch (error: any) {
      console.error('Create holiday error:', error);
      throw error;
    }
  }
}

// Employee service
export class EmployeeService {
  // Get all employees
  static async getAllEmployees() {
    try {
      const response = await apiClient.get<any[]>('/employees');
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get employees');
    } catch (error: any) {
      console.error('Get all employees error:', error);
      throw error;
    }
  }

  // Get employee by ID
  static async getEmployeeById(employeeId: string) {
    try {
      const response = await apiClient.get<any>(`/employees/${employeeId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Employee not found');
    } catch (error: any) {
      console.error('Get employee error:', error);
      throw error;
    }
  }

  // Get employee by user ID
  static async getEmployeeByUserId(userId: string) {
    try {
      const response = await apiClient.get<any>(`/employees/user/${userId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Employee not found');
    } catch (error: any) {
      console.error('Get employee by user ID error:', error);
      throw error;
    }
  }

  // Create new employee
  static async createEmployee(employeeData: any) {
    try {
      const response = await apiClient.post<any>('/employees', employeeData);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError(response.message || 'Failed to create employee');
    } catch (error: any) {
      console.error('Create employee error:', error);
      throw error;
    }
  }

  // Update employee
  static async updateEmployee(employeeId: string, employeeData: any) {
    try {
      const response = await apiClient.put<any>(`/employees/${employeeId}`, employeeData);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to update employee');
    } catch (error: any) {
      console.error('Update employee error:', error);
      throw error;
    }
  }

  // Delete employee
  static async deleteEmployee(employeeId: string) {
    try {
      const response = await apiClient.delete(`/employees/${employeeId}`);
      if (response.success) {
        return { success: true };
      }
      throw new ApiError('Failed to delete employee');
    } catch (error: any) {
      console.error('Delete employee error:', error);
      throw error;
    }
  }
}

// Payroll/Payslip service
export class PayrollService {
  // Get all payslips
  static async getAllPayslips() {
    try {
      const response = await apiClient.get<any[]>('/payslips');
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get payslips');
    } catch (error: any) {
      console.error('Get all payslips error:', error);
      throw error;
    }
  }

  // Get payslips for employee
  static async getEmployeePayslips(employeeId: string) {
    try {
      const response = await apiClient.get<any[]>(`/payslips/employee/${employeeId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get employee payslips');
    } catch (error: any) {
      console.error('Get employee payslips error:', error);
      throw error;
    }
  }

  // Get my payslips (for current user)
  static async getMyPayslips() {
    try {
      const response = await apiClient.get<any[]>('/payslips/my-payslips');
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get payslips');
    } catch (error: any) {
      console.error('Get my payslips error:', error);
      throw error;
    }
  }

  // Create payslip
  static async createPayslip(payslipData: any) {
    try {
      const response = await apiClient.post<any>('/payslips', payslipData);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError(response.message || 'Failed to create payslip');
    } catch (error: any) {
      console.error('Create payslip error:', error);
      throw error;
    }
  }

  // Mark payslip as paid
  static async markPayslipAsPaid(payslipId: string) {
    try {
      const response = await apiClient.patch<any>(`/payslips/${payslipId}/pay`, {});
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to update payslip');
    } catch (error: any) {
      console.error('Mark payslip as paid error:', error);
      throw error;
    }
  }

  // Delete payslip
  static async deletePayslip(payslipId: string) {
    try {
      const response = await apiClient.delete(`/payslips/${payslipId}`);
      if (response.success) {
        return { success: true };
      }
      throw new ApiError('Failed to delete payslip');
    } catch (error: any) {
      console.error('Delete payslip error:', error);
      throw error;
    }
  }
}

// Advance/Loan service
export class AdvanceLoanService {
  // Get all advances/loans
  static async getAllAdvancesLoans() {
    try {
      const response = await apiClient.get<any[]>('/advances-loans');
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get advances/loans');
    } catch (error: any) {
      console.error('Get all advances/loans error:', error);
      throw error;
    }
  }

  // Get advances/loans for employee
  static async getEmployeeAdvancesLoans(employeeId: string) {
    try {
      const response = await apiClient.get<any[]>(`/advances-loans/employee/${employeeId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get employee advances/loans');
    } catch (error: any) {
      console.error('Get employee advances/loans error:', error);
      throw error;
    }
  }

  // Get my advances/loans
  static async getMyAdvancesLoans() {
    try {
      const response = await apiClient.get<any[]>('/advances-loans/my-requests');
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get my advances/loans');
    } catch (error: any) {
      console.error('Get my advances/loans error:', error);
      throw error;
    }
  }

  // Create advance/loan request
  static async createAdvanceLoan(data: any) {
    try {
      const response = await apiClient.post<any>('/advances-loans', data);
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError(response.message || 'Failed to create request');
    } catch (error: any) {
      console.error('Create advance/loan error:', error);
      throw error;
    }
  }

  // Approve advance/loan
  static async approveAdvanceLoan(id: string) {
    try {
      const response = await apiClient.patch<any>(`/advances-loans/${id}/approve`, {});
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to approve request');
    } catch (error: any) {
      console.error('Approve advance/loan error:', error);
      throw error;
    }
  }

  // Reject advance/loan
  static async rejectAdvanceLoan(id: string, rejectionReason: string) {
    try {
      const response = await apiClient.patch<any>(`/advances-loans/${id}/reject`, { rejectionReason });
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to reject request');
    } catch (error: any) {
      console.error('Reject advance/loan error:', error);
      throw error;
    }
  }

  // Pay installment
  static async payInstallment(id: string) {
    try {
      const response = await apiClient.patch<any>(`/advances-loans/${id}/pay-installment`, {});
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to record installment');
    } catch (error: any) {
      console.error('Pay installment error:', error);
      throw error;
    }
  }

  // Delete advance/loan
  static async deleteAdvanceLoan(id: string) {
    try {
      const response = await apiClient.delete(`/advances-loans/${id}`);
      if (response.success) {
        return { success: true };
      }
      throw new ApiError('Failed to delete request');
    } catch (error: any) {
      console.error('Delete advance/loan error:', error);
      throw error;
    }
  }
}
