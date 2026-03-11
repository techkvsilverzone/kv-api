SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Users TABLE (
        Email NVARCHAR(255) PRIMARY KEY,
        PasswordHash NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(150) NOT NULL,
        Phone NVARCHAR(30) NULL,
        AddressLine NVARCHAR(300) NULL,
        City NVARCHAR(100) NULL,
        [State] NVARCHAR(100) NULL,
        Pincode NVARCHAR(20) NULL,
        IsAdmin BIT NOT NULL
    );

    INSERT INTO @Users (Email, PasswordHash, FullName, Phone, AddressLine, City, [State], Pincode, IsAdmin)
    VALUES
        (
            N'admin@kvsilverzone.com',
            N'$2b$10$RWoK5Bu66ot.3QLaXWshreA5Oqi3vhtCMZJ1HOp9GlbDywYQScheG',
            N'System Admin',
            N'9999999999',
            N'Admin Office, Silver Zone',
            N'Chennai',
            N'Tamil Nadu',
            N'600001',
            1
        ),
        (
            N'user1@kvsilverzone.com',
            N'$2b$10$ecPYU4o8VtQ05yCBrQc16OD8Fu3PIlU9QY4jDKJUaueTCUZR.hQKK',
            N'Test Customer',
            N'9876543210',
            N'12 Temple Street',
            N'Madurai',
            N'Tamil Nadu',
            N'625001',
            0
        );

    MERGE kv.[User] AS target
    USING @Users AS source
    ON target.Email = source.Email
    WHEN MATCHED THEN
        UPDATE
        SET PasswordHash = source.PasswordHash,
            FullName = source.FullName,
            Phone = source.Phone,
            AddressLine = source.AddressLine,
            City = source.City,
            [State] = source.[State],
            Pincode = source.Pincode,
            IsAdmin = source.IsAdmin,
            IsActive = 1,
            UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (Email, PasswordHash, FullName, Phone, AddressLine, City, [State], Pincode, IsAdmin)
        VALUES (source.Email, source.PasswordHash, source.FullName, source.Phone, source.AddressLine, source.City, source.[State], source.Pincode, source.IsAdmin);

    DECLARE @User1Id UNIQUEIDENTIFIER = (
        SELECT TOP 1 UserId
        FROM kv.[User]
        WHERE Email = N'user1@kvsilverzone.com'
    );

    IF @User1Id IS NOT NULL
    BEGIN
        MERGE kv.Cart AS target
        USING (SELECT @User1Id AS UserId) AS source
        ON target.UserId = source.UserId
        WHEN MATCHED THEN
            UPDATE SET UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (UserId)
            VALUES (source.UserId);

        DECLARE @CartId UNIQUEIDENTIFIER = (
            SELECT TOP 1 CartId
            FROM kv.Cart
            WHERE UserId = @User1Id
        );

        IF @CartId IS NOT NULL
        BEGIN
            MERGE kv.CartItem AS target
            USING (
                SELECT @CartId AS CartId, 2 AS ImageId, 1 AS Quantity
                UNION ALL
                SELECT @CartId, 10, 2
            ) AS source
            ON target.CartId = source.CartId AND target.ImageId = source.ImageId
            WHEN MATCHED THEN
                UPDATE SET Quantity = source.Quantity, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (CartId, ImageId, Quantity)
                VALUES (source.CartId, source.ImageId, source.Quantity);
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM kv.SavingsEnrollment
            WHERE UserId = @User1Id
              AND MonthlyAmount = 2000
              AND DurationMonths = 12
        )
        BEGIN
            INSERT INTO kv.SavingsEnrollment
            (
                UserId,
                MonthlyAmount,
                DurationMonths,
                StartDate,
                [Status],
                TotalPaid,
                BonusAmount
            )
            VALUES
            (
                @User1Id,
                2000,
                12,
                CAST(SYSUTCDATETIME() AS DATE),
                'Active',
                4000,
                0
            );
        END;

        DECLARE @OrderId UNIQUEIDENTIFIER = (
            SELECT TOP 1 OrderId
            FROM kv.[Order]
            WHERE UserId = @User1Id
              AND TotalAmount = 2550
              AND PaymentMethod = 'upi'
        );

        IF @OrderId IS NULL
        BEGIN
            SET @OrderId = NEWID();

            INSERT INTO kv.[Order]
            (
                OrderId,
                UserId,
                TotalAmount,
                TaxAmount,
                [Status],
                PaymentMethod
            )
            VALUES
            (
                @OrderId,
                @User1Id,
                2550,
                127.50,
                'Pending',
                'upi'
            );

            INSERT INTO kv.OrderShippingAddress
            (
                OrderId,
                FirstName,
                LastName,
                AddressLine,
                City,
                [State],
                Pincode,
                Phone
            )
            VALUES
            (
                @OrderId,
                N'Test',
                N'Customer',
                N'12 Temple Street',
                N'Madurai',
                N'Tamil Nadu',
                N'625001',
                N'9876543210'
            );

            INSERT INTO kv.OrderItem
            (
                OrderId,
                ImageId,
                ProductName,
                UnitPrice,
                Quantity,
                ImageUrl
            )
            VALUES
            (
                @OrderId,
                2,
                N'Design Bowl - Front view',
                1450,
                1,
                NULL
            ),
            (
                @OrderId,
                7,
                N'Wooden Aarathi - Full view',
                650,
                1,
                NULL
            );
        END;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM kv.ContactEnquiry
        WHERE Email = N'user1@kvsilverzone.com'
          AND Subject = N'Bulk Purchase Enquiry'
    )
    BEGIN
        INSERT INTO kv.ContactEnquiry
        (
            FullName,
            Email,
            Subject,
            MessageBody,
            IsResolved
        )
        VALUES
        (
            N'Test Customer',
            N'user1@kvsilverzone.com',
            N'Bulk Purchase Enquiry',
            N'Need pricing for temple event bulk order of silver items.',
            0
        );
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
GO

SELECT
    (SELECT COUNT(1) FROM kv.[User]) AS UserCount,
    (SELECT COUNT(1) FROM kv.Cart) AS CartCount,
    (SELECT COUNT(1) FROM kv.CartItem) AS CartItemCount,
    (SELECT COUNT(1) FROM kv.[Order]) AS OrderCount,
    (SELECT COUNT(1) FROM kv.OrderItem) AS OrderItemCount,
    (SELECT COUNT(1) FROM kv.SavingsEnrollment) AS SavingsCount,
    (SELECT COUNT(1) FROM kv.ContactEnquiry) AS ContactCount;
GO
