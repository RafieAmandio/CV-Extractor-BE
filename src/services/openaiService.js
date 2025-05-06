const { OpenAI } = require('openai');
const config = require('../config/default');
const logger = require('../utils/logger');
const { cvDataSchema } = require('../schemas/cvDataSchema');

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
}

module.exports = new OpenAIService();
