import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import startAuthFlowRouter from './oauth/startAuthFlow';
import callbackRouter from './oauth/callback';
import initiateRouter from './oauth/initiate';
import pollStatusRouter from './oauth/pollStatus';
import commentsRouter from './comments/router';

dotenv.config();

const app = express();

// If behind Render/ngrok/reverse proxy, needed for correct client IP in rate limiting.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cookieParser());
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Figma plugin often makes requests with no origin.
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://www.figma.com',
      'https://figma.com',
      'https://figma-comment-summary.onrender.com',
      'null',
    ];

    // Add ngrok URL only in development
    if (process.env.NODE_ENV === 'development' && process.env.NGROK_URL) {
      allowedOrigins.push(process.env.NGROK_URL);
    }

    if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'ngrok-skip-browser-warning',
  ],
};

app.use(cors(corsOptions));
// Important: do NOT use bare cors() here or it bypasses origin checks for preflights.
app.options('*', cors(corsOptions));

// Basic abuse controls (especially important if this is publicly hosted).
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const oauthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const commentsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/api/oauth', oauthLimiter);
app.use('/api/comments', commentsLimiter);

app.use(express.json({ limit: '100kb' }));

app.use('/api/oauth', initiateRouter);
app.use('/api/oauth', startAuthFlowRouter);
app.use('/api/oauth', callbackRouter);
app.use('/api/oauth', pollStatusRouter);
app.use('/api/comments', commentsRouter);


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
