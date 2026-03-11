SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
  This script adds domain tables for non-product endpoints:
  - Auth/Users
  - Cart
  - Orders + shipping + line items
  - Savings enrollments
  - Contact enquiries
*/

IF OBJECT_ID('kv.[User]', 'U') IS NULL
BEGIN
    CREATE TABLE kv.[User] (
        UserId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_User PRIMARY KEY
            CONSTRAINT DF_User_UserId DEFAULT NEWSEQUENTIALID(),
        Email NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(255) NULL,
        FullName NVARCHAR(150) NOT NULL,
        Phone NVARCHAR(30) NULL,
        AddressLine NVARCHAR(300) NULL,
        City NVARCHAR(100) NULL,
        [State] NVARCHAR(100) NULL,
        Pincode NVARCHAR(20) NULL,
        IsAdmin BIT NOT NULL
            CONSTRAINT DF_User_IsAdmin DEFAULT (0),
        IsActive BIT NOT NULL
            CONSTRAINT DF_User_IsActive DEFAULT (1),
        LastLoginAt DATETIME2(3) NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_User_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_User_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_User_Email UNIQUE (Email)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_User_Email_Active'
      AND object_id = OBJECT_ID('kv.[User]')
)
BEGIN
    CREATE INDEX IX_User_Email_Active
        ON kv.[User](Email, IsActive);
END;
GO

IF OBJECT_ID('kv.Cart', 'U') IS NULL
BEGIN
    CREATE TABLE kv.Cart (
        CartId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Cart PRIMARY KEY
            CONSTRAINT DF_Cart_CartId DEFAULT NEWSEQUENTIALID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_Cart_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_Cart_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Cart_User FOREIGN KEY (UserId)
            REFERENCES kv.[User](UserId)
            ON DELETE CASCADE,
        CONSTRAINT UQ_Cart_User UNIQUE (UserId)
    );
END;
GO

