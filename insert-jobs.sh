#!/bin/bash

# Job Definitions Database Insert Script
# This script inserts all job definitions into the database

echo "💼 Starting Job Definitions Database Insert..."
echo "📝 Inserting 8 job positions into database"
echo "🔗 Connecting to database and processing jobs"
echo ""

# Navigate to the scripts directory and run the insert script
cd "$(dirname "$0")/src/scripts"
node insert-job-definitions.js

echo ""
echo "✅ Job insertion process completed!"
echo "💡 You can now search and match CVs against these job positions" 