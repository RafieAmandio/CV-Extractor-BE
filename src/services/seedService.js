const Job = require('../models/job.model');
const logger = require('../utils/logger');

class SeedService {
  /**
   * Generate sample job data
   * @returns {Array} - Array of sample job objects
   */
  generateSampleJobs() {
    const sampleJobs = [
      {
        title: 'Frontend Developer',
        company: 'TechSolutions Inc.',
        description: 'We are looking for a skilled Frontend Developer to join our team. The ideal candidate should have strong experience with React and modern JavaScript.',
        requirements: [
          'Proficient in React, JavaScript, HTML5, and CSS3',
          'Experience with state management libraries (Redux, Context API)',
          'Knowledge of responsive design and cross-browser compatibility',
          'Understanding of RESTful APIs and AJAX',
          'Familiarity with version control systems (Git)'
        ],
        skills: [
          'React', 'JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'Redux', 'Git', 'Responsive Design'
        ],
        responsibilities: [
          'Develop user-facing features using React.js',
          'Build reusable components and libraries for future use',
          'Translate designs and wireframes into high-quality code',
          'Optimize components for maximum performance',
          'Collaborate with backend developers for RESTful API integration'
        ],
        location: 'San Francisco, CA (Remote available)',
        salary: {
          min: 90000,
          max: 120000,
          currency: 'USD'
        },
        jobType: 'Full-time',
        industry: 'Technology',
        experienceLevel: 'Mid-level',
        educationLevel: 'Bachelor'
      },
      {
        title: 'Backend Engineer',
        company: 'Data Systems Corp',
        description: 'Data Systems Corp is seeking a talented Backend Engineer to develop robust server-side applications. The ideal candidate will have strong experience with Node.js and database systems.',
        requirements: [
          'Strong proficiency in Node.js and Express',
          'Experience with MongoDB and SQL databases',
          'Knowledge of RESTful API design principles',
          'Understanding of server-side templating languages',
          'Experience with cloud services (AWS, Azure, or GCP)'
        ],
        skills: [
          'Node.js', 'Express', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker', 'RESTful API', 'Git'
        ],
        responsibilities: [
          'Design and implement server-side applications',
          'Develop and maintain database schemas',
          'Create and optimize API endpoints',
          'Implement authentication and authorization',
          'Deploy and monitor applications in cloud environments'
        ],
        location: 'Austin, TX',
        salary: {
          min: 95000,
          max: 130000,
          currency: 'USD'
        },
        jobType: 'Full-time',
        industry: 'Technology',
        experienceLevel: 'Mid-level',
        educationLevel: 'Bachelor'
      },
      {
        title: 'Full Stack Developer',
        company: 'WebApp Innovations',
        description: 'WebApp Innovations is looking for a Full Stack Developer to work on exciting web applications. You will be responsible for both frontend and backend development.',
        requirements: [
          'Experience with MERN or MEAN stack',
          'Proficiency in JavaScript/TypeScript',
          'Knowledge of frontend frameworks (React, Angular, or Vue)',
          'Familiarity with Node.js and Express',
          'Understanding of database systems (MongoDB, MySQL)'
        ],
        skills: [
          'React', 'Node.js', 'JavaScript', 'TypeScript', 'MongoDB', 'Express', 'CSS3', 'HTML5', 'Git'
        ],
        responsibilities: [
          'Develop both frontend and backend components',
          'Work with designers to implement UI/UX features',
          'Optimize applications for performance and scalability',
          'Implement responsive design principles',
          'Collaborate with team members on code reviews and architecture decisions'
        ],
        location: 'Remote',
        salary: {
          min: 100000,
          max: 140000,
          currency: 'USD'
        },
        jobType: 'Full-time',
        industry: 'Technology',
        experienceLevel: 'Mid-level',
        educationLevel: 'Bachelor'
      },
      {
        title: 'Data Scientist',
        company: 'Analytics Pro',
        description: 'Analytics Pro is seeking a Data Scientist to join our growing team. You will analyze complex datasets and build predictive models to solve business problems.',
        requirements: [
          'Strong background in statistics and mathematics',
          'Proficiency in Python and data analysis libraries',
          'Experience with machine learning frameworks',
          'Knowledge of data visualization techniques',
          'Familiarity with SQL and NoSQL databases'
        ],
        skills: [
          'Python', 'R', 'SQL', 'Machine Learning', 'TensorFlow', 'PyTorch', 'Data Visualization', 'Statistics'
        ],
        responsibilities: [
          'Collect and analyze large datasets',
          'Build and deploy machine learning models',
          'Communicate findings to non-technical stakeholders',
          'Collaborate with engineers to implement models in production',
          'Stay current with latest research and techniques'
        ],
        location: 'Boston, MA',
        salary: {
          min: 110000,
          max: 150000,
          currency: 'USD'
        },
        jobType: 'Full-time',
        industry: 'Data Science',
        experienceLevel: 'Senior',
        educationLevel: 'Master'
      },
      {
        title: 'UX/UI Designer',
        company: 'Creative Digital Agency',
        description: 'Creative Digital Agency is looking for a talented UX/UI Designer to create beautiful, functional designs for web and mobile applications.',
        requirements: [
          'Strong portfolio demonstrating UX/UI design skills',
          'Proficiency with design tools (Figma, Sketch, Adobe XD)',
          'Understanding of user-centered design principles',
          'Knowledge of HTML, CSS, and responsive design',
          'Experience conducting user research and usability testing'
        ],
        skills: [
          'Figma', 'Sketch', 'Adobe XD', 'Wireframing', 'Prototyping', 'User Research', 'HTML/CSS'
        ],
        responsibilities: [
          'Create wireframes, prototypes, and high-fidelity designs',
          'Conduct user research and usability testing',
          'Collaborate with developers to implement designs',
          'Maintain design systems and style guides',
          'Stay current with latest design trends and best practices'
        ],
        location: 'New York, NY',
        salary: {
          min: 85000,
          max: 115000,
          currency: 'USD'
        },
        jobType: 'Full-time',
        industry: 'Design',
        experienceLevel: 'Mid-level',
        educationLevel: 'Bachelor'
      }
    ];

    return sampleJobs;
  }

  /**
   * Seed the database with sample jobs
   * @param {boolean} clearExisting - Whether to clear existing data before seeding
   * @returns {Promise<Object>} - Result of the seeding operation
   */
  async seedJobs(clearExisting = false) {
    try {
      logger.info('Starting job seeding process');
      
      let existingCount = 0;
      let deletedCount = 0;
      
      // Count existing jobs
      existingCount = await Job.countDocuments();
      
      // Clear existing jobs if requested
      if (clearExisting) {
        const result = await Job.deleteMany({});
        deletedCount = result.deletedCount;
        logger.info('Cleared existing jobs', { count: deletedCount });
      }
      
      // Generate sample jobs
      const sampleJobs = this.generateSampleJobs();
      
      // Insert sample jobs
      const insertedJobs = await Job.insertMany(sampleJobs);
      
      logger.info('Job seeding completed', { 
        inserted: insertedJobs.length,
        existing: existingCount,
        deleted: deletedCount
      });
      
      return {
        success: true,
        existingCount,
        deletedCount,
        insertedCount: insertedJobs.length,
        insertedJobs
      };
    } catch (error) {
      logger.error('Job seeding failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SeedService(); 