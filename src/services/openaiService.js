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
                      - details: object containing analysis for each factor (skills, experience, education, overall)
                      - recommendations: what could make this candidate a better match
                      
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
      
      logger.info('Job match calculation completed', { score: matchResult.score });
      
      return matchResult;
    } catch (error) {
      logger.error('Job match calculation failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new OpenAIService();
