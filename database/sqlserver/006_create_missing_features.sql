SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/*
  Migration 006 — Missing feature tables & Order table extensions:
    - Alter kv.[Order]: add RazorpayPaymentId, CouponCode, CouponDiscount columns
                        update Status and PaymentMethod constraints
    - kv.ProductReview
    - kv.Coupon
    - kv.Wishlist / kv.WishlistItem
    - kv.SilverRate
    - kv.ReturnRequest / kv.ReturnItem
    - kv.SavingsPayment
*/

-- ─────────────────────────────────────────────────────────────────
-- 1. Extend kv.[Order]
-- ─────────────────────────────────────────────────────────────────

IF COL_LENGTH('kv.[Order]', 'RazorpayPaymentId') IS NULL
BEGIN
    ALTER TABLE kv.[Order]
    ADD RazorpayPaymentId NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH('kv.[Order]', 'CouponCode') IS NULL
BEGIN
    ALTER TABLE kv.[Order]
    ADD CouponCode NVARCHAR(50) NULL;
END;
GO

IF COL_LENGTH('kv.[Order]', 'CouponDiscount') IS NULL
BEGIN
    ALTER TABLE kv.[Order]
    ADD CouponDiscount DECIMAL(12,2) NOT NULL
        CONSTRAINT DF_Order_CouponDiscount DEFAULT (0);
END;
GO

-- Update Status constraint to include 'Processing'
IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_Order_Status'
      AND parent_object_id = OBJECT_ID('kv.[Order]')
)
BEGIN
    ALTER TABLE kv.[Order] DROP CONSTRAINT CK_Order_Status;
END;
GO

ALTER TABLE kv.[Order]
ADD CONSTRAINT CK_Order_Status
    CHECK ([Status] IN ('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'));
GO

-- Update PaymentMethod constraint to include 'razorpay'
IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_Order_PaymentMethod'
      AND parent_object_id = OBJECT_ID('kv.[Order]')
)
BEGIN
    ALTER TABLE kv.[Order] DROP CONSTRAINT CK_Order_PaymentMethod;
END;
GO

ALTER TABLE kv.[Order]
ADD CONSTRAINT CK_Order_PaymentMethod
    CHECK (PaymentMethod IN ('card', 'upi', 'netbanking', 'cod', 'razorpay'));
GO

-- ─────────────────────────────────────────────────────────────────
-- 2. Product Reviews
-- ─────────────────────────────────────────────────────────────────

IF OBJECT_ID('kv.ProductReview', 'U') IS NULL
BEGIN
    CREATE TABLE kv.ProductReview (
        ReviewId    UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_ProductReview PRIMARY KEY
            CONSTRAINT DF_ProductReview_ReviewId DEFAULT NEWSEQUENTIALID(),
        ImageId     INT NOT NULL,
        UserId      UNIQUEIDENTIFIER NOT NULL,
        Rating      TINYINT NOT NULL,
        Title       NVARCHAR(200) NOT NULL,
        Comment     NVARCHAR(MAX) NOT NULL,
        CreatedAt   DATETIME2(3) NOT NULL
            CONSTRAINT DF_ProductReview_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ProductReview_User FOREIGN KEY (UserId)
            REFERENCES kv.[User](UserId),
        CONSTRAINT FK_ProductReview_ProductImage FOREIGN KEY (ImageId)
            REFERENCES kv.ProductImage(ImageId)
            ON DELETE CASCADE,
        CONSTRAINT CK_ProductReview_Rating CHECK (Rating BETWEEN 1 AND 5),
        CONSTRAINT UQ_ProductReview_User_Image UNIQUE (UserId, ImageId)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ProductReview_ImageId'
      AND object_id = OBJECT_ID('kv.ProductReview')
)
BEGIN
    CREATE INDEX IX_ProductReview_ImageId ON kv.ProductReview(ImageId);
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- 3. Coupons
-- ─────────────────────────────────────────────────────────────────

