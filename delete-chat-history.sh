#!/bin/bash

# Delete Chat History Test Script
# Make sure your server is running on localhost:3000

API_BASE="http://localhost:3000"

echo "🗑️  Delete Chat History Test"
echo "=============================="
echo ""
echo "⚠️  WARNING: This will PERMANENTLY delete ALL chat history!"
echo "This action cannot be undone."
echo ""

# Function to get current chat history count
get_chat_count() {
  curl -s "$API_BASE/api/cv/chat/history?limit=1" | jq -r '.data.pagination.total // 0' 2>/dev/null || echo "0"
}

# Check current count
echo "📊 Checking current chat history count..."
CURRENT_COUNT=$(get_chat_count)
echo "📈 Current chat history records: $CURRENT_COUNT"
echo ""

if [ "$CURRENT_COUNT" = "0" ]; then
  echo "ℹ️  No chat history found. Nothing to delete."
  exit 0
fi

# Confirm deletion
read -p "Are you sure you want to delete all $CURRENT_COUNT chat history records? (type 'DELETE' to confirm): " -r
echo ""

if [ "$REPLY" != "DELETE" ]; then
  echo "❌ Operation cancelled. Chat history preserved."
  exit 0
fi

echo "🗑️  Proceeding with deletion..."
echo ""

# Perform deletion
echo "📤 Making DELETE request to: $API_BASE/api/cv/chat/history"
RESPONSE=$(curl -s -X DELETE "$API_BASE/api/cv/chat/history" -H "Content-Type: application/json")

echo "📥 Response received:"
echo "$RESPONSE" | jq '.'

# Check if deletion was successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
if [ "$SUCCESS" = "true" ]; then
  DELETED_COUNT=$(echo "$RESPONSE" | jq -r '.data.deletedCount // 0')
  echo ""
  echo "✅ Deletion successful!"
  echo "🗑️  Deleted $DELETED_COUNT records"
  
  # Verify deletion
  echo ""
  echo "🔍 Verifying deletion..."
  NEW_COUNT=$(get_chat_count)
  echo "📈 Remaining chat history records: $NEW_COUNT"
  
  if [ "$NEW_COUNT" = "0" ]; then
    echo "✅ Verification successful - all chat history deleted"
  else
    echo "⚠️  Warning: $NEW_COUNT records still remain"
  fi
else
  echo ""
  echo "❌ Deletion failed"
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message // "Unknown error"')
  echo "📝 Error message: $ERROR_MSG"
fi

echo ""
echo "�� Test completed!" 