import axios from 'axios';

class BiometricService {
  constructor() {
    this.deviceIP = process.env.BIOMETRIC_DEVICE_IP || '192.168.1.100';
    this.devicePort = process.env.BIOMETRIC_DEVICE_PORT || 8080;
    this.timeout = 5000;
  }

  // Connect to biometric device
  async connectToDevice() {
    try {
      console.log(`Connecting to biometric device at ${this.deviceIP}:${this.devicePort}`);
      
      // Simulate device connection (in production, this would be actual device API)
      const response = await axios.get(`http://${this.deviceIP}:${this.devicePort}/api/status`, {
        timeout: this.timeout
      });
      
      if (response.status === 200) {
        console.log('Biometric device connected successfully');
        return { success: true, device: response.data };
      }
      
      throw new Error('Device not responding');
    } catch (error) {
      console.error('Failed to connect to biometric device:', error);
      return { success: false, error: error.message };
    }
  }

  // Fetch attendance logs from device
  async fetchAttendanceLogs(tenantId, startDate, endDate) {
    try {
      console.log(`Fetching attendance logs for tenant ${tenantId}`);
      
      // Simulate fetching logs from device
      const response = await axios.get(`http://${this.deviceIP}:${this.devicePort}/api/logs`, {
        params: {
          tenantId,
          startDate,
          endDate
        },
        timeout: this.timeout
      });
      
      if (response.status === 200) {
        const logs = response.data.map(log => ({
          ...log,
          tenantId,
          timestamp: new Date(log.timestamp),
          processed: false
        }));
        
        console.log(`Fetched ${logs.length} attendance logs from device`);
        return { success: true, logs };
      }
      
      throw new Error('Failed to fetch logs from device');
    } catch (error) {
      console.error('Failed to fetch attendance logs:', error);
      return { success: false, error: error.message };
    }
  }

  // Process attendance logs and sync with database
  async processAttendanceLogs(tenantId) {
    try {
      const { logs } = await this.fetchAttendanceLogs(tenantId);
      
      for (const log of logs) {
        if (log.processed) continue;
        
        // Find employee by device user ID
        const employee = await this.findEmployeeByDeviceId(log.deviceUserId, tenantId);
        
        if (employee) {
          // Create attendance record
          const attendanceRecord = {
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tenantId,
            employeeId: employee.id,
            employeeName: employee.name,
            checkIn: log.type === 'check-in',
            checkOut: log.type === 'check-out',
            timestamp: log.timestamp,
            deviceType: log.deviceType || 'fingerprint',
            location: log.location || 'Main Office',
            status: 'present'
          };
          
          // Save to database (this would use your attendance model)
          console.log(`Processed attendance for employee ${employee.name}:`, attendanceRecord);
          
          // Mark log as processed
          log.processed = true;
        }
      }
      
      return { success: true, processed: logs.filter(log => log.processed).length };
    } catch (error) {
      console.error('Failed to process attendance logs:', error);
      return { success: false, error: error.message };
    }
  }

  // Find employee by device user ID
  async findEmployeeByDeviceId(deviceUserId, tenantId) {
    try {
      // This would query your User model with deviceUserId field
      // For simulation, we'll return a mock employee
      const mockEmployees = [
        { id: 'emp_001', name: 'John Doe', deviceUserId: 'DEV001', tenantId },
        { id: 'emp_002', name: 'Jane Smith', deviceUserId: 'DEV002', tenantId },
        { id: 'emp_003', name: 'Mike Johnson', deviceUserId: 'DEV003', tenantId }
      ];
      
      const employee = mockEmployees.find(emp => emp.deviceUserId === deviceUserId);
      return employee || null;
    } catch (error) {
      console.error('Failed to find employee:', error);
      return null;
    }
  }

  // Real-time attendance sync
  async syncAttendanceRealtime(tenantId, attendanceData) {
    try {
      // This would emit Socket.IO event
      console.log(`Syncing attendance data for tenant ${tenantId}:`, attendanceData);
      
      // Emit to tenant-specific room
      if (global.io) {
        global.io.to(`tenant_${tenantId}`).emit('attendance:create', attendanceData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to sync attendance:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new BiometricService();
