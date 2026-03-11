SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    MERGE kv.CatalogConfig AS target
    USING (
        SELECT
            CAST(1 AS TINYINT) AS CatalogConfigId,
            CAST('INR' AS CHAR(3)) AS CurrencyCode,
            CAST('image_based' AS VARCHAR(30)) AS InventoryType
    ) AS source
    ON target.CatalogConfigId = source.CatalogConfigId
    WHEN MATCHED THEN
        UPDATE
        SET CurrencyCode = source.CurrencyCode,
            InventoryType = source.InventoryType,
            UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (CatalogConfigId, CurrencyCode, InventoryType)
        VALUES (source.CatalogConfigId, source.CurrencyCode, source.InventoryType);

    DECLARE @ProductGroups TABLE (
        ProductGroupCode VARCHAR(30) PRIMARY KEY,
        ItemName NVARCHAR(150) NOT NULL,
        Quantity INT NOT NULL,
        WeightGm DECIMAL(10,2) NULL,
        Material NVARCHAR(100) NOT NULL,
        UnitPriceInr DECIMAL(12,2) NOT NULL
    );

    INSERT INTO @ProductGroups (ProductGroupCode, ItemName, Quantity, WeightGm, Material, UnitPriceInr)
    VALUES
        ('AGAL-01', N'Agal Villaku', 1, 19.75, N'Silver', 1850),
        ('BOWL-01', N'Design Bowl', 1, 15.80, N'Silver', 1450),
        ('BELL-01', N'Bell', 1, 14.20, N'Silver', 1350),
        ('AF-A', N'Archanai Flower', 4, 11.80, N'Silver', 1250),
        ('AF-B', N'Archanai Flower', 4, 11.80, N'Silver', 1250),
        ('AAR-01', N'Wooden Aarathi', 1, 4.20, N'Wood + Silver', 650),
        ('SOM-01', N'Sombu', 1, 11.96, N'Silver', 1100),
        ('KBOX-01', N'Kungumam Box', 1, 14.20, N'Silver', 1350),
        ('KUTHU-01', N'Kutthu Villaku', 1, 11.61, N'Silver', 1200),
        ('BC-BLUE', N'Baby Coin Set – Blue', 3, 3.00, N'999 Silver', 1800),
        ('BC-PINK', N'Baby Coin Set – Pink', 3, 3.00, N'999 Silver', 1800),
        ('TREE-01', N'Tree of Life Coin Set', 3, 3.00, N'Silver plated', 1500),
        ('ASHTA-01', N'Ashta Lakshmi Coin Set', 8, NULL, N'Silver plated', 3200),
        ('FRAME-01', N'Ganesha Photo Frame', 1, NULL, N'Paper / Board', 450),
        ('LAX-BOOK-01', N'Lakshmi Coin Book', 1, NULL, N'Silver coin + Box', 950),
        ('GAN-BOOK-01', N'Ganesha Coin Book', 1, NULL, N'Silver coin + Box', 950),
        ('SAR-BOOK-01', N'Saraswati Coin Book', 1, NULL, N'Silver coin + Box', 950),
        ('MUR-BOOK-01', N'Murugan Coin Book', 1, NULL, N'Silver coin + Box', 950);

    MERGE kv.ProductGroup AS target
    USING @ProductGroups AS source
    ON target.ProductGroupCode = source.ProductGroupCode
    WHEN MATCHED THEN
        UPDATE
        SET ItemName = source.ItemName,
            Quantity = source.Quantity,
            WeightGm = source.WeightGm,
            Material = source.Material,
            UnitPriceInr = source.UnitPriceInr,
            UpdatedAt = SYSUTCDATETIME(),
            IsActive = 1
    WHEN NOT MATCHED THEN
        INSERT (ProductGroupCode, ItemName, Quantity, WeightGm, Material, UnitPriceInr)
        VALUES (source.ProductGroupCode, source.ItemName, source.Quantity, source.WeightGm, source.Material, source.UnitPriceInr);

    DECLARE @ProductImages TABLE (
        ImageId INT PRIMARY KEY,
        ProductGroupCode VARCHAR(30) NOT NULL,
        VariantName NVARCHAR(150) NOT NULL,
        SortOrder INT NOT NULL
    );

    INSERT INTO @ProductImages (ImageId, ProductGroupCode, VariantName, SortOrder)
    VALUES
        (1, 'AGAL-01', N'Top view', 1),
        (2, 'BOWL-01', N'Front view', 1),
        (3, 'BOWL-01', N'Angle view', 2),
        (4, 'BELL-01', N'Front view', 1),
        (5, 'AF-A', N'Type A – Lotus style', 1),
        (6, 'AF-B', N'Type B – Mesh petal', 1),
        (7, 'AAR-01', N'Full view', 1),
        (8, 'SOM-01', N'Mini kalash', 1),
        (9, 'KBOX-01', N'Closed view', 1),
        (10, 'KUTHU-01', N'Peacock finial', 1),
        (11, 'BC-BLUE', N'Box open', 1),
        (12, 'BC-BLUE', N'Certificate view', 2),
        (13, 'BC-BLUE', N'Box closed', 3),
        (14, 'BC-PINK', N'Box open', 1),
        (15, 'BC-PINK', N'Certificate view', 2),
        (16, 'TREE-01', N'Box open', 1),
        (17, 'TREE-01', N'Coins close-up', 2),
        (18, 'ASHTA-01', N'Front cover', 1),
        (19, 'ASHTA-01', N'Inside view', 2),
        (20, 'FRAME-01', N'Front view', 1),
        (21, 'LAX-BOOK-01', N'Closed cover', 1),
        (22, 'LAX-BOOK-01', N'Open with coin', 2),
        (23, 'GAN-BOOK-01', N'Open with coin', 1),
        (24, 'SAR-BOOK-01', N'Open with coin', 1),
        (25, 'SAR-BOOK-01', N'Closed cover', 2),
        (26, 'MUR-BOOK-01', N'Open with coin', 1);

    ;WITH ImageSource AS (
        SELECT
            img.ImageId,
            pg.ProductGroupId,
            img.VariantName,
            img.SortOrder
        FROM @ProductImages AS img
        INNER JOIN kv.ProductGroup AS pg
            ON pg.ProductGroupCode = img.ProductGroupCode
    )
    MERGE kv.ProductImage AS target
    USING ImageSource AS source
    ON target.ImageId = source.ImageId
    WHEN MATCHED THEN
        UPDATE
        SET ProductGroupId = source.ProductGroupId,
            VariantName = source.VariantName,
            SortOrder = source.SortOrder
    WHEN NOT MATCHED THEN
        INSERT (ImageId, ProductGroupId, VariantName, SortOrder)
        VALUES (source.ImageId, source.ProductGroupId, source.VariantName, source.SortOrder)
    WHEN NOT MATCHED BY SOURCE THEN
        DELETE;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO

SELECT
    cfg.CurrencyCode,
    cfg.InventoryType,
    COUNT(DISTINCT pg.ProductGroupId) AS ProductGroupCount,
    COUNT(pi.ImageId) AS ProductImageCount
FROM kv.CatalogConfig AS cfg
LEFT JOIN kv.ProductGroup AS pg
    ON pg.IsActive = 1
LEFT JOIN kv.ProductImage AS pi
    ON pi.ProductGroupId = pg.ProductGroupId
WHERE cfg.CatalogConfigId = 1
GROUP BY cfg.CurrencyCode, cfg.InventoryType;
GO