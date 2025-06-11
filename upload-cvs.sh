#!/bin/bash

# CV API Upload Script
# This script uploads all CVs from cv_sample folder via HTTP API to the backend

echo "🌐 Starting CV API Upload..."
echo "📁 Processing CVs from cv_sample folder"
echo "🔗 Uploading via HTTP API to backend"
echo ""

# Navigate to the scripts directory and run the API upload script
cd "$(dirname "$0")/src/scripts"
node upload-all-cvs-api.js

echo ""
echo "✅ API upload process completed!"
echo "💡 You can now use the search functionality or API to query uploaded CVs" 