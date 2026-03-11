- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Add Swagger, Logger, and Global Exception Handler
- [x] Implement KV Silver Zone API with MongoDB
- [x] Implement RBAC and Admin Seeding
- [x] Ensure Documentation is Complete

## Project Summary
This is a Node.js Express TypeScript API for KV Silver Zone, initialized with a clean architecture.
- **Database**: MongoDB (Mongoose)
- **Auth**: JWT with Bcrypt password hashing
- **Role-Based Access (RBAC)**: Admin-only routes for product/order management.
- **Default Admin**: `admin@kvsilverzone.com` / `Admin@123` (Auto-seeded)
- **Controllers**: [src/controllers](src/controllers)
- **Services**: [src/services](src/services)
- **Repositories**: [src/repositories](src/repositories)
- **Models**: [src/models](src/models) - Includes User, Product, Order, SavingsEnrollment, and Cart.
- **Routes**: [src/routes](src/routes) - Base path `/api/v1`.
- **Swagger Documentation**: http://localhost:5000/api-docs
- **Logging**: Powered by Winston and Morgan
- **Error Handling**: Centralized global exception handler.

The project is running on http://localhost:5000.