IF OBJECT_ID('kv.Coupon', 'U') IS NULL
BEGIN
    CREATE TABLE kv.Coupon (
        CouponId        UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Coupon PRIMARY KEY
            CONSTRAINT DF_Coupon_CouponId DEFAULT NEWSEQUENTIALID(),
        Code            NVARCHAR(50) NOT NULL,
        Description     NVARCHAR(300) NOT NULL,
        DiscountType    VARCHAR(15) NOT NULL,
        DiscountValue   DECIMAL(12,2) NOT NULL,
        MinOrderAmount  DECIMAL(12,2) NOT NULL
            CONSTRAINT DF_Coupon_MinOrderAmount DEFAULT (0),
        MaxDiscount     DECIMAL(12,2) NULL,
        ValidFrom       DATE NOT NULL,
        ValidTo         DATE NOT NULL,
        UsageLimit      INT NOT NULL
            CONSTRAINT DF_Coupon_UsageLimit DEFAULT (0),
        UsedCount       INT NOT NULL
            CONSTRAINT DF_Coupon_UsedCount DEFAULT (0),
        IsActive        BIT NOT NULL
            CONSTRAINT DF_Coupon_IsActive DEFAULT (1),
        CreatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_Coupon_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_Coupon_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Coupon_Code UNIQUE (Code),
        CONSTRAINT CK_Coupon_DiscountType CHECK (DiscountType IN ('percentage', 'fixed')),
        CONSTRAINT CK_Coupon_DiscountValue CHECK (DiscountValue > 0),
        CONSTRAINT CK_Coupon_MinOrderAmount CHECK (MinOrderAmount >= 0),
        CONSTRAINT CK_Coupon_UsedCount CHECK (UsedCount >= 0)
    );
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- 4. Wishlist
-- ─────────────────────────────────────────────────────────────────

IF OBJECT_ID('kv.Wishlist', 'U') IS NULL
BEGIN
    CREATE TABLE kv.Wishlist (
        WishlistId  UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_Wishlist PRIMARY KEY
            CONSTRAINT DF_Wishlist_WishlistId DEFAULT NEWSEQUENTIALID(),
        UserId      UNIQUEIDENTIFIER NOT NULL,
        CreatedAt   DATETIME2(3) NOT NULL
            CONSTRAINT DF_Wishlist_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2(3) NOT NULL
            CONSTRAINT DF_Wishlist_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Wishlist_User FOREIGN KEY (UserId)
            REFERENCES kv.[User](UserId)
            ON DELETE CASCADE,
        CONSTRAINT UQ_Wishlist_User UNIQUE (UserId)
    );
END;
GO

IF OBJECT_ID('kv.WishlistItem', 'U') IS NULL
BEGIN
    CREATE TABLE kv.WishlistItem (
        WishlistItemId  UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_WishlistItem PRIMARY KEY
            CONSTRAINT DF_WishlistItem_WishlistItemId DEFAULT NEWSEQUENTIALID(),
        WishlistId      UNIQUEIDENTIFIER NOT NULL,
        ImageId         INT NOT NULL,
        CreatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_WishlistItem_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_WishlistItem_Wishlist FOREIGN KEY (WishlistId)
            REFERENCES kv.Wishlist(WishlistId)
            ON DELETE CASCADE,
        CONSTRAINT FK_WishlistItem_ProductImage FOREIGN KEY (ImageId)
            REFERENCES kv.ProductImage(ImageId),
        CONSTRAINT UQ_WishlistItem_Wishlist_Image UNIQUE (WishlistId, ImageId)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_WishlistItem_WishlistId'
      AND object_id = OBJECT_ID('kv.WishlistItem')
)
BEGIN
    CREATE INDEX IX_WishlistItem_WishlistId ON kv.WishlistItem(WishlistId);
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- 5. Silver Rates
-- ─────────────────────────────────────────────────────────────────

