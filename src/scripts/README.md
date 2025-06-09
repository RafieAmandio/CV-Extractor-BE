# CV Scoring Scripts

This directory contains scripts for comprehensive CV analysis and scoring against multiple job roles.

## 🚀 Quick Start

```bash
# Navigate to scripts directory
cd src/scripts

# Run the CV scoring script
node score-all-cvs.js
```

## 📁 Files

### `job-definitions.json`
Contains detailed job role definitions with:
- Job descriptions and requirements
- Required skills with categories
- Experience requirements
- Education requirements
- Responsibilities

**Available Job Roles:**
- Senior Software Engineer
- Frontend Developer
- Backend Developer
- Full Stack Developer
- Data Scientist
- DevOps Engineer

### `score-all-cvs.js`
Main scoring script that:
- ✅ Retrieves all CVs from database
- ⚡ Processes multiple job matches in parallel (token efficient)
- 🎯 Generates precise decimal scores (no duplicates)
- 📊 Prevents duplicate CV processing
- 💾 Outputs results to CSV and summary JSON

### `output/`
Generated output files:
- `cv-scores-{timestamp}.csv` - Main results file
- `cv-scores-summary-{timestamp}.json` - Statistics and analysis

## 📊 Output Format

### CSV Columns
```csv
Candidate Name,Job Role,Score,Skills Score,Experience Score,Education Score,Email,GPA,Years Experience,Top Skills,CV ID
```

### Sample Output
```csv
"John Doe","Senior Software Engineer",87.34,85.20,89.10,88.50,"john@email.com",3.7,6.5,"JavaScript, React, Node.js, Python, AWS","507f1f77bcf86cd799439011"
"Jane Smith","Frontend Developer",84.92,90.15,82.30,82.40,"jane@email.com",3.9,4.2,"React, TypeScript, CSS, HTML, Jest","507f1f77bcf86cd799439012"
```

## 🔧 Features

### Multi-Job Parallel Processing
- **Token Efficient**: Evaluates all 6 job roles in a single API call
- **Precise Scoring**: Uses 2-3 decimal places to avoid score ties
- **Comprehensive Analysis**: Skills, experience, education breakdown

### Duplicate Prevention
- Uses CV `_id` to ensure no duplicate processing
- Tracks processed CVs across batches
- Warns about skipped duplicates

### Batch Processing
- Processes CVs in configurable batches (default: 5)
- Includes progress tracking and logging
- Handles errors gracefully (continues on failure)
- Rate limiting to avoid API limits

### Rich Data Extraction
- **GPA**: Extracts from education records
- **Experience**: Calculates total years from work history
- **Skills**: Top 5 skills from all categories
- **Contact Info**: Email and other details

## 📈 Summary Statistics

The script generates comprehensive statistics:

```json
{
  "totalCandidates": 150,
  "totalJobRoles": 6,
  "totalMatches": 900,
  "averageScore": 67.34,
  "scoreDistribution": {
    "0-20": 45,
    "20-40": 123,
    "40-60": 234,
    "60-80": 345,
    "80-100": 153
  },
  "topScores": [
    {
      "candidate": "Alice Johnson",
      "job": "Senior Software Engineer", 
      "score": 94.87
    }
  ]
}
```

## 🛠️ Configuration

### Job Definitions
Edit `job-definitions.json` to:
- Add new job roles
- Modify skill requirements
- Update experience thresholds
- Change education requirements

### Batch Size
Modify batch size in the script:
```javascript
const results = await this.processCVsInBatches(cvs, 10); // Increase batch size
```

### Output Directory
Change output location:
```javascript
this.outputDir = path.join(__dirname, '../output'); // Custom location
```

## 🚨 Requirements

- Node.js environment
- MongoDB connection
- OpenAI API key configured
- CVs uploaded to database

## ⚡ Performance

- **Processing Speed**: ~5 CVs per batch with 1s delays
- **API Efficiency**: 6x fewer API calls vs individual job scoring
- **Memory Usage**: Optimized with field selection and batching
- **Error Handling**: Continues processing on individual failures

## 🔍 Troubleshooting

### Common Issues

**No CVs found**
```bash
❌ No CVs found in database. Please upload some CVs first.
```
Solution: Upload CVs using the upload API endpoint

**API Rate Limits**
```bash
Error: Rate limit exceeded
```
Solution: Increase delay between batches or reduce batch size

**Missing Job Definitions**
```bash
Error: Cannot read job-definitions.json
```
Solution: Ensure `job-definitions.json` exists in scripts directory

### Logs
Check logs for detailed processing information:
```bash
tail -f logs/app.log
```

## 📝 Example Usage

```bash
# Basic run
node score-all-cvs.js

# Check output
ls -la output/
cat output/cv-scores-2024-01-15T10-30-00.csv
```

## 🎯 Use Cases

1. **Talent Acquisition**: Score candidates for multiple roles
2. **Skills Gap Analysis**: Identify missing skills across roles
3. **Performance Benchmarking**: Compare candidate quality
4. **Recruitment Analytics**: Generate hiring insights
5. **Career Guidance**: Show candidates their best-fit roles

---

**Note**: The multimodal CV extraction is already implemented in the main CV processing pipeline and will automatically handle PDFs without text content. 