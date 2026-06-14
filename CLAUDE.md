# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.

---

## Commands

```bash
npm run dev          # ts-node-dev with hot reload
npm run build        # rimraf dist && tsc
npm start            # node dist/server.js
npm test             # jest --runInBand (must be serial)
npm run test:watch
npm run seed         # ts-node src/seed.ts — seeds admin user + product images

# Run a single test file
npx jest src/tests/admin-orders.api.test.ts --runInBand
```

## Architecture

**Stack:** Node.js + Express 5 + TypeScript + MongoDB Atlas (Mongoose)

**Request flow:** `Route → Controller → Service → Repository → MongoDB`

- `src/routes/index.ts` — aggregates all route modules, mounted at `/api/v1`
- `src/controllers/` — parse req, call service, send res
- `src/services/` — business logic, orchestrates repository calls
- `src/repositories/` — all data access via Mongoose models
- `src/utils/db.ts` — MongoDB connection (`connectMongo` / `disconnectMongo`)
- `src/models/` — Mongoose schemas + TypeScript interfaces

**Auth:** `src/middlewares/auth.middleware.ts` exports `protect` (JWT required) and `admin` (role check). Guards extend `express.Request` as `AuthRequest`.

**Config:** All env vars centralized in `src/config/index.ts` — every value is read from `process.env` here and nowhere else. Import `config` rather than touching `process.env` directly.

**Error handling:** Throw `AppError` from anywhere — `src/middlewares/error.middleware.ts` catches globally.

**Swagger:** JSDoc annotations in route files → available at `http://localhost:5000/api-docs`.

**Payments:** Razorpay integration has no `razorpay` SDK dependency — order creation and signature verification in `src/services/payment.service.ts` use Node's native `crypto` (HMAC-SHA256) directly.

**Email:** Transactional email goes through Brevo SMTP via Nodemailer. `src/utils/email.ts` is the low-level sender; `src/utils/emailNotifications.ts` holds the templated senders (order created, payment completed, contact-us, new-product promo). These are best-effort — failures are logged, not thrown.

## Database

- **MongoDB Atlas only** (Mongoose). Connection string via `MONGO_URI`; no fallback — `config.mongoUri` is undefined if unset.
- **Legacy migration artifacts, not used at runtime:** `database/sqlserver/*.sql`, `src/utils/sql.ts`, and `src/utils/migrateSqlToMongo.ts` are leftovers from a one-time SQL Server → MongoDB migration. The live app never touches SQL Server. Ignore these unless explicitly working on migration tooling.

## Testing

Tests in `src/tests/` use `jest` + `supertest`, mocking at the repository layer (no real DB needed). Always use `--runInBand` to prevent parallel test interference.

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Token signing |
| `CORS_ORIGINS` | Comma-separated origins (`*` for all) |
| `PORT` | Default 5000 |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay payments |
| `BREVO_SMTP_USER` / `BREVO_SMTP_PASSWORD` / `BREVO_SENDER_EMAIL` | Nodemailer via Brevo SMTP |