IF OBJECT_ID('kv.SilverRate', 'U') IS NULL
BEGIN
    CREATE TABLE kv.SilverRate (
        SilverRateId    UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_SilverRate PRIMARY KEY
            CONSTRAINT DF_SilverRate_SilverRateId DEFAULT NEWSEQUENTIALID(),
        RateDate        DATE NOT NULL,
        RatePerGram     DECIMAL(12,4) NOT NULL,
        RatePerKg       DECIMAL(15,2) NOT NULL,
        Purity          VARCHAR(10) NOT NULL,
        UpdatedBy       NVARCHAR(150) NULL,
        CreatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_SilverRate_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_SilverRate_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_SilverRate_Date_Purity UNIQUE (RateDate, Purity),
        CONSTRAINT CK_SilverRate_Purity CHECK (Purity IN ('999', '925', '916')),
        CONSTRAINT CK_SilverRate_RatePerGram CHECK (RatePerGram > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_SilverRate_RateDate'
      AND object_id = OBJECT_ID('kv.SilverRate')
)
BEGIN
    CREATE INDEX IX_SilverRate_RateDate ON kv.SilverRate(RateDate DESC);
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- 6. Returns & Refunds
-- ─────────────────────────────────────────────────────────────────

IF OBJECT_ID('kv.ReturnRequest', 'U') IS NULL
BEGIN
    CREATE TABLE kv.ReturnRequest (
        ReturnRequestId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_ReturnRequest PRIMARY KEY
            CONSTRAINT DF_ReturnRequest_ReturnRequestId DEFAULT NEWSEQUENTIALID(),
        OrderId         UNIQUEIDENTIFIER NOT NULL,
        UserId          UNIQUEIDENTIFIER NOT NULL,
        Reason          NVARCHAR(100) NOT NULL,
        Description     NVARCHAR(MAX) NOT NULL,
        [Status]        VARCHAR(20) NOT NULL
            CONSTRAINT DF_ReturnRequest_Status DEFAULT ('Pending'),
        RefundAmount    DECIMAL(12,2) NOT NULL
            CONSTRAINT DF_ReturnRequest_RefundAmount DEFAULT (0),
        CreatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_ReturnRequest_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2(3) NOT NULL
            CONSTRAINT DF_ReturnRequest_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ReturnRequest_Order FOREIGN KEY (OrderId)
            REFERENCES kv.[Order](OrderId),
        CONSTRAINT FK_ReturnRequest_User FOREIGN KEY (UserId)
            REFERENCES kv.[User](UserId),
        CONSTRAINT CK_ReturnRequest_Status
            CHECK ([Status] IN ('Pending', 'Approved', 'Rejected', 'Completed'))
    );
END;
GO

IF OBJECT_ID('kv.ReturnItem', 'U') IS NULL
BEGIN
    CREATE TABLE kv.ReturnItem (
        ReturnItemId    UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_ReturnItem PRIMARY KEY
            CONSTRAINT DF_ReturnItem_ReturnItemId DEFAULT NEWSEQUENTIALID(),
        ReturnRequestId UNIQUEIDENTIFIER NOT NULL,
        ImageId         INT NULL,
        ProductName     NVARCHAR(200) NOT NULL,
        Quantity        INT NOT NULL,
        Price           DECIMAL(12,2) NOT NULL,
        CONSTRAINT FK_ReturnItem_ReturnRequest FOREIGN KEY (ReturnRequestId)
            REFERENCES kv.ReturnRequest(ReturnRequestId)
            ON DELETE CASCADE,
        CONSTRAINT FK_ReturnItem_ProductImage FOREIGN KEY (ImageId)
            REFERENCES kv.ProductImage(ImageId),
        CONSTRAINT CK_ReturnItem_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_ReturnItem_Price CHECK (Price >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ReturnRequest_UserId'
      AND object_id = OBJECT_ID('kv.ReturnRequest')
)
BEGIN
    CREATE INDEX IX_ReturnRequest_UserId ON kv.ReturnRequest(UserId, CreatedAt DESC);
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- 7. Savings Payments
-- ─────────────────────────────────────────────────────────────────

IF OBJECT_ID('kv.SavingsPayment', 'U') IS NULL
BEGIN
    CREATE TABLE kv.SavingsPayment (
        SavingsPaymentId        UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_SavingsPayment PRIMARY KEY
            CONSTRAINT DF_SavingsPayment_SavingsPaymentId DEFAULT NEWSEQUENTIALID(),
        SavingsEnrollmentId     UNIQUEIDENTIFIER NOT NULL,
        Amount                  DECIMAL(12,2) NOT NULL,
        PaidDate                DATE NOT NULL
            CONSTRAINT DF_SavingsPayment_PaidDate DEFAULT CAST(SYSUTCDATETIME() AS DATE),
        MonthNumber             INT NOT NULL,
        [Status]                VARCHAR(20) NOT NULL
            CONSTRAINT DF_SavingsPayment_Status DEFAULT ('Paid'),
        CreatedAt               DATETIME2(3) NOT NULL
            CONSTRAINT DF_SavingsPayment_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_SavingsPayment_Enrollment FOREIGN KEY (SavingsEnrollmentId)
            REFERENCES kv.SavingsEnrollment(SavingsEnrollmentId)
            ON DELETE CASCADE,
        CONSTRAINT CK_SavingsPayment_Amount CHECK (Amount > 0),
        CONSTRAINT CK_SavingsPayment_Month CHECK (MonthNumber BETWEEN 1 AND 12),
        CONSTRAINT CK_SavingsPayment_Status CHECK ([Status] IN ('Paid', 'Pending', 'Overdue'))
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_SavingsPayment_EnrollmentId'
      AND object_id = OBJECT_ID('kv.SavingsPayment')
)
BEGIN
    CREATE INDEX IX_SavingsPayment_EnrollmentId
        ON kv.SavingsPayment(SavingsEnrollmentId);
END;
GO
