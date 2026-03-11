SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'kv')
BEGIN
    EXEC('CREATE SCHEMA kv');
END;
GO

IF OBJECT_ID('kv.CatalogConfig', 'U') IS NULL
BEGIN
    CREATE TABLE kv.CatalogConfig (
        CatalogConfigId TINYINT NOT NULL
            CONSTRAINT PK_CatalogConfig PRIMARY KEY,
        CurrencyCode CHAR(3) NOT NULL,
        InventoryType VARCHAR(30) NOT NULL,
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_CatalogConfig_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_CatalogConfig_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_CatalogConfig_SingleRow CHECK (CatalogConfigId = 1),
        CONSTRAINT CK_CatalogConfig_Currency CHECK (CurrencyCode IN ('INR', 'USD', 'EUR', 'GBP')),
        CONSTRAINT CK_CatalogConfig_InventoryType CHECK (InventoryType IN ('image_based', 'sku_based'))
    );
END;
GO

IF OBJECT_ID('kv.ProductGroup', 'U') IS NULL
BEGIN
    CREATE TABLE kv.ProductGroup (
        ProductGroupId INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ProductGroup PRIMARY KEY,
        ProductGroupCode VARCHAR(30) NOT NULL,
        ItemName NVARCHAR(150) NOT NULL,
        Quantity INT NOT NULL,
        WeightGm DECIMAL(10,2) NULL,
        Material NVARCHAR(100) NOT NULL,
        UnitPriceInr DECIMAL(12,2) NOT NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ProductGroup_IsActive DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ProductGroup_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ProductGroup_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ProductGroup_Code UNIQUE (ProductGroupCode),
        CONSTRAINT CK_ProductGroup_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_ProductGroup_WeightGm CHECK (WeightGm IS NULL OR WeightGm > 0),
        CONSTRAINT CK_ProductGroup_UnitPriceInr CHECK (UnitPriceInr >= 0)
    );
END;
GO

IF OBJECT_ID('kv.ProductImage', 'U') IS NULL
BEGIN
    CREATE TABLE kv.ProductImage (
        ImageId INT NOT NULL
            CONSTRAINT PK_ProductImage PRIMARY KEY,
        ProductGroupId INT NOT NULL,
        VariantName NVARCHAR(150) NOT NULL,
        ImageBase64 NVARCHAR(MAX) NULL,
        SortOrder INT NOT NULL
            CONSTRAINT DF_ProductImage_SortOrder DEFAULT (1),
        CreatedAt DATETIME2(3) NOT NULL
            CONSTRAINT DF_ProductImage_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ProductImage_ProductGroup FOREIGN KEY (ProductGroupId)
            REFERENCES kv.ProductGroup(ProductGroupId)
            ON DELETE CASCADE,
        CONSTRAINT UQ_ProductImage_GroupVariant UNIQUE (ProductGroupId, VariantName),
        CONSTRAINT CK_ProductImage_SortOrder CHECK (SortOrder > 0)
    );
END;
GO

IF COL_LENGTH('kv.ProductImage', 'ImageBase64') IS NULL
BEGIN
    ALTER TABLE kv.ProductImage
    ADD ImageBase64 NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('kv.ProductImage', 'ImageUrl') IS NOT NULL
BEGIN
    UPDATE kv.ProductImage
    SET ImageBase64 = ImageUrl
    WHERE ImageBase64 IS NULL
      AND ImageUrl IS NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ProductImage_ProductGroupId'
      AND object_id = OBJECT_ID('kv.ProductImage')
)
BEGIN
    CREATE INDEX IX_ProductImage_ProductGroupId
        ON kv.ProductImage(ProductGroupId);
END;
GO

CREATE OR ALTER VIEW kv.vw_ProductCatalog
AS
SELECT
    cfg.CurrencyCode,
    cfg.InventoryType,
    pg.ProductGroupId,
    pg.ProductGroupCode,
    pg.ItemName,
    pg.Quantity,
    pg.WeightGm,
    pg.Material,
    pg.UnitPriceInr,
    pi.ImageId,
    pi.VariantName,
    pi.ImageBase64,
    pi.SortOrder
FROM kv.ProductGroup AS pg
INNER JOIN kv.ProductImage AS pi
    ON pi.ProductGroupId = pg.ProductGroupId
LEFT JOIN kv.CatalogConfig AS cfg
    ON cfg.CatalogConfigId = 1
WHERE pg.IsActive = 1;
GO

CREATE OR ALTER PROCEDURE kv.usp_GetCatalogByGroup
    @ProductGroupCode VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        cfg.CurrencyCode,
        cfg.InventoryType,
        pg.ProductGroupCode,
        pg.ItemName,
        pg.Quantity,
        pg.WeightGm,
        pg.Material,
        pg.UnitPriceInr,
        pi.ImageId,
        pi.VariantName,
        pi.ImageBase64,
        pi.SortOrder
    FROM kv.ProductGroup AS pg
    INNER JOIN kv.ProductImage AS pi
        ON pi.ProductGroupId = pg.ProductGroupId
    LEFT JOIN kv.CatalogConfig AS cfg
        ON cfg.CatalogConfigId = 1
    WHERE pg.ProductGroupCode = @ProductGroupCode
      AND pg.IsActive = 1
    ORDER BY pi.SortOrder, pi.ImageId;
END;
GO