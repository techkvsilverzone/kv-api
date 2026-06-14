import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorMiddleware } from './middlewares/error.middleware';
import Logger from './utils/logger';
import { specs } from './config/swagger';
import { config } from './config';

const app: Application = express();

const configuredOrigins = config.corsOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = configuredOrigins.includes('*');

const corsOptions: cors.CorsOptions = {
  // `origin: true` reflects the request origin (never literal '*'), which lets
  // the browser accept credentialed (cookie) requests even in allow-all mode.
  origin: allowAllOrigins ? true : configuredOrigins,
  methods: config.corsMethods.split(',').map((method) => method.trim()),
  allowedHeaders: config.corsAllowedHeaders.split(',').map((header) => header.trim()),
  // Required for the httpOnly auth cookie to be sent/accepted cross-origin.
  credentials: true,
  optionsSuccessStatus: 204,
};

// Middlewares
app.use(cors(corsOptions));
// Products store images as base64 strings, which easily exceed the default 100kb
// body limit. Raise it so admin product create/update with embedded images succeeds.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (message) => Logger.http(message.trim()) },
  })
);

// Swagger Documentation
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  })
);

app.get('/', (_req: Request, res: Response) => {
  res.send('API is running 🚀');
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/v1', routes);

// Error Handling Middleware
app.use(errorMiddleware);

export default app;
