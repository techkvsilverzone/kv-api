# KV Silver Zone API

A Node.js Express TypeScript API with a clean architecture.

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file from the placeholder (optional, default values provided in `src/config/index.ts`):
   ```bash
   PORT=3000
   NODE_ENV=development
   CORS_ORIGINS=*
   CORS_CREDENTIALS=false
   CORS_METHODS=GET,POST,PUT,PATCH,DELETE,OPTIONS
   CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With
   MONGO_URI=mongodb://localhost:27017/kv-silver-zone
   SQL_SERVER_AUTH_TYPE=windows
   SQL_SERVER_HOST=DESKTOP-TOL96KV
   SQL_SERVER_INSTANCE=SQLEXPRESS
   SQL_SERVER_PORT=1433
   SQL_SERVER_DATABASE=KVSilverZone
   SQL_SERVER_USER=
   SQL_SERVER_PASSWORD=
   SQL_SERVER_ENCRYPT=false
   SQL_SERVER_TRUST_CERT=true
   ```

For SQL login instead of Windows auth, set `SQL_SERVER_AUTH_TYPE=sql` and provide `SQL_SERVER_USER` and `SQL_SERVER_PASSWORD`.

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
- **Repositories**: Handle data access and persistence.
- **Models**: Define data structures and interfaces.
- **Routes**: Define API endpoints and link them to controllers.
- **Middlewares**: Process requests before they reach controllers (e.g., authentication, global error handling).
- **Config**: Manage environment variables, swagger definitions, and application configuration.
- **Utils**: Helper functions, logger, and custom error classes.

## API Endpoints

- `GET /api/health`: Check the status of the API.

## SQL Server Scripts (Product Catalog)

Database design and seed scripts for SQL Server are available in:

- [database/sqlserver/README.md](database/sqlserver/README.md)

The `Product` APIs are wired to SQL Server tables (`kv.ProductGroup`, `kv.ProductImage`, `kv.vw_ProductCatalog`).
