import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS || '*',
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',
  corsMethods: process.env.CORS_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  corsAllowedHeaders:
    process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/kv-silver-zone',
  sqlServerAuthType: process.env.SQL_SERVER_AUTH_TYPE || 'sql',
  sqlServerHost: process.env.SQL_SERVER_HOST || 'localhost',
  sqlServerInstance: process.env.SQL_SERVER_INSTANCE || '',
  sqlServerPort: Number(process.env.SQL_SERVER_PORT || 1433),
  sqlServerDatabase: process.env.SQL_SERVER_DATABASE || 'kv_silver_zone',
  sqlServerUser: process.env.SQL_SERVER_USER || 'sa',
  sqlServerPassword: process.env.SQL_SERVER_PASSWORD || 'YourStrong!Passw0rd',
  sqlServerEncrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
  sqlServerTrustServerCertificate: process.env.SQL_SERVER_TRUST_CERT !== 'false',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
};
