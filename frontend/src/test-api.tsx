import { useState, useEffect } from 'react';
import { apiClient } from './utils/api';

export default function TestAPI() {
  const [attendanceData, setAttendanceData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const testAPIs = async () => {
      try {
        console.log('Testing APIs...');
        
        // Test attendance records
        const attendanceResponse = await apiClient.get('/dashboard/todays-attendance');
        console.log('Attendance response:', attendanceResponse.data);
        setAttendanceData(attendanceResponse.data);
        
        // Test activity logs
        const activityResponse = await apiClient.get('/attendance/activity-logs/today');
        console.log('Activity response:', activityResponse.data);
        setActivityData(activityResponse.data);
        
      } catch (err) {
        console.error('API test error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    testAPIs();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>API Test Results</h1>
      
      <h2>Attendance Records:</h2>
      <pre>{JSON.stringify(attendanceData, null, 2)}</pre>
      
      <h2>Activity Logs:</h2>
      <pre>{JSON.stringify(activityData, null, 2)}</pre>
    </div>
  );
}