IF OBJECT_ID('kv.CartItem', 'U') IS NULL
BEGIN
    CREATE TABLE kv.CartItem (
        CartItemId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_CartItem PRIMARY KEY
            CONSTRAINT DF_CartItem_CartItemId DEFAULT NEWSEQUENTIALID(),
        CartId UNIQUEIDENTIFIER NOT NULL,
        ImageId INT NOT NULL,
        Quantity INT NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_CartItem_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_CartItem_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_CartItem_Cart FOREIGN KEY (CartId)
            REFERENCES kv.Cart(CartId)
            ON DELETE CASCADE,
        CONSTRAINT FK_CartItem_ProductImage FOREIGN KEY (ImageId)
            REFERENCES kv.ProductImage(ImageId),
        CONSTRAINT UQ_CartItem_Cart_Image UNIQUE (CartId, ImageId),
        CONSTRAINT CK_CartItem_Quantity CHECK (Quantity > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_CartItem_CartId'
      AND object_id = OBJECT_ID('kv.CartItem')
)
BEGIN
    CREATE INDEX IX_CartItem_CartId
        ON kv.CartItem(CartId);
END;
GO

IF OBJECT_ID('kv.[Order]', 'U') IS NULL
BEGIN
    CREATE TABLE kv.[Order] (
        OrderId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Order PRIMARY KEY
            CONSTRAINT DF_Order_OrderId DEFAULT NEWSEQUENTIALID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        TotalAmount DECIMAL(12,2) NOT NULL,
        TaxAmount DECIMAL(12,2) NOT NULL,
        [Status] VARCHAR(20) NOT NULL
            CONSTRAINT DF_Order_Status DEFAULT ('Pending'),
        PaymentMethod VARCHAR(20) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_Order_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_Order_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Order_User FOREIGN KEY (UserId)
            REFERENCES kv.[User](UserId),
        CONSTRAINT CK_Order_Status CHECK ([Status] IN ('Pending', 'Shipped', 'Delivered', 'Cancelled')),
        CONSTRAINT CK_Order_PaymentMethod CHECK (PaymentMethod IN ('card', 'upi', 'netbanking', 'cod')),
        CONSTRAINT CK_Order_TotalAmount CHECK (TotalAmount >= 0),
        CONSTRAINT CK_Order_TaxAmount CHECK (TaxAmount >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Order_UserId_CreatedAt'
      AND object_id = OBJECT_ID('kv.[Order]')
)
BEGIN
    CREATE INDEX IX_Order_UserId_CreatedAt
        ON kv.[Order](UserId, CreatedAt DESC);
END;
GO

IF OBJECT_ID('kv.OrderShippingAddress', 'U') IS NULL
BEGIN
    CREATE TABLE kv.OrderShippingAddress (
        OrderId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_OrderShippingAddress PRIMARY KEY,
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        AddressLine NVARCHAR(300) NOT NULL,
        City NVARCHAR(100) NOT NULL,
        [State] NVARCHAR(100) NOT NULL,
        Pincode NVARCHAR(20) NOT NULL,
        Phone NVARCHAR(30) NOT NULL,
        CONSTRAINT FK_OrderShippingAddress_Order FOREIGN KEY (OrderId)
            REFERENCES kv.[Order](OrderId)
            ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID('kv.OrderItem', 'U') IS NULL
BEGIN
    CREATE TABLE kv.OrderItem (
        OrderItemId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_OrderItem PRIMARY KEY
            CONSTRAINT DF_OrderItem_OrderItemId DEFAULT NEWSEQUENTIALID(),
        OrderId UNIQUEIDENTIFIER NOT NULL,
        ImageId INT NULL,
        ProductName NVARCHAR(200) NOT NULL,
        UnitPrice DECIMAL(12,2) NOT NULL,
        Quantity INT NOT NULL,
        ImageUrl NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_OrderItem_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_OrderItem_Order FOREIGN KEY (OrderId)
            REFERENCES kv.[Order](OrderId)
            ON DELETE CASCADE,
        CONSTRAINT FK_OrderItem_ProductImage FOREIGN KEY (ImageId)
            REFERENCES kv.ProductImage(ImageId),
        CONSTRAINT CK_OrderItem_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT CK_OrderItem_Quantity CHECK (Quantity > 0)
    );
END;
GO

IF COL_LENGTH('kv.OrderItem', 'ImageUrl') IS NOT NULL AND COL_LENGTH('kv.OrderItem', 'ImageUrl') <> -1
BEGIN
    ALTER TABLE kv.OrderItem
    ALTER COLUMN ImageUrl NVARCHAR(MAX) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_OrderItem_OrderId'
      AND object_id = OBJECT_ID('kv.OrderItem')
)
BEGIN
    CREATE INDEX IX_OrderItem_OrderId
        ON kv.OrderItem(OrderId);
END;
GO

IF OBJECT_ID('kv.SavingsEnrollment', 'U') IS NULL
BEGIN
    CREATE TABLE kv.SavingsEnrollment (
        SavingsEnrollmentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_SavingsEnrollment PRIMARY KEY
            CONSTRAINT DF_SavingsEnrollment_Id DEFAULT NEWSEQUENTIALID(),
        UserId UNIQUEIDENTIFIER NOT NULL,
        MonthlyAmount DECIMAL(12,2) NOT NULL,
        DurationMonths INT NOT NULL,
        StartDate DATE NOT NULL
            CONSTRAINT DF_SavingsEnrollment_StartDate DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        [Status] VARCHAR(20) NOT NULL
            CONSTRAINT DF_SavingsEnrollment_Status DEFAULT ('Active'),
        TotalPaid DECIMAL(12,2) NOT NULL
            CONSTRAINT DF_SavingsEnrollment_TotalPaid DEFAULT (0),
        BonusAmount DECIMAL(12,2) NOT NULL
            CONSTRAINT DF_SavingsEnrollment_BonusAmount DEFAULT (0),
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_SavingsEnrollment_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_SavingsEnrollment_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_SavingsEnrollment_User FOREIGN KEY (UserId)
            REFERENCES kv.[User](UserId),
        CONSTRAINT CK_SavingsEnrollment_Duration CHECK (DurationMonths > 0),
        CONSTRAINT CK_SavingsEnrollment_Amount CHECK (MonthlyAmount > 0),
        CONSTRAINT CK_SavingsEnrollment_Status CHECK ([Status] IN ('Active', 'Completed', 'Defaulted')),
        CONSTRAINT CK_SavingsEnrollment_TotalPaid CHECK (TotalPaid >= 0),
        CONSTRAINT CK_SavingsEnrollment_BonusAmount CHECK (BonusAmount >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_SavingsEnrollment_UserId_CreatedAt'
      AND object_id = OBJECT_ID('kv.SavingsEnrollment')
)
BEGIN
    CREATE INDEX IX_SavingsEnrollment_UserId_CreatedAt
        ON kv.SavingsEnrollment(UserId, CreatedAt DESC);
END;
GO

IF OBJECT_ID('kv.ContactEnquiry', 'U') IS NULL
BEGIN
    CREATE TABLE kv.ContactEnquiry (
        ContactEnquiryId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_ContactEnquiry PRIMARY KEY
            CONSTRAINT DF_ContactEnquiry_Id DEFAULT NEWSEQUENTIALID(),
        FullName NVARCHAR(150) NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        Subject NVARCHAR(200) NOT NULL,
        MessageBody NVARCHAR(MAX) NOT NULL,
        IsResolved BIT NOT NULL
            CONSTRAINT DF_ContactEnquiry_IsResolved DEFAULT (0),
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ContactEnquiry_CreatedAt DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID('kv.vw_AdminStats', 'V') IS NOT NULL
BEGIN
    DROP VIEW kv.vw_AdminStats;
END;
GO

CREATE VIEW kv.vw_AdminStats
AS
SELECT
    CAST(ISNULL((SELECT SUM(TotalAmount) FROM kv.[Order]), 0) AS DECIMAL(12,2)) AS TotalRevenue,
    ISNULL((SELECT COUNT(1) FROM kv.[Order]), 0) AS TotalOrders,
    ISNULL((SELECT COUNT(1) FROM kv.ProductImage), 0) AS TotalProducts,
    ISNULL((SELECT COUNT(1) FROM kv.[User] WHERE IsActive = 1), 0) AS TotalUsers;
GO
