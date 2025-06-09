#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testAPI() {
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  console.log(`${colors.blue}🔍 Testing API Connection...${colors.reset}`);
  console.log(`${colors.cyan}📡 Base URL: ${baseURL}${colors.reset}\n`);

  const tests = [
    {
      name: 'Health Check',
      endpoint: `${baseURL}/api/cv`,
      method: 'GET'
    },
    {
      name: 'CV IDs Endpoint', 
      endpoint: `${baseURL}/api/cv/ids`,
      method: 'GET'
    }
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      console.log(`${colors.yellow}⏳ Testing ${test.name}...${colors.reset}`);
      
      const response = await axios.get(test.endpoint, { timeout: 5000 });
      
      console.log(`${colors.green}✅ ${test.name}: OK (${response.status})${colors.reset}`);
      
      if (test.name === 'CV IDs Endpoint' && response.data?.data) {
        console.log(`   📊 Current CVs in database: ${response.data.data.length || 0}`);
      }
      
    } catch (error) {
      console.log(`${colors.red}❌ ${test.name}: FAILED${colors.reset}`);
      console.log(`   Error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log(`   💡 Hint: Make sure the backend server is running on ${baseURL}`);
      }
      
      allPassed = false;
    }
  }

  console.log('\n' + '═'.repeat(50));
  
  if (allPassed) {
    console.log(`${colors.green}🎉 All tests passed! API is ready for CV uploads.${colors.reset}`);
    console.log(`${colors.cyan}💡 You can now run: node upload-all-cvs-api.js${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Some tests failed. Please check your backend server.${colors.reset}`);
    console.log(`${colors.yellow}💡 Start the backend with: npm start${colors.reset}`);
  }
}

// Run the test
testAPI().catch(console.error); 