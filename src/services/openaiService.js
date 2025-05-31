const { OpenAI } = require('openai');
const config = require('../config/default');
const logger = require('../utils/logger');
const { cvDataSchema } = require('../schemas/cvDataSchema');
const CVData = require('../models/cvData.model');
const Match = require('../models/match.model');
const mongoose = require('mongoose');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
    this.model = config.openai.model;
  }

  /**
   * Extract structured CV data from text using OpenAI's GPT-4o
   * @param {string} text - CV text content
   * @returns {Promise<Object>} - Structured CV data
   */

  async extractCVData(text) {
    try {
      logger.info('Starting CV data extraction with OpenAI');
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a CV data extraction expert. 
            Extract structured information from the CV text provided.
            Return a JSON object with the following structure, leaving fields empty if not found:
            {
              "personalInfo": {
                "name": "",
                "email": "",
                "phone": "",
                "location": "",
                "linkedin": "",
                "website": "",
                "summary": ""
              },
              "education": [
                {
                  "institution": "",
                  "degree": "",
                  "field": "",
                  "startDate": "",
                  "endDate": "",
                  "gpa": "",
                  "description": ""
                }
              ],
              "experience": [
                {
                  "company": "",
                  "position": "",
                  "startDate": "",
                  "endDate": "",
                  "location": "",
                  "description": "",
                  "achievements": []
                }
              ],
              "skills": [
                {
                  "category": "",
                  "skills": []
                }
              ],
              "certifications": [
                {
                  "name": "",
                  "issuer": "",
                  "date": "",
                  "expires": false,
                  "expirationDate": ""
                }
              ],
              "languages": [
                {
                  "language": "",
                  "proficiency": ""
                }
              ],
              "projects": [
                {
                  "name": "",
                  "description": "",
                  "startDate": "",
                  "endDate": "",
                  "technologies": [],
                  "url": ""
                }
              ],
              "publications": [
                {
                  "title": "",
                  "publisher": "",
                  "date": "",
                  "authors": [],
                  "url": ""
                }
              ],
              "awards": [
                {
                  "title": "",
                  "issuer": "",
                  "date": "",
                  "description": ""
                }
              ],
              "references": [
                {
                  "name": "",
                  "position": "",
                  "company": "",
                  "contact": "",
                  "relationship": ""
                }
              ]
            }
            
            If certain sections are not found in the CV, return them as empty arrays or objects.
            Ensure that dates are formatted as strings in YYYY-MM-DD format when possible,
            but preserve the original format if exact dates cannot be determined.
            For ongoing positions or education, use "Present" for the endDate.

            `
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      
      // Validate against schema
      const validatedData = cvDataSchema.parse(result);
      
      logger.info('CV data extraction completed successfully');
      return validatedData;
    } catch (error) {
      logger.error('OpenAI CV data extraction failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Calculate match score between a CV and a job
   * @param {Object} data - Object containing CV and job data
   * @returns {Promise<Object>} - Matching score and details
   */
  async calculateJobMatch(data) {
    try {
      logger.info('Starting job match calculation with OpenAI');
      
      const { cv, job } = data;
      
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: `You are an AI trained to analyze matches between job candidates and job descriptions.
                      Your task is to evaluate how well a candidate matches a job posting and provide
                      a numeric score (0-100) along with detailed reasoning.
                      
                      Consider the following factors:
                      1. Skills match (how many required skills the candidate has)
                      2. Experience relevance (is their experience relevant to the job)
                      3. Education alignment (does their education match requirements)
                      4. Overall fit based on job description
                      
                      Provide a detailed analysis for each factor.`
          },
          {
            role: "user",
            content: `Evaluate how well this candidate matches the job description. Return a JSON object with:
                      - score: numeric score between 0-100
                      - details: object containing analysis for each factor with EXACT keys:
                        * skills: { score: Number, analysis: String }
                        * experience: { score: Number, analysis: String }
                        * education: { score: Number, analysis: String }
                        * overall: { score: Number, analysis: String }
                      - recommendations: an object with recommendations for improvement (NOT an array)
                      
                      IMPORTANT: Use EXACTLY the structure above for the details object.
                      The "score" field in each section MUST be called "score", not "match" or "relevance" or any other term.
                      
                      Format the recommendations as a single object with keys like 'skills', 'experience', 'education'.
                      
                      Here's an example of a valid response format:
                      
                      {
                        "score": 75,
                        "details": {
                          "skills": {
                            "score": 70,
                            "analysis": "The candidate has 7 out of 10 required skills, including JavaScript, React, and Git. However, they lack experience with Docker, AWS, and GraphQL."
                          },
                          "experience": {
                            "score": 80,
                            "analysis": "The candidate has 4 years of relevant experience in web development roles, which aligns well with the position's requirements."
                          },
                          "education": {
                            "score": 90,
                            "analysis": "The candidate has a Bachelor's degree in Computer Science, which meets the educational requirements for this position."
                          },
                          "overall": {
                            "score": 75,
                            "analysis": "Overall, the candidate is a good match for the position with strong education and experience, but would benefit from developing a few additional technical skills."
                          }
                        },
                        "recommendations": {
                          "skills": "Develop experience with Docker, AWS, and GraphQL to fully meet the technical requirements.",
                          "experience": "Seek opportunities to lead projects to strengthen leadership capabilities.",
                          "education": "Consider obtaining AWS certification to complement existing qualifications."
                        }
                      }
                      
                      CV Information:
                      ${JSON.stringify(cv, null, 2)}
                      
                      Job Description:
                      ${JSON.stringify(job, null, 2)}`
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      });
      
      const responseContent = completion.choices[0].message.content;
      
      // Parse JSON response
      const matchResult = JSON.parse(responseContent);
      
      // Normalize response structure to ensure consistency
      const normalizedDetails = {
        skills: {
          score: matchResult.details?.skills?.score || matchResult.details?.skills?.match || 0,
          analysis: matchResult.details?.skills?.analysis || ''
        },
        experience: {
          score: matchResult.details?.experience?.score || matchResult.details?.experience?.relevance || 0,
          analysis: matchResult.details?.experience?.analysis || ''
        },
        education: {
          score: matchResult.details?.education?.score || matchResult.details?.education?.alignment || 0,
          analysis: matchResult.details?.education?.analysis || ''
        },
        overall: {
          score: matchResult.details?.overall?.score || matchResult.details?.overall?.fit || 0,
          analysis: matchResult.details?.overall?.analysis || ''
        }
      };
      
      // Update the match result with normalized details
      matchResult.details = normalizedDetails;
      
      logger.info('Job match calculation completed', { score: matchResult.score });
      
      return matchResult;
    } catch (error) {
      logger.error('Job match calculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process a chat message using OpenAI with function calling
   * @param {string} message - The user's message
   * @param {Object} [cvData] - Optional CV data to focus the conversation on
   * @param {Array} [chatHistory] - Optional array of previous chat messages
   * @returns {Promise<Object>} - AI response
   */
  async processChatMessage(message, cvData = null, chatHistory = []) {
    try {
      logger.info('Processing chat message', {
        messageLength: message.length,
        hasCvData: !!cvData,
        historyLength: chatHistory.length
      });

      const functions = [
        {
          name: 'searchCVs',
          description: 'Search for CVs using hybrid semantic and traditional filtering. Supports complex queries with specific criteria like GPA thresholds, company experience, university backgrounds, and semantic skill matching. Examples: "candidates from UI with GPA above 3.2 who worked at Traveloka", "Python developers with React experience", "machine learning engineers from top universities"',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query that can include specific filters (GPA, company names, universities) and semantic terms (skills, experience). The system will automatically parse and apply both traditional database filters and semantic search.'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10
              }
            },
            required: ['query']
          }
        },
        {
          name: 'getCVDetails',
          description: 'Get detailed information about a specific CV by ID or name',
          parameters: {
            type: 'object',
            properties: {
              cvId: {
                type: 'string',
                description: 'ID or name of the CV to retrieve'
              }
            },
            required: ['cvId']
          }
        },
        {
          name: 'getJobMatches',
          description: 'Get job matches for a specific CV',
          parameters: {
            type: 'object',
            properties: {
              cvId: {
                type: 'string',
                description: 'ID of the CV to find matches for'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of matches to return',
                default: 10
              }
            },
            required: ['cvId']
          }
        }
      ];

      const messages = [
        {
          role: 'system',
          content: `You are an AI assistant specialized in CV analysis and job matching. Your role is to help users find the best candidates and job matches using the available functions.

ROLE AND CAPABILITIES:
- You are a professional CV analyst and job matching expert
- You can search through CVs, analyze their details, and find matching jobs
- You provide clear, concise, and actionable insights
- You maintain a professional yet friendly tone
- You maintain context from previous messages in the conversation

AVAILABLE FUNCTIONS:
1. searchCVs(query, limit)
   - Advanced hybrid search combining semantic understanding with precise filtering
   - Supports complex queries with multiple criteria:
     * Academic filters: "GPA above X", "from [University]"
     * Experience filters: "worked at [Company]", "experience in [Technology]"
     * Semantic matching: Skills, roles, and experience descriptions
   - Examples: 
     * "Find candidates from UI with GPA above 3.2 who worked at Traveloka"
     * "Senior Java developers with Spring Boot experience from top universities"
     * "Machine learning engineers with Python and TensorFlow skills"
   - Returns ranked results with relevance scores

2. getCVDetails(cvId)
   - Get detailed information about a specific CV
   - Use when users want to analyze a particular candidate
   - Example: "Show me details about CV ID 123"

3. getJobMatches(cvId, limit)
   - Get job matches for a specific CV
   - Use to find suitable jobs for a candidate
   - Example: "What are the best job matches for this CV?"

RESPONSE FORMAT:
1. For search results:
   - Start with a summary: "Found X matching CVs for your search"
   - Mention the search strategy used: "Using [hybrid/semantic/filter] search approach"
   - List each CV in this format:
     🎯 **[Candidate Name]** (Match: [Score]%)
     📧 [Email]
     💼 Current Role: [Position] at [Company]
     🎓 Education: [Degree] from [Institution] (GPA: [GPA if available])
     🔧 Key Skills: [Top 3-5 relevant skills]
     ⭐ Highlights:
       - [Notable achievement or qualification]
       - [Previous relevant company experience]
       - [Key technical or academic accomplishment]
     📊 Experience: [Years] years in [field]
     
   - For complex queries, explain why each candidate matches the criteria
   - If fewer results than expected, suggest alternative search terms

2. For CV details:
   - Use this structured format:
     [Person] PROFILE
     Name: [Full Name]
     Email: [Email]
     Location: [Location]
     LinkedIn: [LinkedIn URL]
     
     [Memo] SUMMARY
     [2-3 sentence professional summary]
     
     [Briefcase] EXPERIENCE
     [Company Name] | [Position]
     [Duration]
     - [Key achievement]
     - [Another achievement]
     
     [Graduation Cap] EDUCATION
     [Degree] in [Field]
     [Institution] | [Duration]
     [Notable achievements or GPA if available]
     
     [Tools] SKILLS
     Technical: [List of technical skills]
     Soft Skills: [List of soft skills]
     
     [Trophy] CERTIFICATIONS
     - [Certification 1]
     - [Certification 2]
     
     [Chart Up] STRENGTHS
     - [Strength 1]
     - [Strength 2]
     - [Strength 3]

3. For job matches:
   - Use this format:
     [Target] MATCH ANALYSIS
     Overall Match: [Score]%
     
     [Chart] BREAKDOWN
     - Skills Match: [Score]% - [Brief explanation]
     - Experience Match: [Score]% - [Brief explanation]
     - Education Match: [Score]% - [Brief explanation]
     
     [Light Bulb] RECOMMENDATIONS
     - [Specific recommendation 1]
     - [Specific recommendation 2]

BEST PRACTICES:
- Always explain your reasoning
- Provide specific examples from the data
- Suggest relevant follow-up questions
- Be proactive in offering additional insights
- Format responses in a clear, readable way
- Use bullet points for lists and key points
- Include relevant metrics when available
- Keep sections concise but informative
- Highlight the most relevant information first
- Maintain conversation context and refer to previous interactions when relevant

Remember to:
1. Understand the user's intent before making function calls
2. Provide context for your recommendations
3. Be specific about why certain matches are relevant
4. Suggest ways to improve matches if needed
5. Keep responses focused and actionable
6. Use consistent formatting throughout the response
7. Prioritize the most relevant information
8. Include clear section headers
9. Make it easy to scan and read quickly
10. Reference previous messages when relevant to maintain conversation flow`
        }
      ];

      // Add CV context if available
      if (cvData) {
        messages.push({
          role: 'system',
          content: `Current CV context:\n${JSON.stringify(cvData, null, 2)}`
        });
      }

      // Add chat history context
      if (chatHistory && chatHistory.length > 0) {
        // Add last 5 messages for context (to avoid token limits)
        const recentHistory = chatHistory.slice(-5);
        recentHistory.forEach(chat => {
          messages.push({
            role: 'user',
            content: chat.message
          });
          messages.push({
            role: 'assistant',
            content: chat.response
          });
        });
      }

      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages,
        functions,
        function_call: 'auto'
      });

      const response = completion.choices[0].message;

      // Handle function calls
      if (response.function_call) {
        const functionName = response.function_call.name;
        const functionArgs = JSON.parse(response.function_call.arguments);

        // Log the function call and its parameters
        logger.info('AI Tool Call', {
          function: functionName,
          parameters: functionArgs,
          userMessage: message
        });

        let functionResult;
        switch (functionName) {
          case 'searchCVs':
            functionResult = await this.searchCVs(functionArgs.query, functionArgs.limit);
            logger.info('Search CVs Result', {
              query: functionArgs.query,
              limit: functionArgs.limit,
              resultsCount: functionResult.length
            });
            break;
          case 'getCVDetails':
            functionResult = await this.getCVDetails(functionArgs.cvId);
            logger.info('Get CV Details Result', {
              cvId: functionArgs.cvId,
              hasResult: !!functionResult
            });
            break;
          case 'getJobMatches':
            functionResult = await this.getJobMatches(functionArgs.cvId, functionArgs.limit);
            logger.info('Get Job Matches Result', {
              cvId: functionArgs.cvId,
              limit: functionArgs.limit,
              matchesCount: functionResult.length
            });
            break;
          default:
            logger.error('Unknown function called', { functionName });
            throw new Error(`Unknown function: ${functionName}`);
        }

        // Log the function result
        logger.info('Function Result', {
          function: functionName,
          resultSize: JSON.stringify(functionResult).length,
          resultType: Array.isArray(functionResult) ? 'array' : 'object',
          resultCount: Array.isArray(functionResult) ? functionResult.length : 1
        });

        // Add function result to messages and get final response
        messages.push(response);
        messages.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult)
        });

        const finalCompletion = await this.client.chat.completions.create({
          model: 'gpt-4o',
          messages
        });

        // Log the final response
        logger.info('Final AI Response', {
          function: functionName,
          responseLength: finalCompletion.choices[0].message.content.length
        });

        return {
          response: finalCompletion.choices[0].message.content,
          functionResult
        };
      }

      // Log direct response (no function call)
      logger.info('Direct AI Response', {
        responseLength: response.content.length
      });

      return {
        response: response.content
      };
    } catch (error) {
      logger.error('Chat message processing failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get embeddings for a text using OpenAI
   * @param {string} text - Text to get embeddings for
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  async getEmbeddings(text) {
    try {
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to get embeddings', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} vecA - First vector
   * @param {Array<number>} vecB - Second vector
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateCosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Parse search query to extract specific filters and semantic search terms
   * @param {string} query - Search query
   * @returns {Object} - Parsed filters and semantic query
   */
  parseSearchQuery(query) {
    const filters = {};
    let semanticQuery = query;

    // Extract GPA filter
    const gpaMatch = query.match(/gpa\s+(above|over|greater than|>)\s+([\d.]+)/i);
    if (gpaMatch) {
      filters.gpa = { $gte: parseFloat(gpaMatch[2]) };
      semanticQuery = semanticQuery.replace(gpaMatch[0], '').trim();
    }

    // Extract company/work experience filter
    const companyMatch = query.match(/work(?:ed)?\s+(?:in|at|for)\s+(\w+)/i);
    if (companyMatch) {
      filters.company = companyMatch[1];
      semanticQuery = semanticQuery.replace(companyMatch[0], '').trim();
    }

    // Extract university filter (UI, etc.)
    const universityMatch = query.match(/from\s+(\w+(?:\s+\w+)*?)(?:\s+with|\s+and|$)/i);
    if (universityMatch) {
      filters.university = universityMatch[1].trim();
      semanticQuery = semanticQuery.replace(universityMatch[0], '').trim();
    }

    // Extract specific skills or technologies
    const skillPatterns = [
      /(?:experience in|skilled in|knows|familiar with)\s+([^,.]+)/gi,
      /(\w+(?:\s+\w+)*?)\s+(?:developer|engineer|specialist)/gi
    ];

    skillPatterns.forEach(pattern => {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (!filters.skills) filters.skills = [];
        filters.skills.push(match[1].trim());
        semanticQuery = semanticQuery.replace(match[0], '').trim();
      }
    });

    // Clean up semantic query
    semanticQuery = semanticQuery.replace(/\s+/g, ' ').trim();

    return { filters, semanticQuery };
  }

  /**
   * Build MongoDB query from parsed filters
   * @param {Object} filters - Parsed filters
   * @returns {Object} - MongoDB query object
   */
  buildDatabaseQuery(filters) {
    const dbQuery = { embedding: { $exists: true } };

    // GPA filter
    if (filters.gpa) {
      dbQuery['education.gpa'] = filters.gpa;
    }

    // Company filter
    if (filters.company) {
      dbQuery['experience.company'] = { 
        $regex: new RegExp(filters.company, 'i') 
      };
    }

    // University filter
    if (filters.university) {
      dbQuery['education.institution'] = { 
        $regex: new RegExp(filters.university, 'i') 
      };
    }

    // Skills filter (if specific skills are mentioned)
    if (filters.skills && filters.skills.length > 0) {
      dbQuery['skills.skills'] = {
        $in: filters.skills.map(skill => new RegExp(skill, 'i'))
      };
    }

    return dbQuery;
  }

  /**
   * Search for CVs based on criteria with hybrid semantic + traditional search
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} - Matching CVs
   */
  async searchCVs(query, limit = 10) {
    try {
      logger.info('Starting hybrid CV search', { query, limit });

      // Parse the query to extract filters and semantic terms
      const { filters, semanticQuery } = this.parseSearchQuery(query);
      logger.info('Parsed search query', { filters, semanticQuery });

      // Build database query from filters
      const dbQuery = this.buildDatabaseQuery(filters);
      logger.info('Built database query', { dbQuery });

      // Get filtered CVs from database
      const filteredCVs = await CVData.find(dbQuery);
      logger.info('Database filtering completed', { 
        totalFiltered: filteredCVs.length,
        originalQuery: query 
      });

      // If no semantic query remains or no filtered results, return database results
      if (!semanticQuery || semanticQuery.length < 3 || filteredCVs.length === 0) {
        const results = filteredCVs
          .slice(0, limit)
          .map(cv => ({
            ...cv.toObject(),
            score: 1.0, // Perfect match for filter-only queries
            matchType: 'filter'
          }));

        logger.info('Filter-only search completed', { 
          resultsCount: results.length 
        });

        return results;
      }

      // Get query embedding for semantic search
      const queryEmbedding = await this.getEmbeddings(semanticQuery);
      logger.info('Generated query embedding for semantic search');

      // Calculate similarity scores for filtered CVs
      const scoredCVs = filteredCVs.map(cv => ({
        cv,
        score: this.calculateCosineSimilarity(queryEmbedding, cv.embedding)
      }));

      // Sort by similarity score and get top results
      const results = scoredCVs
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ cv, score }) => ({
          ...cv.toObject(),
          score,
          matchType: 'hybrid'
        }));

      logger.info('Hybrid search completed', { 
        resultsCount: results.length,
        averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
        filtersApplied: Object.keys(filters).length
      });

      return results;
    } catch (error) {
      logger.error('CV search failed', {
        error: error.message,
        query,
        limit
      });
      throw error;
    }
  }

  /**
   * Get detailed information about a CV
   * @param {string} identifier - CV ID or name
   * @returns {Promise<Object>} - CV details
   */
  async getCVDetails(identifier) {
    try {
      let cv;
      
      // Check if identifier is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        cv = await CVData.findById(identifier).select('-rawText');
      } else {
        // Search by name
        cv = await CVData.findOne({
          'personalInfo.name': { $regex: new RegExp(identifier, 'i') }
        }).select('-rawText');
      }

      if (!cv) {
        throw new Error(`CV not found for identifier: ${identifier}`);
      }

      logger.info('CV details retrieved successfully', {
        identifier,
        cvId: cv._id,
        name: cv.personalInfo.name
      });

      return cv;
    } catch (error) {
      logger.error('Failed to get CV details', {
        identifier,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get job matches for a CV
   * @param {string} cvId - CV ID
   * @param {number} limit - Maximum number of matches
   * @returns {Promise<Array>} - Job matches
   */
  async getJobMatches(cvId, limit = 10) {
    const matches = await Match.find({ cvId })
      .sort({ score: -1 })
      .limit(limit)
      .populate('jobId');

    return matches;
  }
}

module.exports = new OpenAIService();
