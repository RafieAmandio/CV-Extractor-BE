#!/bin/bash

# CV Batch Upload Script
# Usage: ./upload-cvs-batch.sh [folder_path] [api_url]

# Configuration
API_URL="${2:-http://localhost:3000}"
CV_FOLDER="${1:-./cv-samples}"
DELAY_SECONDS=1
LOG_FILE="upload-results-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
SUCCESSFUL=0
FAILED=0

echo "🚀 CV Batch Upload Script"
echo "=========================="
echo "📁 Target folder: $CV_FOLDER"
echo "🌐 API URL: $API_URL"
echo "📝 Log file: $LOG_FILE"
echo ""

# Check if folder exists
if [ ! -d "$CV_FOLDER" ]; then
    echo -e "${RED}❌ Error: Folder not found: $CV_FOLDER${NC}"
    echo "Usage: $0 [folder_path] [api_url]"
    echo "Example: $0 ./my-cvs http://localhost:3000"
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ Error: curl is required but not installed${NC}"
    exit 1
fi

# Function to test API connection
test_api_connection() {
    echo "🔍 Testing API connection..."
    
    if curl -s --connect-timeout 5 "$API_URL/api/cv?limit=1" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API connection successful${NC}"
        return 0
    else
        echo -e "${RED}❌ API connection failed${NC}"
        echo "   Make sure your server is running at: $API_URL"
        return 1
    fi
}

# Function to format file size
format_file_size() {
    local size=$1
    if [ $size -lt 1024 ]; then
        echo "${size} B"
    elif [ $size -lt 1048576 ]; then
        echo "$((size / 1024)) KB"
    else
        echo "$((size / 1048576)) MB"
    fi
}

# Function to upload a single file
upload_file() {
    local file_path="$1"
    local filename=$(basename "$file_path")
    local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null || echo "0")
    local formatted_size=$(format_file_size $file_size)
    
    echo -e "${BLUE}📤 Uploading: $filename ($formatted_size)${NC}"
    
    # Create temporary response file
    local temp_response=$(mktemp)
    
    # Upload the file
    local http_code=$(curl -s -w "%{http_code}" \
        -X POST \
        -F "cv=@$file_path" \
        "$API_URL/api/cv/extract" \
        -o "$temp_response")
    
    # Check the response
    if [ "$http_code" = "200" ]; then
        # Parse response to get extracted name and email
        local extracted_name=$(cat "$temp_response" | jq -r '.data.personalInfo.name // "Unknown Name"' 2>/dev/null || echo "Unknown Name")
        local extracted_email=$(cat "$temp_response" | jq -r '.data.personalInfo.email // "No email"' 2>/dev/null || echo "No email")
        
        echo -e "${GREEN}✅ Success: $filename${NC}"
        echo "   📝 Extracted: $extracted_name"
        echo "   📧 Email: $extracted_email"
        
        # Log success
        echo "[$(date)] SUCCESS: $filename - $extracted_name ($extracted_email)" >> "$LOG_FILE"
        
        ((SUCCESSFUL++))
        rm -f "$temp_response"
        return 0
    else
        # Get error message
        local error_msg=$(cat "$temp_response" | jq -r '.message // "Unknown error"' 2>/dev/null || echo "HTTP $http_code error")
        
        echo -e "${RED}❌ Failed: $filename - $error_msg${NC}"
        
        # Log failure
        echo "[$(date)] FAILED: $filename - $error_msg" >> "$LOG_FILE"
        
        ((FAILED++))
        rm -f "$temp_response"
        return 1
    fi
}

# Function to show progress
show_progress() {
    local current=$1
    local total=$2
    local percentage=$((current * 100 / total))
    echo -e "${YELLOW}📊 Progress: $current/$total ($percentage%)${NC}"
}

# Test API connection first
if ! test_api_connection; then
    exit 1
fi

echo ""

# Find all PDF files
echo "🔍 Scanning for PDF files..."
PDF_FILES=()
while IFS= read -r -d '' file; do
    PDF_FILES+=("$file")
done < <(find "$CV_FOLDER" -maxdepth 1 -name "*.pdf" -type f -print0 2>/dev/null)

TOTAL_FILES=${#PDF_FILES[@]}

if [ $TOTAL_FILES -eq 0 ]; then
    echo -e "${RED}❌ No PDF files found in: $CV_FOLDER${NC}"
    exit 1
fi

echo -e "${GREEN}📁 Found $TOTAL_FILES PDF files${NC}"
echo ""

# Show file list
echo "📋 Files to upload:"
for i in "${!PDF_FILES[@]}"; do
    local filename=$(basename "${PDF_FILES[$i]}")
    local file_size=$(stat -f%z "${PDF_FILES[$i]}" 2>/dev/null || stat -c%s "${PDF_FILES[$i]}" 2>/dev/null || echo "0")
    local formatted_size=$(format_file_size $file_size)
    echo "   $((i + 1)). $filename ($formatted_size)"
done

echo ""

# Confirm upload
read -p "❓ Do you want to proceed with the upload? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Upload cancelled by user${NC}"
    exit 0
fi

echo ""
echo "🚀 Starting upload process..."
echo ""

# Initialize log file
echo "CV Batch Upload Log - $(date)" > "$LOG_FILE"
echo "Folder: $CV_FOLDER" >> "$LOG_FILE"
echo "API URL: $API_URL" >> "$LOG_FILE"
echo "Total files: $TOTAL_FILES" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"

# Upload each file
for i in "${!PDF_FILES[@]}"; do
    show_progress $((i + 1)) $TOTAL_FILES
    upload_file "${PDF_FILES[$i]}"
    
    # Add delay between uploads (except for the last file)
    if [ $((i + 1)) -lt $TOTAL_FILES ]; then
        echo -e "${YELLOW}⏳ Waiting ${DELAY_SECONDS} second(s) before next upload...${NC}"
        echo ""
        sleep $DELAY_SECONDS
    fi
done

# Final results
echo ""
echo "============================================================"
echo "📊 UPLOAD RESULTS"
echo "============================================================"
echo "📁 Folder: $CV_FOLDER"
echo "📄 Total files: $TOTAL_FILES"
echo -e "✅ Successful: ${GREEN}$SUCCESSFUL${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"

if [ $TOTAL_FILES -gt 0 ]; then
    local success_rate=$((SUCCESSFUL * 100 / TOTAL_FILES))
    echo "📈 Success rate: $success_rate%"
fi

echo "📝 Detailed log: $LOG_FILE"

# Show failed uploads if any
if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Failed uploads:${NC}"
    grep "FAILED:" "$LOG_FILE" | while read -r line; do
        echo "   • $(echo "$line" | cut -d' ' -f3-)"
    done
fi

echo ""
echo "🎉 Batch upload completed!"

# Set exit code based on results
if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi 