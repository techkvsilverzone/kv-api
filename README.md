# KV Silver Zone API

A Node.js + Express 5 + TypeScript API over PostgreSQL 17, with a clean architecture.

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file. `.env.example` lists every variable; the essentials are:
   ```bash
   PORT=5000
   NODE_ENV=development
   CORS_ORIGINS=*
   CORS_CREDENTIALS=false

   # Runtime persistence (required — the pool refuses to start without it)
   POSTGRES_URL=postgresql://user:password@host:5432/kvs_ecommerce

   JWT_SECRET=change-me

   # Product images are written here and served by Nginx from IMAGE_PUBLIC_BASE
   IMAGE_STORAGE_ROOT=/opt/kvs/storage/products
   IMAGE_PUBLIC_BASE=/images/products
   ```

`MONGO_URI` and `POSTGRES_MIGRATION_URL` are needed **only** by the one-off
scripts in `src/migration/`; no runtime code reads them.

For CORS in production, set `CORS_ORIGINS` to a comma-separated allowlist (for example: `https://app.example.com,https://admin.example.com`) and set `CORS_CREDENTIALS=true` only when needed.

### Development

Run the application in development mode with hot-reloading:
```bash
npm run dev
```

### API Documentation

The API Documentation is powered by Swagger and is available at:
`http://localhost:3000/api-docs`

### Build

Compile the TypeScript code to JavaScript:
```bash
npm run build
```

### Industry Standards

- **Logging**: Implemented with `winston` and `morgan` for structured console and file logging.
- **Error Handling**: Global exception middleware for consistent error responses and logging.
- **Documentation**: OpenAPI 3.0 (Swagger) for real-time API reference.

## Architecture

The project follows a clean architecture pattern:

- **Controllers**: Handle incoming requests and return responses.
- **Services**: Contain business logic and interact with repositories.
- **Repositories**: Handle data access — hand-written parameterized SQL against PostgreSQL. No ORM.
- **Domain**: Plain TypeScript interfaces describing each aggregate.
- **Routes**: Define API endpoints and link them to controllers.
- **Middlewares**: Process requests before they reach controllers (e.g., authentication, global error handling).
- **Config**: Manage environment variables, swagger definitions, and application configuration.
- **Utils**: Helper functions, logger, and custom error classes.

## API Endpoints

- `GET /api/health`: Check the status of the API.

## Database

PostgreSQL 17, accessed through `pg` with no ORM. The schema is applied on the
server; [docs/14-POSTGRES_SCHEMA.md](docs/14-POSTGRES_SCHEMA.md) is the checked-in
reference and [docs/15-POSTGRES_MIGRATION.md](docs/15-POSTGRES_MIGRATION.md)
describes the MongoDB → PostgreSQL migration.

```bash
npm run migration:verify   # READ-ONLY: run every repository read path against the database
```

### Legacy artifacts (not used at runtime)

- `database/sqlserver/*.sql` — from an earlier SQL Server → MongoDB migration.
  The application has not touched SQL Server for a long time.
- `src/migration/` — MongoDB → PostgreSQL tooling, and the only place Mongoose
  still exists.
