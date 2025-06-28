import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import startAuthFlowRouter from './oauth/startAuthFlow';
import callbackRouter from './oauth/callback';
import initiateRouter from './oauth/initiate';
import pollStatusRouter from './oauth/pollStatus';
import handleGetFileComments from './comments/getComments';

dotenv.config();

const app = express();

app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    // Figma plugin makes requests with no origin 
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://www.figma.com',
      'https://figma.com',
      'https://figma-comment-export.onrender.com',
      'null'
    ];
    
    // Add ngrok URL only in development
    if (process.env.NODE_ENV === 'development' && process.env.NGROK_URL) {
      allowedOrigins.push(process.env.NGROK_URL);
    }
  
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'ngrok-skip-browser-warning'
  ]
}));

app.options('*', cors());



app.use(express.json());

app.use('/api/oauth', initiateRouter);
app.use('/api/oauth', startAuthFlowRouter);
app.use('/api/oauth', callbackRouter);
app.use('/api/oauth', pollStatusRouter);
app.use('/api/comments', handleGetFileComments);


app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Replace ES6 export with CommonJS
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  }); 
} 
