# CV Data Extractor

A powerful application that extracts structured data from PDF CVs using advanced AI technology. This project consists of a backend API built with Node.js and Express, and a modern frontend built with React and TypeScript.

## Features

- PDF CV parsing and data extraction
- Structured data output in JSON format
- RESTful API for data management
- Modern web interface for CV management
- Search and filter capabilities
- Responsive design for all devices

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- MongoDB (v6 or higher)
- Git

## Project Structure

```
cv-data-extractor/
├── src/                    # Backend source code
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── index.js           # Application entry point
├── frontend/              # Frontend React application
│   ├── public/            # Static files
│   └── src/               # React source code
├── .env.example           # Environment variables template
├── package.json           # Backend dependencies
└── README.md              # Project documentation
```

## Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/RafieAmandio/CV-extractor-BE.git
   cd cv-data-extractor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/cv-extractor
   NODE_ENV=development
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

The backend API will be available at `http://localhost:3000/api/cv`

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`:
   ```
   VITE_API_URL=http://localhost:3000/api/cv
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The frontend application will be available at `http://localhost:5173`

## API Documentation

For detailed API documentation, please refer to [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## Available Scripts

### Backend

- `npm run dev`: Start development server with hot reload
- `npm run start`: Start production server
- `npm run test`: Run tests
- `npm run lint`: Run linter
- `npm run build`: Build for production

### Frontend

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run test`: Run tests
- `npm run lint`: Run linter

## Environment Variables

### Backend (.env)

- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development/production)
- `JWT_SECRET`: JWT secret for authentication
- `UPLOAD_DIR`: Directory for file uploads

### Frontend (.env)

- `VITE_API_URL`: Backend API URL
- `VITE_APP_NAME`: Application name
- `VITE_APP_VERSION`: Application version

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments

- OpenAI for providing the AI technology
- All contributors who have helped improve this project 