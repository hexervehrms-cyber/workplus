/**
 * Check Render deployment status
 */

async function checkDeployment() {
  console.log('Checking Render deployment status...\n');
  
  try {
    const response = await fetch('https://workplus-backend-sg3a.onrender.com/health');
    console.log('Health check status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    // Check server logs for CORS configuration
    console.log('\nNote: Render deployment may take 2-5 minutes to complete.');
    console.log('Please check Render dashboard for deployment status.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDeployment();
