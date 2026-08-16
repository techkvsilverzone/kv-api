import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Whether client-facing error responses carry a stack trace. Requires NODE_ENV
  // to be EXPLICITLY 'development' — note this deliberately does not reuse the
  // `nodeEnv` default above, so a prod box that forgot to set the var fails
  // closed (no stack) rather than leaking internals.
  exposeErrorStack: process.env.NODE_ENV === 'development',
  // Public storefront URL, used to build order links in transactional emails.
  frontendUrl: process.env.FRONTEND_URL || '',
  corsOrigins: process.env.CORS_ORIGINS || '*',
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',
  corsMethods: process.env.CORS_METHODS || 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  corsAllowedHeaders:
    process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,X-Requested-With',
  // Runtime persistence. `MONGO_URI` is retained ONLY for the one-off scripts in
  // src/migration/ — no runtime code path reads it any more.
  mongoUri: process.env.MONGO_URI, //|| 'mongodb://localhost:27017/kv-silver-zone',
  postgres: {
    // Runtime connection string. Deliberately separate from
    // POSTGRES_MIGRATION_URL, which belongs to the migration scripts.
    url: process.env.POSTGRES_URL || '',
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 10_000),
    statementTimeoutMillis: Number(process.env.POSTGRES_STATEMENT_TIMEOUT_MS || 30_000),
    ssl: process.env.POSTGRES_SSL === 'true',
  },
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  // Cookie-based auth (httpOnly JWT). For cross-site cookies set
  // COOKIE_SAMESITE=none and COOKIE_SECURE=true (HTTPS required by browsers).
  authCookieName: process.env.AUTH_COOKIE_NAME || 'token',
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',
  cookieSameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieMaxAgeDays: Number(process.env.COOKIE_MAX_AGE_DAYS || 30),
  // Product images live on disk and are served by Nginx, never streamed out of
  // the database (spec §13). `imageStorageRoot` is where this process writes
  // them; `imagePublicBase` is the URL prefix Nginx maps onto that directory.
  imageStorageRoot: process.env.IMAGE_STORAGE_ROOT || '/opt/kvs/storage/products',
  imagePublicBase: process.env.IMAGE_PUBLIC_BASE || '/images/products',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  brevoSmtpUser: process.env.BREVO_SMTP_USER || '',
  brevoSmtpPassword: process.env.BREVO_SMTP_PASSWORD || '',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'KV Silver Zone',
  // Daily price-update guard (#25). The metal rate becomes mandatory at this
  // hour (IST). Before it, nothing is blocked (morning grace period).
  rateUpdateCutoffHour: Number(process.env.RATE_UPDATE_CUTOFF_HOUR || 10),
  // WhatsApp rate-reminder (Meta WhatsApp Cloud API). Best-effort, like email.
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'meta',
  whatsappToken: process.env.WHATSAPP_TOKEN || '',
  whatsappPhoneId: process.env.WHATSAPP_PHONE_ID || '',
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  rateAlertRecipient: process.env.RATE_ALERT_RECIPIENT || '+918825649680',
  // OTP login: email delivery (via Brevo, above) always works. WhatsApp delivery
  // additionally requires an approved Meta "Authentication" template outside the
  // 24h customer-care window — flip this on once that approval lands; until then
  // it stays off and OTP login works via email only.
  whatsappOtpEnabled: process.env.WHATSAPP_OTP_ENABLED === 'true',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  // Returns policy: KV-fault claims require an unboxing video sent to this
  // WhatsApp number (shown to the customer after they file a fault-based return),
  // received via the inbound webhook below and matched to the return by
  // reference code / sender phone. Claim window is measured from Order.deliveredAt.
  // Falls back to the existing rate-alert number if unset — set
  // RETURN_VIDEO_WHATSAPP_NUMBER explicitly once there's a dedicated
  // customer-facing WhatsApp Business number.
  returnVideoWhatsappNumber:
    process.env.RETURN_VIDEO_WHATSAPP_NUMBER || process.env.RATE_ALERT_RECIPIENT || '+918825649680',
  returnClaimWindowHours: Number(process.env.RETURN_CLAIM_WINDOW_HOURS || 48),
  returnVideoStorageDir: process.env.RETURN_VIDEO_STORAGE_DIR || '',
  // Meta WhatsApp Cloud API inbound webhook (receives the unboxing videos above).
  whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  // App secret used to verify the X-Hub-Signature-256 header on inbound webhook
  // calls — without this, anyone who finds the webhook URL could POST a fake
  // "video received" event. Strongly recommended in production.
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || '',
};
