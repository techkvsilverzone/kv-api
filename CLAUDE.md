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

**Config:** All env vars centralized in `src/config/index.ts`. SQL Server supports both SQL auth and Windows auth.

**Error handling:** Throw `AppError` from anywhere — `src/middlewares/error.middleware.ts` catches globally.

**Swagger:** JSDoc annotations in route files → available at `http://localhost:5000/api-docs`.

## Database

- MongoDB Atlas — connection string via `MONGO_URI` env var
- Default local fallback: `mongodb://localhost:27017/kv-silver-zone`

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
