// Test script to create sample data for the backend
const API_BASE = 'http://localhost:5000/api';

// Sample leave requests data
const sampleLeaveRequests = [
  {
    employeeId: 'EMP-001',
    employeeName: 'John Doe',
    startDate: '2024-04-20',
    endDate: '2024-04-22',
    reason: 'Medical appointment',
    type: 'sick'
  },
  {
    employeeId: 'EMP-002',
    employeeName: 'Jane Smith',
    startDate: '2024-04-25',
    endDate: '2024-04-26',
    reason: 'Family function',
    type: 'annual'
  },
  {
    employeeId: 'EMP-003',
    employeeName: 'Mike Johnson',
    startDate: '2024-04-28',
    endDate: '2024-04-30',
    reason: 'Personal work',
    type: 'personal'
  }
];

// Sample expenses data
const sampleExpenses = [
  {
    employeeId: 'EMP-001',
    employeeName: 'John Doe',
    employeeRole: 'employee',
    category: 'travel',
    amount: 1200,
    currency: 'USD',
    description: 'Business trip to New York',
    date: '2024-04-15',
    department: 'Sales',
    project: 'Q1 Sales Campaign'
  },
  {
    employeeId: 'EMP-002',
    employeeName: 'Jane Smith',
    employeeRole: 'accountant',
    category: 'meals',
    amount: 85,
    currency: 'USD',
    description: 'Client lunch meeting',
    date: '2024-04-16',
    department: 'Finance',
    project: 'Budget Review'
  }
];

// Create sample leave requests
async function createSampleLeaveRequests() {
  console.log('Creating sample leave requests...');
  
  for (const requestData of sampleLeaveRequests) {
    try {
      const response = await fetch(`${API_BASE}/leave-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Created leave request:', result.data);
      } else {
        console.error('Failed to create leave request:', await response.text());
      }
    } catch (error) {
      console.error('Error creating leave request:', error.message);
    }
  }
}

// Create sample expenses
async function createSampleExpenses() {
  console.log('Creating sample expenses...');
  
  for (const expenseData of sampleExpenses) {
    try {
      const response = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Created expense:', result.data);
      } else {
        console.error('Failed to create expense:', await response.text());
      }
    } catch (error) {
      console.error('Error creating expense:', error.message);
    }
  }
}

// Test API endpoints
async function testAPIEndpoints() {
  console.log('Testing API endpoints...');
  
  try {
    // Test leave requests endpoint
    const leaveResponse = await fetch(`${API_BASE}/leave-requests`);
    if (leaveResponse.ok) {
      const leaveData = await leaveResponse.json();
      console.log('Leave requests:', leaveData);
    } else {
      console.error('Failed to fetch leave requests:', await leaveResponse.text());
    }
    
    // Test expenses endpoint
    const expenseResponse = await fetch(`${API_BASE}/expenses`);
    if (expenseResponse.ok) {
      const expenseData = await expenseResponse.json();
      console.log('Expenses:', expenseData);
    } else {
      console.error('Failed to fetch expenses:', await expenseResponse.text());
    }
    
  } catch (error) {
    console.error('Error testing API endpoints:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('Starting backend integration tests...');
  
  await createSampleLeaveRequests();
  await createSampleExpenses();
  await testAPIEndpoints();
  
  console.log('Backend integration tests completed!');
}

runTests().catch(console.error);
