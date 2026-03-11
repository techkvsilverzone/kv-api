SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('kv.ProductImage', 'ImageBase64') IS NULL
    BEGIN
        ALTER TABLE kv.ProductImage
        ADD ImageBase64 NVARCHAR(MAX) NULL;
    END;

    IF COL_LENGTH('kv.ProductImage', 'ImageUrl') IS NOT NULL
    BEGIN
                EXEC('
                        UPDATE kv.ProductImage
                        SET ImageBase64 = ImageUrl
                        WHERE ImageBase64 IS NULL
                            AND ImageUrl IS NOT NULL;
                ');
    END;

    IF OBJECT_ID('kv.vw_ProductCatalog', 'V') IS NOT NULL
    BEGIN
        DROP VIEW kv.vw_ProductCatalog;
    END;

    EXEC('
    CREATE VIEW kv.vw_ProductCatalog
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
    ');

    EXEC('
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
    ');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO

IF COL_LENGTH('kv.ProductImage', 'ImageBase64') IS NOT NULL
BEGIN
    EXEC('
        SELECT
            COUNT(1) AS TotalImages,
            SUM(CASE WHEN ImageBase64 IS NOT NULL AND LEN(ImageBase64) > 0 THEN 1 ELSE 0 END) AS ImagesWithBase64
        FROM kv.ProductImage;
    ');
END
ELSE
BEGIN
    SELECT
        COUNT(1) AS TotalImages,
        CAST(0 AS INT) AS ImagesWithBase64
    FROM kv.ProductImage;
END;
GO
