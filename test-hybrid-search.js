const axios = require('axios');

// Configure the base URL for your API
const API_BASE_URL = 'http://localhost:3000';

async function testHybridSearch() {
  console.log('🚀 Testing Enhanced Hybrid Semantic Search\n');
  
  const testQueries = [
    {
      description: 'Complex Query: UI graduates with high GPA and Traveloka experience',
      message: 'Can you find candidates from UI with GPA above 3.2 and have worked at Traveloka?'
    },
    {
      description: 'Academic Filter: High GPA graduates',
      message: 'Find candidates with GPA above 3.5'
    },
    {
      description: 'Company Experience Filter',
      message: 'Show me candidates who worked at Traveloka or Gojek'
    },
    {
      description: 'Semantic Skills Search',
      message: 'Find Python developers with machine learning experience'
    },
    {
      description: 'Hybrid Query: University + Skills',
      message: 'Find computer science graduates from UI or ITB with React and Node.js experience'
    },
    {
      description: 'Complex Multi-criteria Query',
      message: 'Find senior software engineers from top universities with GPA above 3.0 who worked at tech companies'
    }
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const { description, message } = testQueries[i];
    
    console.log(`📋 Test ${i + 1}: ${description}`);
    console.log(`❓ Query: "${message}"`);
    console.log('---');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/cv/chat`, {
        message: message
      });
      
      if (response.data.success) {
        console.log('✅ Response received successfully');
        console.log(`📝 AI Response:\n${response.data.data.response}\n`);
        
        // If there was a function call, show the results
        if (response.data.data.functionResult) {
          const results = response.data.data.functionResult;
          console.log(`📊 Function Results: Found ${results.length} matches`);
          
          if (results.length > 0) {
            console.log('🎯 Top matches:');
            results.slice(0, 3).forEach((result, index) => {
              console.log(`   ${index + 1}. ${result.personalInfo?.name || 'Unknown'} (Score: ${(result.score * 100).toFixed(1)}%)`);
              if (result.personalInfo?.email) {
                console.log(`      📧 ${result.personalInfo.email}`);
              }
              if (result.matchType) {
                console.log(`      🔍 Match Type: ${result.matchType}`);
              }
            });
          }
        }
      } else {
        console.log('❌ Request failed:', response.data.message);
      }
    } catch (error) {
      console.log('💥 Error:', error.response?.data?.message || error.message);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Run the test
testHybridSearch().catch(console.error); 