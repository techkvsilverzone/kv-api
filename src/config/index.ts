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
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  brevoSmtpUser: process.env.BREVO_SMTP_USER || '',
  brevoSmtpPassword: process.env.BREVO_SMTP_PASSWORD || '',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'KV Silver Zone',
};
