import { KPICard } from '../../components/KPICard';
import ChatWidget from '../../components/ChatWidget';
import {
  Users,
  TrendingUp,
  Receipt,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  IndianRupee,
  LogIn,
  Coffee,
  TrendingDown,
  Gift,
  Zap,
  Trash2,
  Edit,
  Download
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '../../utils/api';
import { TokenManager } from '../../utils/api';
import realTimeSocket from '../../utils/realTimeSocket';

export default function AdminDashboard() {
  const { formatCurrency, convertAmount, selectedCurrency } = useCurrency();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dashboardStats, setDashboardStats] = useState({
    totalEmployees: 0,
    avgProductivity: 0,
    thisMonthExpenses: 0,
    thisMonthPayroll: 0,
    totalCost: 0,
    loggedInEmployees: 0,
    onLeave: 0
  });
  const [quickStats, setQuickStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    attendanceRate: 0,
    pendingLeaves: 0,
    pendingExpenses: 0,
    activeUsers: 0,
    onBreak: 0,
    totalSales: 0,
    totalLoss: 0,
    totalBonus: 0,
    totalIncentive: 0
  });
  const [expenseData, setExpenseData] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [todaysAttendance, setTodaysAttendance] = useState([]);
  const [employeesOnBreak, setEmployeesOnBreak] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Force re-render timestamp
  
  // Edit leave modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);

  // Log quickStats changes
  useEffect(() => {
    console.log('📊 [STATE] quickStats updated:', quickStats);
    console.log('📊 [STATE] onBreak value:', quickStats.onBreak);
    console.log('📊 [STATE] activeUsers value:', quickStats.activeUsers);
    
    // Log Socket.IO connection status
    const isConnected = realTimeSocket.isConnected();
    console.log('🔌 [SOCKET-STATUS] Connected:', isConnected);
    if (!isConnected) {
      console.warn('⚠️ [SOCKET-STATUS] Socket.IO is not connected! Real-time updates will not work.');
    }
  }, [quickStats]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Build query params for filtering
        const params = new URLSearchParams();
        params.append('filterType', filterType);
        if (filterType === 'custom' && customStartDate && customEndDate) {
          params.append('startDate', customStartDate);
          params.append('endDate', customEndDate);
        }

        console.log('📊 Fetching dashboard data with params:', Object.fromEntries(params));

        // Fetch dashboard statistics
        const statsResponse = await apiClient.get(`/dashboard/stats?${params.toString()}`);
        console.log('📊 Stats response:', statsResponse.data);
        if (statsResponse.data?.success) {
          setDashboardStats(statsResponse.data.data || {});
        }

        // Fetch quick stats with cache busting
        const timestamp = Date.now();
        console.log('📊 [FETCH] About to fetch quick-stats...');
        const quickStatsResponse = await apiClient.get(`/dashboard/quick-stats?${params.toString()}&_t=${timestamp}`);
        console.log('📊 [FETCH] Raw response received:', quickStatsResponse);
        console.log('📊 [FETCH] Response.data:', quickStatsResponse.data);
        console.log('📊 [FETCH] Response.success:', quickStatsResponse.success);
        
        if (quickStatsResponse.success && quickStatsResponse.data) {
          console.log('📊 [INIT] Setting quickStats with data:', quickStatsResponse.data);
          console.log('📊 [INIT] onBreak value from API:', quickStatsResponse.data.onBreak);
          console.log('📊 [INIT] activeUsers value from API:', quickStatsResponse.data.activeUsers);
          
          // Force update with new data - use quickStatsResponse.data directly
          setQuickStats(quickStatsResponse.data);
          setLastUpdate(Date.now()); // Force re-render
          console.log('📊 [INIT] quickStats state updated, lastUpdate:', Date.now());
        } else {
          console.error('📊 [ERROR] API response success is false or no data:', quickStatsResponse);
        }

        // Fetch expense trends
        const expenseTrendsResponse = await apiClient.get('/dashboard/expense-trends');
        console.log('📊 Expense trends response:', expenseTrendsResponse.data);
        if (expenseTrendsResponse.data?.success) {
          setExpenseData(expenseTrendsResponse.data.data || []);
        }

        // Fetch weekly productivity data
        const productivityResponse = await apiClient.get('/dashboard/weekly-productivity');
        console.log('📊 Productivity response:', productivityResponse.data);
        if (productivityResponse.data?.success) {
          setProductivityData(productivityResponse.data.data || []);
        }

        // Fetch recent leave requests
        const leaveResponse = await apiClient.get('/dashboard/recent-leave-requests');
        console.log('📊 Leave response:', leaveResponse);
        console.log('📊 Leave response.data:', leaveResponse.data);
        console.log('📊 Leave response.success:', leaveResponse.success);
        if (leaveResponse.success && leaveResponse.data) {
          console.log('📊 Setting leaveRequests with:', leaveResponse.data);
          setLeaveRequests(leaveResponse.data || []);
        }

        // Fetch today's attendance
        const attendanceResponse = await apiClient.get('/dashboard/todays-attendance');
        console.log('📊 Attendance response:', attendanceResponse);
        console.log('📊 Attendance response.data:', attendanceResponse.data);
        console.log('📊 Attendance response.success:', attendanceResponse.success);
        if (attendanceResponse.success && attendanceResponse.data) {
          console.log('📊 Setting todaysAttendance with:', attendanceResponse.data);
          setTodaysAttendance(attendanceResponse.data || []);
        }

        // Fetch employees on break
        const onBreakResponse = await apiClient.get('/attendance/on-break');
        console.log('📊 On-break response:', onBreakResponse.data);
        if (onBreakResponse.data?.success) {
          setEmployeesOnBreak(onBreakResponse.data.data || []);
          // Don't update quickStats here - it's already set from quick-stats endpoint
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // DISABLED: Auto-refresh polling - causing state reset issues
    // Set up polling to refresh data every 5 seconds
    // const pollInterval = setInterval(() => {
    //   console.log('📊 [POLLING] Refreshing dashboard data...');
    //   fetchDashboardData();
    // }, 5000); // Refresh every 5 seconds

    // Cleanup interval on unmount
    return () => {
      // clearInterval(pollInterval);
    };
  }, [filterType, customStartDate, customEndDate]);

  // Socket.IO real-time updates - no polling needed
  // All updates come through Socket.IO events

  // Listen to real-time employee creation events and dashboard updates
  useEffect(() => {
    const handleEmployeeCreated = (data: any) => {
      console.log('👤 Employee created event received:', data);
      // Update employee count
      setDashboardStats(prev => ({
        ...prev,
        totalEmployees: (prev.totalEmployees || 0) + 1
      }));
    };

    const handleDashboardUpdate = (data: any) => {
      console.log('📊 Dashboard update event received:', data);
      if (data.type === 'active_users_updated') {
        // Update logged-in employees count in real-time
        setQuickStats(prev => ({
          ...prev,
          activeUsers: data.data?.activeUsers || prev.activeUsers
        }));
      } else if (data.type === 'employee_count') {
        setDashboardStats(prev => ({
          ...prev,
          totalEmployees: data.data?.totalEmployees || prev.totalEmployees
        }));
      } else if (data.type === 'dashboard_refresh') {
        // Refresh all dashboard data when break starts/ends
        console.log('📊 Dashboard refresh triggered:', data.reason);
        const fetchUpdatedData = async () => {
          try {
            const params = new URLSearchParams();
            params.append('filterType', filterType);
            if (filterType === 'custom' && customStartDate && customEndDate) {
              params.append('startDate', customStartDate);
              params.append('endDate', customEndDate);
            }
            
            // Fetch all data in parallel
            const [statsResponse, quickStatsResponse, attendanceResponse, onBreakResponse, leaveResponse] = await Promise.all([
              apiClient.get(`/dashboard/stats?${params.toString()}`),
              apiClient.get(`/dashboard/quick-stats?${params.toString()}`),
              apiClient.get('/dashboard/todays-attendance'),
              apiClient.get('/attendance/on-break'),
              apiClient.get('/dashboard/recent-leave-requests')
            ]);
            
            // Update all states
            if (statsResponse.data?.success) {
              setDashboardStats(statsResponse.data.data || {});
            }
            if (quickStatsResponse.success && quickStatsResponse.data) {
              setQuickStats(quickStatsResponse.data);
              setLastUpdate(Date.now());
            }
            if (attendanceResponse.success && attendanceResponse.data) {
              setTodaysAttendance(attendanceResponse.data);
            }
            if (onBreakResponse.data?.success) {
              setEmployeesOnBreak(onBreakResponse.data.data || []);
            }
            if (leaveResponse.data?.success) {
              setLeaveRequests(leaveResponse.data.data || []);
            }
          } catch (error) {
            console.error('Error refreshing dashboard data:', error);
          }
        };
        fetchUpdatedData();
      } else if (data.type === 'kpi_update') {
        // Handle real-time KPI updates from backend
        console.log('📊 [ADMIN] KPI update received:', data);
        console.log('📊 [ADMIN] KPI data structure:', data.data);
        console.log('📊 [ADMIN] KPI onBreak value:', data.data?.kpis?.onBreak);
        if (data.data?.kpis) {
          const kpis = data.data.kpis;
          console.log('📊 [ADMIN] Updating state with KPIs:', kpis);
          
          // Update dashboard stats
          setDashboardStats(prev => ({
            ...prev,
            totalEmployees: kpis.totalEmployees ?? prev.totalEmployees,
            avgProductivity: kpis.avgProductivity ?? prev.avgProductivity,
            thisMonthExpenses: kpis.thisMonthExpenses ?? prev.thisMonthExpenses,
            thisMonthPayroll: kpis.thisMonthPayroll ?? prev.thisMonthPayroll,
            totalCost: kpis.totalCost ?? prev.totalCost,
            loggedInEmployees: kpis.activeUsers ?? prev.loggedInEmployees,
            onLeave: kpis.onLeave ?? prev.onLeave
          }));
          
          // Update quick stats - FIXED: Don't merge with prev, use direct values
          const newQuickStats = {
            totalEmployees: kpis.totalEmployees ?? 0,
            presentToday: kpis.presentToday ?? 0,
            attendanceRate: kpis.attendanceRate ?? 0,
            pendingLeaves: kpis.pendingLeaves ?? 0,
            pendingExpenses: kpis.pendingExpenses ?? 0,
            activeUsers: kpis.activeUsers ?? 0,
            onLeave: kpis.onLeave ?? 0,
            onBreak: kpis.onBreak ?? 0,
            totalSales: kpis.totalSales ?? 0,
            totalLoss: kpis.totalLoss ?? 0,
            totalBonus: kpis.totalBonus ?? 0,
            totalIncentive: kpis.totalIncentive ?? 0
          };
          console.log('📊 [ADMIN] New quickStats state:', newQuickStats);
          setQuickStats(newQuickStats);
          setLastUpdate(Date.now()); // Force re-render
          console.log('📊 [ADMIN] State updated with new KPI values');
        } else {
          console.warn('📊 [ADMIN] KPI update received but no kpis data found');
        }
        
        // Also refresh the data from backend to ensure consistency
        console.log('📊 [ADMIN] Fetching fresh data from backend after KPI update');
        const fetchFreshData = async () => {
          try {
            const params = new URLSearchParams();
            params.append('filterType', filterType);
            if (filterType === 'custom' && customStartDate && customEndDate) {
              params.append('startDate', customStartDate);
              params.append('endDate', customEndDate);
            }
            
            const quickStatsResponse = await apiClient.get(`/dashboard/quick-stats?${params.toString()}`);
            if (quickStatsResponse.success && quickStatsResponse.data) {
              console.log('📊 [ADMIN] Fresh quick-stats data:', quickStatsResponse.data);
              console.log('📊 [ADMIN] Fresh onBreak value:', quickStatsResponse.data.onBreak);
              console.log('📊 [ADMIN] Fresh activeUsers value:', quickStatsResponse.data.activeUsers);
              
              // Force update with fresh data
              setQuickStats(quickStatsResponse.data);
              setLastUpdate(Date.now()); // Force re-render
              console.log('📊 [ADMIN] quickStats forcefully updated with fresh data');
            }
            
            const onBreakResponse = await apiClient.get('/attendance/on-break');
            if (onBreakResponse.data?.success) {
              setEmployeesOnBreak(onBreakResponse.data.data || []);
            }
          } catch (error) {
            console.error('Error fetching fresh data:', error);
          }
        };
        fetchFreshData();
      }
    };

    const handleExpenseUpdate = (type: string, expense: any) => {
      console.log('💰 Expense update received:', { type, expense });
      // Refresh dashboard data to update expense KPI
      if (type === 'created' || type === 'updated' || type === 'deleted') {
        // Fetch updated dashboard stats
        const fetchUpdatedStats = async () => {
          try {
            const params = new URLSearchParams();
            params.append('filterType', filterType);
            if (filterType === 'custom' && customStartDate && customEndDate) {
              params.append('startDate', customStartDate);
              params.append('endDate', customEndDate);
            }
            const statsResponse = await apiClient.get(`/dashboard/stats?${params.toString()}`);
            if (statsResponse.data?.success) {
              setDashboardStats(statsResponse.data.data || {});
            }
          } catch (error) {
            console.error('Error fetching updated stats:', error);
          }
        };
        fetchUpdatedStats();
      }
    };

    const handleLeaveUpdate = (type: string, leave: any) => {
      console.log('📅 [LEAVE-UPDATE] Leave update received:', { type, leave });
      console.log('📅 [LEAVE-UPDATE] Leave action:', type);
      console.log('📅 [LEAVE-UPDATE] Leave data:', leave);
      
      // Refresh dashboard data to update leave KPI
      if (type === 'created' || type === 'updated' || type === 'approved' || type === 'rejected') {
        console.log('📅 [LEAVE-UPDATE] Triggering refresh for action:', type);
        const fetchUpdatedStats = async () => {
          try {
            const params = new URLSearchParams();
            params.append('filterType', filterType);
            if (filterType === 'custom' && customStartDate && customEndDate) {
              params.append('startDate', customStartDate);
              params.append('endDate', customEndDate);
            }
            
            // Refresh quick stats (for pending leaves KPI)
            const quickStatsResponse = await apiClient.get(`/dashboard/quick-stats?${params.toString()}`);
            if (quickStatsResponse.success && quickStatsResponse.data) {
              console.log('📅 [LEAVE-UPDATE] Updated quick stats:', quickStatsResponse.data);
              setQuickStats(quickStatsResponse.data);
              setLastUpdate(Date.now());
            }
            
            // Also refresh leave requests table
            const leaveResponse = await apiClient.get('/dashboard/recent-leave-requests');
            console.log('📅 [LEAVE-UPDATE] Leave requests response:', leaveResponse);
            if (leaveResponse.success && leaveResponse.data) {
              console.log('📅 [LEAVE-UPDATE] Setting leave requests:', leaveResponse.data);
              console.log('📅 [LEAVE-UPDATE] Number of leave requests:', leaveResponse.data.length);
              setLeaveRequests(leaveResponse.data || []);
            }
          } catch (error) {
            console.error('📅 [LEAVE-UPDATE] Error fetching updated stats:', error);
          }
        };
        fetchUpdatedStats();
      }
    };

    const handleAttendanceUpdate = (attendance: any) => {
      console.log('⏰ Attendance update received:', attendance);
      
      // If it's a break event, immediately refresh KPI data
      if (attendance.type === 'break_started' || attendance.type === 'break_ended') {
        console.log('☕ [BREAK-EVENT] Break event detected, refreshing KPIs immediately');
        const fetchUpdatedStats = async () => {
          try {
            const params = new URLSearchParams();
            params.append('filterType', filterType);
            if (filterType === 'custom' && customStartDate && customEndDate) {
              params.append('startDate', customStartDate);
              params.append('endDate', customEndDate);
            }
            
            // Fetch quick stats with cache busting
            const timestamp = Date.now();
            const quickStatsResponse = await apiClient.get(`/dashboard/quick-stats?${params.toString()}&_t=${timestamp}`);
            if (quickStatsResponse.success && quickStatsResponse.data) {
              console.log('☕ [BREAK-EVENT] Updated quick-stats:', quickStatsResponse.data);
              console.log('☕ [BREAK-EVENT] onBreak value:', quickStatsResponse.data.onBreak);
              setQuickStats(quickStatsResponse.data);
              setLastUpdate(Date.now());
            }
            
            // Also update employees on break list
            const onBreakResponse = await apiClient.get('/attendance/on-break');
            if (onBreakResponse.data?.success) {
              setEmployeesOnBreak(onBreakResponse.data.data || []);
            }
          } catch (error) {
            console.error('Error fetching updated stats:', error);
          }
        };
        
        fetchUpdatedStats();
        return; // Don't do the full refresh below
      }
      
      // Refresh all dashboard data when attendance changes
      const fetchUpdatedStats = async () => {
        try {
          const params = new URLSearchParams();
          params.append('filterType', filterType);
          if (filterType === 'custom' && customStartDate && customEndDate) {
            params.append('startDate', customStartDate);
            params.append('endDate', customEndDate);
          }
          
          // Fetch all dashboard data in parallel
          const [statsResponse, quickStatsResponse, attendanceResponse, onBreakResponse] = await Promise.all([
            apiClient.get(`/dashboard/stats?${params.toString()}`),
            apiClient.get(`/dashboard/quick-stats?${params.toString()}`),
            apiClient.get('/dashboard/todays-attendance'),
            apiClient.get('/attendance/on-break')
          ]);
          
          // Update dashboard stats
          if (statsResponse.data?.success) {
            setDashboardStats(statsResponse.data.data || {});
          }
          
          // Update quick stats (KPI cards)
          if (quickStatsResponse.success && quickStatsResponse.data) {
            setQuickStats(quickStatsResponse.data);
            setLastUpdate(Date.now());
          }
          
          // Update today's attendance
          if (attendanceResponse.success && attendanceResponse.data) {
            setTodaysAttendance(attendanceResponse.data);
          }
          
          // Update employees on break
          if (onBreakResponse.data?.success) {
            setEmployeesOnBreak(onBreakResponse.data.data || []);
          }
        } catch (error) {
          console.error('Error fetching updated stats:', error);
        }
      };
      
      fetchUpdatedStats();
    };

    // Subscribe to real-time events using the correct methods
    const unsubscribeEmployee = realTimeSocket.onEmployeeUpdate((type, employee) => {
      if (type === 'created') {
        handleEmployeeCreated(employee);
      }
    });

    const unsubscribeDashboard = realTimeSocket.onDashboardUpdate(handleDashboardUpdate);
    const unsubscribeExpense = realTimeSocket.onExpenseUpdate(handleExpenseUpdate);
    const unsubscribeLeave = realTimeSocket.onLeaveUpdate(handleLeaveUpdate);
    const unsubscribeAttendance = realTimeSocket.onAttendanceUpdate(handleAttendanceUpdate);

    // ADDED: Direct listeners for break events to ensure they trigger updates
    const socket = realTimeSocket.getSocket();
    if (socket) {
      socket.on('break:started', (data) => {
        console.log('☕ [DIRECT] break:started event received:', data);
        handleAttendanceUpdate({ type: 'break_started', ...data });
      });
      
      socket.on('break:ended', (data) => {
        console.log('☕ [DIRECT] break:ended event received:', data);
        handleAttendanceUpdate({ type: 'break_ended', ...data });
      });
      
      socket.on('kpi:update', (data) => {
        console.log('📊 [DIRECT] kpi:update event received:', data);
        handleDashboardUpdate({ type: 'kpi_update', data });
      });
    }

    // Cleanup listeners on unmount
    return () => {
      unsubscribeEmployee();
      unsubscribeDashboard();
      unsubscribeExpense();
      unsubscribeLeave();
      unsubscribeAttendance();
      
      // Clean up direct listeners
      if (socket) {
        socket.off('break:started');
        socket.off('break:ended');
        socket.off('kpi:update');
      }
    };
  }, [filterType, customStartDate, customEndDate]);

  const handleApproveLeave = async (requestId) => {
    try {
      console.log('✅ Approving leave request:', requestId);
      
      // Get current user ID
      const currentUser = TokenManager.getUser();
      const userId = currentUser?.id || currentUser?.userId;
      
      if (!userId) {
        alert('Unable to get user information. Please log in again.');
        return;
      }
      
      const response = await apiClient.patch(`/leave-requests/${requestId}/approve`, {
        approvedBy: userId
      });
      console.log('✅ Approve response:', response);
      
      if (response.success) {
        console.log('✅ Leave request approved successfully');
        // Refresh leave requests
        const leaveResponse = await apiClient.get('/dashboard/recent-leave-requests');
        if (leaveResponse.success && leaveResponse.data) {
          setLeaveRequests(leaveResponse.data || []);
        }
        alert('Leave request approved successfully');
      }
    } catch (error) {
      console.error('❌ Error approving leave:', error);
      alert(`Failed to approve leave request: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle leave request rejection
  const handleRejectLeave = async (requestId) => {
    const reason = window.prompt('Enter rejection reason:', 'Rejected by admin');
    if (!reason) {
      return; // User cancelled
    }
    
    try {
      console.log('❌ Rejecting leave request:', requestId);
      
      // Get current user ID
      const currentUser = TokenManager.getUser();
      const userId = currentUser?.id || currentUser?.userId;
      
      if (!userId) {
        alert('Unable to get user information. Please log in again.');
        return;
      }
      
      const response = await apiClient.patch(`/leave-requests/${requestId}/reject`, {
        rejectedBy: userId,
        rejectionReason: reason
      });
      console.log('❌ Reject response:', response);
      
      if (response.success) {
        console.log('✅ Leave request rejected successfully');
        // Refresh leave requests
        const leaveResponse = await apiClient.get('/dashboard/recent-leave-requests');
        if (leaveResponse.success && leaveResponse.data) {
          setLeaveRequests(leaveResponse.data || []);
        }
        alert('Leave request rejected successfully');
      }
    } catch (error) {
      console.error('❌ Error rejecting leave:', error);
      alert(`Failed to reject leave request: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle leave request deletion
  const handleDeleteLeave = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this leave request? This action cannot be undone.')) {
      return;
    }
    
    try {
      console.log('🗑️ Deleting leave request:', requestId);
      const response = await apiClient.delete(`/leave-requests/${requestId}`);
      console.log('🗑️ Delete response:', response);
      
      if (response.success) {
        console.log('✅ Leave request deleted successfully');
        // Refresh leave requests
        const leaveResponse = await apiClient.get('/dashboard/recent-leave-requests');
        if (leaveResponse.success && leaveResponse.data) {
          setLeaveRequests(leaveResponse.data || []);
        }
        alert('Leave request deleted successfully');
      }
    } catch (error) {
      console.error('❌ Error deleting leave:', error);
      alert(`Failed to delete leave request: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle leave request edit (open modal with leave data)
  const handleEditLeave = (request) => {
    console.log('✏️ Opening edit modal for leave:', request);
    setEditingLeave({
      id: request._id,
      type: request.type,
      startDate: new Date(request.startDate).toISOString().split('T')[0],
      endDate: new Date(request.endDate).toISOString().split('T')[0],
      reason: request.reason || '',
      employeeName: request.employeeName
    });
    setEditModalOpen(true);
  };

  // Handle save edited leave
  const handleSaveEditLeave = async () => {
    if (!editingLeave) return;
    
    try {
      console.log('💾 Saving edited leave:', editingLeave);
      const response = await apiClient.patch(`/leave-requests/${editingLeave.id}`, {
        leaveType: editingLeave.type,
        startDate: editingLeave.startDate,
        endDate: editingLeave.endDate,
        reason: editingLeave.reason
      });
      console.log('💾 Save response:', response);
      
      if (response.success || response.data?.success) {
        console.log('✅ Leave request updated successfully');
        setEditModalOpen(false);
        setEditingLeave(null);
        
        // Refresh leave requests
        const leaveResponse = await apiClient.get('/dashboard/recent-leave-requests');
        if (leaveResponse.success && leaveResponse.data) {
          setLeaveRequests(leaveResponse.data || []);
        }
        alert('Leave request updated successfully');
      }
    } catch (error) {
      console.error('❌ Error updating leave:', error);
      alert(`Failed to update leave request: ${error.message || 'Unknown error'}`);
    }
  };

  // Handle leave request download (generate PDF)
  const handleDownloadLeave = async (request) => {
    try {
      console.log('📥 Downloading leave request:', request);
      
      const days = Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Create a simple text content for download
      const content = `
LEAVE REQUEST DETAILS
=====================

Employee: ${request.employeeName}
Email: ${request.employeeEmail || 'N/A'}
Department: ${request.department}

Leave Type: ${request.type}
Start Date: ${new Date(request.startDate).toLocaleDateString()}
End Date: ${new Date(request.endDate).toLocaleDateString()}
Duration: ${days} days

Reason: ${request.reason || 'N/A'}
Status: ${request.status}

Applied On: ${new Date(request.createdAt).toLocaleString()}
      `.trim();
      
      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leave-request-${request.employeeName.replace(/\s+/g, '-')}-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Leave request downloaded successfully');
    } catch (error) {
      console.error('❌ Error downloading leave:', error);
      alert(`Failed to download leave request: ${error.message || 'Unknown error'}`);
    }
  };

  // Mock productivity data - CONVERT TO REAL DATA
  const [productivityData, setProductivityData] = useState([
    { day: 'Mon', productivity: 85 },
    { day: 'Tue', productivity: 92 },
    { day: 'Wed', productivity: 88 },
    { day: 'Thu', productivity: 95 },
    { day: 'Fri', productivity: 78 },
    { day: 'Sat', productivity: 65 },
    { day: 'Sun', productivity: 45 },
  ]);

  // Currency amount display component with INR icon
  const CurrencyAmount: React.FC<{ amount: number; className?: string }> = ({ amount, className }) => {
    if (selectedCurrency.code === 'INR') {
      return (
        <div className={`flex items-center gap-1 ${className || ''}`}>
          <IndianRupee className="w-4 h-4 text-primary" />
          <span>{formatCurrency(amount).replace('₹', '')}</span>
        </div>
      );
    }
    
    return <span className={className}>{formatCurrency(amount)}</span>;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Organization overview and management</p>
      </div>

      {/* Announcement Banner */}
      <Card className="p-4 bg-gradient-to-r from-accent/20 to-accent/10 border-accent/30 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Reminder: Monthly all-hands meeting tomorrow at 10:00 AM</p>
            <p className="text-sm text-muted-foreground">Please ensure all team members are notified</p>
          </div>
        </div>
      </Card>

      {/* Filter Section */}
      <Card className="p-6 rounded-2xl">
        <h3 className="font-semibold text-lg mb-4">Filter by Period</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Period</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {filterType === 'custom' && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* KPI Cards - Financial Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="This Month Expense"
            value={formatCurrency(dashboardStats.thisMonthExpenses)}
            icon={selectedCurrency.code === 'INR' ? IndianRupee : Receipt}
            color="accent"
          />
          <KPICard
            title="This Month Payroll"
            value={formatCurrency(dashboardStats.thisMonthPayroll)}
            icon={selectedCurrency.code === 'INR' ? IndianRupee : DollarSign}
            color="primary"
          />
          <KPICard
            title="Total Cost (Payroll + Expenses)"
            value={formatCurrency(dashboardStats.totalCost)}
            icon={selectedCurrency.code === 'INR' ? IndianRupee : DollarSign}
            color="destructive"
          />
          <KPICard
            title="Total Employees"
            value={dashboardStats.totalEmployees.toString()}
            icon={Users}
            color="secondary"
          />
        </div>
      </div>

      {/* KPI Cards - Operational Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Operational Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            key={`activeUsers-${quickStats.activeUsers}-${lastUpdate}`}
            title="Logged In Employees"
            value={quickStats.activeUsers.toString()}
            icon={LogIn}
            color="primary"
          />
          {(() => {
            console.log('📊 [RENDER] About to render On Break card');
            console.log('📊 [RENDER] quickStats object:', quickStats);
            console.log('📊 [RENDER] quickStats.onBreak value:', quickStats.onBreak);
            console.log('📊 [RENDER] quickStats.onBreak type:', typeof quickStats.onBreak);
            console.log('📊 [RENDER] Converting to string:', quickStats.onBreak.toString());
            return null;
          })()}
          <KPICard
            key={`onBreak-${quickStats.onBreak}-${lastUpdate}`}
            title="On Break"
            value={quickStats.onBreak.toString()}
            icon={Coffee}
            color="accent"
          />
          <KPICard
            key={`onLeave-${quickStats.onLeave}-${lastUpdate}`}
            title="On Leave"
            value={quickStats.onLeave?.toString() || '0'}
            icon={Calendar}
            color="accent"
          />
          <KPICard
            key={`avgProductivity-${dashboardStats.avgProductivity}-${lastUpdate}`}
            title="Avg Productivity"
            value={`${dashboardStats.avgProductivity}%`}
            icon={TrendingUp}
            color="primary"
          />
        </div>
      </div>

      {/* KPI Cards - Sales & Bonus Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Sales & Incentives</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Total Sales"
            value={formatCurrency(quickStats.totalSales)}
            icon={TrendingUp}
            color="secondary"
          />
          <KPICard
            title="Total Loss"
            value={formatCurrency(quickStats.totalLoss)}
            icon={TrendingDown}
            color="destructive"
          />
          <KPICard
            title="Total Bonus"
            value={formatCurrency(quickStats.totalBonus)}
            icon={Gift}
            color="accent"
          />
          <KPICard
            title="Total Incentive"
            value={formatCurrency(quickStats.totalIncentive)}
            icon={Zap}
            color="primary"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Trend */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Weekly Productivity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Line type="monotone" dataKey="productivity" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Expense Trend */}
        <Card className="p-6 rounded-2xl">
          <h3 className="font-semibold text-lg mb-4">Monthly Expenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Bar dataKey="amount" fill="#F59E0B" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Leave Requests */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Leave Requests</h3>
            <p className="text-sm text-muted-foreground">Pending approval</p>
          </div>
          <Badge variant="secondary">{leaveRequests.filter(r => r.status === 'pending').length} Pending</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No pending leave requests
                </TableCell>
              </TableRow>
            ) : (
              leaveRequests.map((request: any) => {
                const requestId = request._id || request.id;
                const employeeName = request.userId?.name || request.employeeName || 'Unknown';
                const leaveType = request.type || request.leaveType || 'N/A';
                const days = Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <TableRow key={requestId}>
                    <TableCell className="font-medium">{employeeName}</TableCell>
                    <TableCell>{leaveType}</TableCell>
                    <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>{days}</TableCell>
                    <TableCell>
                      <Badge variant={request.status === 'pending' ? 'secondary' : 'default'}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        {request.status === 'pending' && (
                          <>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="bg-secondary hover:bg-secondary/90"
                              onClick={() => handleApproveLeave(requestId)}
                              title="Approve leave request"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleRejectLeave(requestId)}
                              title="Reject leave request"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditLeave(request)}
                          title="Edit leave request"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownloadLeave(request)}
                          title="Download leave request"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteLeave(requestId)}
                          title="Delete leave request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Employee Overview */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold text-lg">Today's Attendance</h3>
          <p className="text-sm text-muted-foreground">Employee check-in status</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {todaysAttendance.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No attendance records for today
              </div>
            ) : (
              todaysAttendance.map((attendance, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-accent/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{attendance.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {attendance.employeeId?.department || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {attendance.checkIn ? new Date(attendance.checkIn).toLocaleTimeString() : 'Not checked in'}
                      </p>
                      <Badge variant={attendance.status === 'present' ? 'default' : 'secondary'} className="mt-1">
                        {attendance.status}
                      </Badge>
                    </div>
                    {attendance.status === 'present' && attendance.hoursWorked > 0 && (
                      <div className="w-24">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Hours</span>
                          <span className="text-xs font-medium">{attendance.hoursWorked}h</span>
                        </div>
                        <Progress value={(attendance.hoursWorked / 8) * 100} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Employees On Break */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Employees On Break</h3>
            <p className="text-sm text-muted-foreground">Real-time break tracking</p>
          </div>
          <Badge variant="secondary" className="bg-accent/20 text-accent">{employeesOnBreak.length} On Break</Badge>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {employeesOnBreak.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Coffee className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No employees on break</p>
              </div>
            ) : (
              employeesOnBreak.map((employee, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center">
                      <Coffee className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{employee.employeeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {employee.department} • {employee.designation}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium">{employee.breakType}</p>
                      <p className="text-xs text-muted-foreground">
                        {employee.breakDuration} min on break
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-accent/20 text-accent border-accent/30">
                      {new Date(employee.breakStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Chat Widget */}
      <ChatWidget />
      
      {/* Edit Leave Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
          </DialogHeader>
          {editingLeave && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Input value={editingLeave.employeeName} disabled className="bg-muted" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-leave-type">Leave Type</Label>
                <Select 
                  value={editingLeave.type} 
                  onValueChange={(value) => setEditingLeave({...editingLeave, type: value})}
                >
                  <SelectTrigger id="edit-leave-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="earned">Earned Leave</SelectItem>
                    <SelectItem value="maternity">Maternity Leave</SelectItem>
                    <SelectItem value="paternity">Paternity Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start-date">Start Date</Label>
                  <Input 
                    id="edit-start-date"
                    type="date" 
                    value={editingLeave.startDate}
                    onChange={(e) => setEditingLeave({...editingLeave, startDate: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-end-date">End Date</Label>
                  <Input 
                    id="edit-end-date"
                    type="date" 
                    value={editingLeave.endDate}
                    onChange={(e) => setEditingLeave({...editingLeave, endDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-reason">Reason</Label>
                <Textarea 
                  id="edit-reason"
                  value={editingLeave.reason}
                  onChange={(e) => setEditingLeave({...editingLeave, reason: e.target.value})}
                  placeholder="Enter reason for leave"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditLeave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
