#!/bin/bash

# Enhanced Hybrid Search Test Script
# Make sure your server is running on localhost:3000

API_BASE="http://localhost:3000"

echo "🚀 Testing Enhanced Hybrid Semantic Search with CURL"
echo "=================================================="

# Test 1: Complex query with multiple criteria
echo ""
echo "📋 Test 1: Complex Query - UI graduates with high GPA and Traveloka experience"
echo "Query: 'Can you find candidates from UI with GPA above 3.2 and have worked at Traveloka?'"
curl -X POST "$API_BASE/api/cv/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you find candidates from UI with GPA above 3.2 and have worked at Traveloka?"
  }' | jq '.data.response'

echo ""
echo "=================================================="

# Test 2: Academic filtering
echo ""
echo "📋 Test 2: Academic Filter - High GPA graduates"
echo "Query: 'Find candidates with GPA above 3.5'"
curl -X POST "$API_BASE/api/cv/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find candidates with GPA above 3.5"
  }' | jq '.data.response'

echo ""
echo "=================================================="

# Test 3: Company experience filter
echo ""
echo "📋 Test 3: Company Experience Filter"
echo "Query: 'Show me candidates who worked at Traveloka'"
curl -X POST "$API_BASE/api/cv/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me candidates who worked at Traveloka"
  }' | jq '.data.response'

echo ""
echo "=================================================="

# Test 4: Semantic skills search
echo ""
echo "📋 Test 4: Semantic Skills Search"
echo "Query: 'Find Python developers with machine learning experience'"
curl -X POST "$API_BASE/api/cv/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find Python developers with machine learning experience"
  }' | jq '.data.response'

echo ""
echo "=================================================="

# Test 5: Hybrid university + skills
echo ""
echo "📋 Test 5: Hybrid Query - University + Skills"
echo "Query: 'Find computer science graduates from UI with React experience'"
curl -X POST "$API_BASE/api/cv/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find computer science graduates from UI with React experience"
  }' | jq '.data.response'

echo ""
echo "=================================================="

# Test 6: Request top 3 results specifically
echo ""
echo "📋 Test 6: Specific Request for Top 3 Candidates"
echo "Query: 'Can you give me the top 3 candidates from UI with GPA above 3.2 who worked at Traveloka?'"
curl -X POST "$API_BASE/api/cv/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you give me the top 3 candidates from UI with GPA above 3.2 who worked at Traveloka?"
  }' | jq '.'

echo ""
echo "🎉 Test completed! Check the responses above."
echo ""
echo "💡 Tips:"
echo "- Make sure your server is running: npm start"
echo "- Check that you have CV data in your database"
echo "- Install jq for better JSON formatting: brew install jq (macOS) or apt-get install jq (Ubuntu)" 