# CV Data Extractor API Documentation

## Chat Endpoints

### 1. Chat with AI (Enhanced Hybrid Search)
Interact with the AI assistant to analyze CV data and find job matches using advanced hybrid search that combines traditional database filtering with semantic search.

**Endpoint:** `POST /api/cv/chat`

**Enhanced Search Capabilities:**
- **Traditional Filtering**: GPA thresholds, company experience, university backgrounds
- **Semantic Search**: Skills, experience descriptions, role requirements
- **Hybrid Queries**: Combination of specific criteria with semantic understanding

**Request Body:**
```json
{
  "message": "Find candidates from UI with GPA above 3.2 who worked at Traveloka",
  "cvId": "optional_cv_id"  // Optional: Focus conversation on specific CV
}
```

**Supported Query Types:**

1. **Academic Filtering:**
   - `"Find candidates with GPA above 3.5"`
   - `"Show me graduates from UI or ITB"`
   - `"Computer science graduates from top universities"`

2. **Company Experience:**
   - `"Candidates who worked at Traveloka"`
   - `"Show me people with experience at tech companies"`
   - `"Find developers who worked at Gojek or Tokopedia"`

3. **Semantic Skills Search:**
   - `"Python developers with machine learning experience"`
   - `"Senior frontend engineers with React expertise"`
   - `"Full-stack developers familiar with microservices"`

4. **Complex Hybrid Queries:**
   - `"Find UI graduates with GPA above 3.2 who worked at Traveloka"`
   - `"Senior software engineers from top universities with cloud computing experience"`
   - `"Machine learning engineers with Python skills from ITB or UI"`

**Response:**
```json
{
  "success": true,
  "message": "Chat processed successfully",
  "data": {
    "response": "Found 3 matching CVs using hybrid search approach:\n\n🎯 **John Doe** (Match: 92.5%)\n📧 john.doe@email.com\n💼 Current Role: Software Engineer at Traveloka\n🎓 Education: Bachelor in Computer Science from UI (GPA: 3.7)\n🔧 Key Skills: Python, React, Machine Learning\n⭐ Highlights:\n- 3 years experience at Traveloka\n- Published research in AI\n- Led 5-person development team\n📊 Experience: 4 years in software development",
    "functionResult": [
      {
        "_id": "cv_id_123",
        "personalInfo": {
          "name": "John Doe",
          "email": "john.doe@email.com"
        },
        "education": [
          {
            "institution": "University of Indonesia",
            "degree": "Bachelor",
            "field": "Computer Science",
            "gpa": "3.7"
          }
        ],
        "experience": [
          {
            "company": "Traveloka",
            "position": "Software Engineer",
            "startDate": "2020-01",
            "endDate": "Present"
          }
        ],
        "score": 0.925,
        "matchType": "hybrid"
      }
    ]
  }
}
```

**Query Parsing Examples:**

The system automatically extracts filters from natural language:

| Query | Extracted Filters | Semantic Terms |
|-------|-------------------|----------------|
| "Find UI graduates with GPA above 3.2 who worked at Traveloka" | university: "UI", gpa: ≥3.2, company: "Traveloka" | "graduates" |
| "Python developers with React experience from top universities" | skills: ["Python", "React"] | "developers", "top universities" |
| "Senior engineers with GPA above 3.5" | gpa: ≥3.5 | "senior engineers" |

**Example Usage:**
```bash
curl -X POST http://localhost:3000/api/cv/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find candidates from UI with GPA above 3.2 who worked at Traveloka",
    "cvId": "123456789"
  }'
```

**Available AI Functions:**
- `searchCVs`: Search for CVs based on specific criteria
- `getCVDetails`: Get detailed information about a specific CV
- `getJobMatches`: Get job matches for a specific CV

### 2. Get Chat History
Retrieve the history of chat interactions with pagination and filtering options.

**Endpoint:** `GET /api/cv/chat/history`

**Query Parameters:**
- `page` (number, default: 1): Page number for pagination
- `limit` (number, default: 20): Number of items per page
- `cvId` (string, optional): Filter by specific CV ID
- `startDate` (string, optional): Filter by start date (ISO format)
- `endDate` (string, optional): Filter by end date (ISO format)

**Response:**
```json
{
  "success": true,
  "message": "Chat history retrieved successfully",
  "data": {
    "history": [
      {
        "message": "Find CVs with Python experience",
        "response": "I found 3 CVs with Python experience...",
        "cvId": {
          "_id": "cv_id",
          "fileName": "example.pdf",
          "personalInfo": {
            "name": "John Doe"
          }
        },
        "functionCalls": [
          {
            "name": "searchCVs",
            "arguments": {
              "query": "Python",
              "limit": 10
            },
            "result": [
              // Array of matching CVs
            ]
          }
        ],
        "createdAt": "2024-03-20T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Example Usage:**
```bash
# Get all history (paginated)
curl "http://localhost:3000/api/cv/chat/history?page=1&limit=20"

# Get history for a specific CV
curl "http://localhost:3000/api/cv/chat/history?cvId=123456789"

# Get history within a date range
curl "http://localhost:3000/api/cv/chat/history?startDate=2024-01-01&endDate=2024-03-20"

# Combine filters
curl "http://localhost:3000/api/cv/chat/history?cvId=123456789&startDate=2024-01-01&endDate=2024-03-20&page=1&limit=10"
```

**Error Responses:**
```json
// Invalid request
{
  "success": false,
  "message": "Message is required"
}

// CV not found
{
  "success": false,
  "message": "CV not found"
}

// Server error
{
  "success": false,
  "message": "Internal server error"
}
```

**Notes:**
1. The chat endpoint automatically stores all interactions in the history
2. Function calls and their results are preserved in the history
3. The history endpoint supports flexible filtering and pagination
4. All dates should be in ISO format (YYYY-MM-DD)
5. The response includes basic CV information when available
6. The pagination object helps with implementing infinite scroll or pagination UI 