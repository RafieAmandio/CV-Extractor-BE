// Load environment variables first, before any other imports
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables with explicit path
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Log environment loading status
console.log('Loading environment variables from:', envPath);
console.log('Current environment:', process.env.NODE_ENV);
console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);

const express = require('express');
const cors = require('cors');
const cvRoutes = require('./routes/cvRoutes');
const jobRoutes = require('./routes/jobRoutes');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./utils/database');
const logger = require('./utils/logger');
const config = require('./config/default');
const fs = require('fs');


// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: '*', // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/cv', cvRoutes);
app.use('/api/jobs', jobRoutes);

// Serve the test HTML at root
app.get('/', (req, res) => {
  try {
    const uploadTestPath = path.join(process.cwd(), 'upload-test.html');
    // Check if file exists
    if (fs.existsSync(uploadTestPath)) {
      res.sendFile(uploadTestPath);
    } else {
      res.send('CV Data Extractor API is running. Upload test file not found.');
    }
  } catch (error) {
    logger.error('Error serving test HTML', { error });
    res.send('CV Data Extractor API is running');
  }
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start listening
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`MongoDB URI: ${process.env.MONGODB_URI}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
