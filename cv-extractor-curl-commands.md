# CV Data Extractor API - cURL Commands

This file contains cURL commands for all endpoints in the CV Data Extractor API. Replace `localhost:3000` with your actual server address if different.

## CV Endpoints

### Extract CV Data
```bash
# Upload and extract data from a CV file
curl -X POST "http://localhost:3000/api/cv/extract" \
  -H "Content-Type: multipart/form-data" \
  -F "cv=@/path/to/your/cv.pdf"
```

### Get All CVs
```bash
# Get all CVs with pagination and optional search
curl -X GET "http://localhost:3000/api/cv?page=1&limit=10&search=john"
```

### Get CV By ID
```bash
# Get a specific CV by ID
curl -X GET "http://localhost:3000/api/cv/your_cv_id_here"
```

### Get All CV IDs
```bash
# Get all CV IDs in the system
curl -X GET "http://localhost:3000/api/cv/ids"
```

### Find Best Jobs for CV
```bash
# Find best matching jobs for a specific CV
# Set refresh=true to force recalculation of all matches
curl -X GET "http://localhost:3000/api/cv/your_cv_id_here/jobs?limit=10&refresh=false"
```

### Test Upload
```bash
# Test endpoint for debugging file uploads
curl -X POST "http://localhost:3000/api/cv/test-upload" \
  -H "Content-Type: multipart/form-data" \
  -F "cv=@/path/to/your/cv.pdf"
```

## Job Endpoints

### Seed Jobs Database
```bash
# Seed the database with sample job data
# Set clear=true to remove existing jobs before seeding
curl -X POST "http://localhost:3000/api/jobs/seed?clear=false"
```

### Create Job
```bash
# Create a new job posting
curl -X POST "http://localhost:3000/api/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineer",
    "company": "Tech Corp",
    "location": "Remote",
    "description": "We are looking for a Software Engineer to join our team.",
    "requirements": [
      "Bachelor'\''s degree in Computer Science or related field",
      "3+ years of experience in software development"
    ],
    "skills": [
      "JavaScript",
      "React",
      "Node.js"
    ],
    "salary": {
      "min": 80000,
      "max": 120000,
      "currency": "USD"
    },
    "employmentType": "Full-time",
    "remote": true,
    "postingDate": "2025-04-01",
    "applicationDeadline": "2025-05-15"
  }'
```

### Get All Jobs
```bash
# Get all jobs with pagination and optional search
curl -X GET "http://localhost:3000/api/jobs?page=1&limit=10&search=engineer"
```

### Get Job By ID
```bash
# Get a specific job by ID
curl -X GET "http://localhost:3000/api/jobs/your_job_id_here"
```

### Update Job
```bash
# Update an existing job
curl -X PUT "http://localhost:3000/api/jobs/your_job_id_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Software Engineer",
    "company": "Tech Corp",
    "location": "Remote",
    "description": "Updated description for the job.",
    "requirements": [
      "Bachelor'\''s degree in Computer Science or related field",
      "5+ years of experience in software development"
    ],
    "skills": [
      "JavaScript",
      "React",
      "Node.js",
      "TypeScript"
    ],
    "salary": {
      "min": 100000,
      "max": 150000,
      "currency": "USD"
    },
    "employmentType": "Full-time",
    "remote": true,
    "postingDate": "2025-04-01",
    "applicationDeadline": "2025-05-30"
  }'
```

### Delete Job
```bash
# Delete a job by ID
curl -X DELETE "http://localhost:3000/api/jobs/your_job_id_here"
```

### Find Best CVs for Job
```bash
# Find best matching CVs for a specific job
# Set refresh=true to force recalculation of all matches
curl -X GET "http://localhost:3000/api/jobs/your_job_id_here/matches?limit=10&refresh=false"
``` 