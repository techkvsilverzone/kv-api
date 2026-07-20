import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KV Silver Zone API',
      version: '1.0.0',
      description:
        'API documentation for KV Silver Zone. Auth is via an httpOnly cookie set on /auth/login (a Bearer token is also returned for API clients). Protected endpoints accept either.',
    },
    servers: [
      {
        url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/v1`,
        description: process.env.BASE_URL ? 'Production' : 'Local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
      responses: {
        BadRequest: {
          description: 'Validation error / bad input',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Unauthorized: {
          description: 'Missing or invalid authentication',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Authenticated but not allowed',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Conflict: {
          description: 'Conflict (e.g. duplicate or insufficient stock)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            statusCode: { type: 'integer', example: 400 },
            message: { type: 'string', example: 'price must be a positive number' },
          },
        },
        ProductImage: {
          type: 'object',
          properties: {
            variantName: { type: 'string', example: 'Default view' },
            imageBase64: { type: 'string', description: 'Base64 data URL or image URL' },
            sortOrder: { type: 'integer', example: 1 },
          },
        },
        ProductPricing: {
          type: 'object',
          description: 'Live pricing breakdown computed server-side from the silver rate.',
          properties: {
            basis: { type: 'string', enum: ['live', 'static'], example: 'live' },
            metalValue: { type: 'number', example: 925 },
            makingCharge: { type: 'number', example: 92.5 },
            ratePerGram: { type: 'number', nullable: true, example: 100 },
            purityFraction: { type: 'number', example: 0.925 },
            currency: { type: 'string', example: 'INR' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '665f1c2a9b1e4a0012ab34cd' },
            productGroupCode: { type: 'string', example: 'RING001' },
            name: { type: 'string', example: 'Silver Lotus Ring' },
            description: { type: 'string' },
            material: { type: 'string', example: 'Silver' },
            weight: { type: 'number', example: 10 },
            weightInGrams: { type: 'number', example: 10 },
            price: { type: 'number', description: 'Authoritative live price', example: 1017.5 },
            listedPrice: { type: 'number', description: 'Static fallback price', example: 5000 },
            originalPrice: { type: 'number' },
            purity: { type: 'string', example: '925' },
            makingChargePercent: { type: 'number', example: 10 },
            makingChargePerGram: { type: 'number' },
            isSale: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            isActive: { type: 'boolean', description: 'Catalog visibility (admin-controlled)' },
            quantity: { type: 'integer', description: 'Initial/seed quantity' },
            stockAvailable: { type: 'integer', description: 'Live stock from Inventory', example: 7 },
            inStock: { type: 'boolean', example: true },
            images: { type: 'array', items: { $ref: '#/components/schemas/ProductImage' } },
            variants: { type: 'array', items: { $ref: '#/components/schemas/ProductVariant' } },
            isFixedPrice: { type: 'boolean', description: 'Flat price; no dynamic metal-rate calc', example: false },
            makingCharge: { allOf: [{ $ref: '#/components/schemas/ProductCharge' }], nullable: true },
            wastage: { allOf: [{ $ref: '#/components/schemas/ProductCharge' }], nullable: true },
            pricing: { $ref: '#/components/schemas/ProductPricing' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProductInput: {
          type: 'object',
          required: ['name', 'category', 'weight', 'price'],
          properties: {
            name: { type: 'string', example: 'Silver Lotus Ring' },
            category: { type: 'string', description: 'Stored as material', example: 'Silver' },
            weight: { type: 'number', example: 10 },
            price: { type: 'number', example: 5000 },
            quantity: { type: 'integer', example: 10 },
            description: { type: 'string' },
            purity: { type: 'string', example: '925' },
            originalPrice: { type: 'number' },
            makingChargePercent: { type: 'number', example: 10 },
            makingChargePerGram: { type: 'number' },
            image: { type: 'string', description: 'Primary image (= images[0]); kept for backward compatibility' },
            images: {
              type: 'array',
              description:
                'Ordered gallery; images[0] is the primary image. Each entry is a base64 data URL (new upload) or an existing image reference echoed from a GET. Full replacement on update; empty array clears all images.',
              items: { type: 'string' },
            },
            productGroupCode: { type: 'string', description: 'Auto-generated from name if omitted' },
            isFeatured: { type: 'boolean' },
            isSale: { type: 'boolean' },
            isActive: { type: 'boolean' },
            variants: {
              type: 'array',
              description: 'Full replacement array on update; empty array clears all variants',
              items: { $ref: '#/components/schemas/ProductVariant' },
            },
            isFixedPrice: { type: 'boolean', description: 'When true, makingCharge/wastage are ignored/cleared' },
            makingCharge: { allOf: [{ $ref: '#/components/schemas/ProductCharge' }], nullable: true },
            wastage: { allOf: [{ $ref: '#/components/schemas/ProductCharge' }], nullable: true },
          },
        },
        ProductCharge: {
          type: 'object',
          required: ['type', 'value'],
          properties: {
            type: {
              type: 'string',
              enum: ['percentage', 'amount'],
              description: 'percentage = percent (0-100); amount = flat rupee amount',
            },
            value: { type: 'number', minimum: 0, description: 'Non-negative; <= 100 when type is percentage', example: 12 },
          },
        },
        ProductVariant: {
          type: 'object',
          required: ['label', 'weight'],
          properties: {
            label: { type: 'string', description: 'Free-text size name', example: 'M' },
            weight: { type: 'string', description: 'Per-variant weight (free-text)', example: '30g' },
            height: { type: 'string', description: 'Display-only', example: '3cm' },
            breadth: { type: 'string', description: 'Display-only', example: '2cm' },
          },
        },
        ShippingAddress: {
          type: 'object',
          required: ['name', 'phone', 'line1', 'city', 'state', 'pincode'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string', example: '9876543210' },
            line1: { type: 'string' },
            line2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            pincode: { type: 'string', example: '600001' },
            country: { type: 'string', example: 'India' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            productGroupCode: { type: 'string' },
            productName: { type: 'string' },
            quantity: { type: 'integer', example: 1 },
            weight: { type: 'number' },
            unitPrice: { type: 'number' },
            totalPrice: { type: 'number' },
            isGiftVoucher: { type: 'boolean' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            status: { type: 'string', enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
            paymentMethod: { type: 'string', enum: ['cod', 'razorpay'] },
            paymentStatus: { type: 'string', enum: ['Pending', 'Paid', 'Failed', 'Refunded'] },
            razorpayOrderId: { type: 'string' },
            razorpayPaymentId: { type: 'string' },
            couponCode: { type: 'string', nullable: true },
            couponDiscount: { type: 'number' },
            giftWrap: { type: 'boolean' },
            giftMessage: { type: 'string' },
            giftWrapFee: { type: 'number' },
            subtotal: { type: 'number' },
            taxAmount: { type: 'number' },
            totalWithTax: { type: 'number' },
            deliveryFee: { type: 'number' },
            grandTotal: { type: 'number' },
            totalAmount: { type: 'number' },
            tax: { type: 'number' },
            shippingAddress: { $ref: '#/components/schemas/ShippingAddress' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        OrderInput: {
          type: 'object',
          required: ['items', 'shippingAddress'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['product', 'quantity'],
                properties: {
                  product: { type: 'string', description: 'Product id (or gift voucher id)' },
                  quantity: { type: 'integer', example: 1 },
                  isGiftVoucher: { type: 'boolean' },
                  giftVoucherId: { type: 'string' },
                },
              },
            },
            shippingAddress: { $ref: '#/components/schemas/ShippingAddress' },
            paymentMethod: { type: 'string', enum: ['cod', 'razorpay'], example: 'cod' },
            couponCode: { type: 'string' },
            giftWrap: { type: 'boolean' },
            giftMessage: { type: 'string' },
          },
        },
        CreatePaymentOrderInput: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['product', 'quantity'],
                properties: {
                  product: { type: 'string' },
                  quantity: { type: 'integer', example: 1 },
                  isGiftVoucher: { type: 'boolean' },
                  giftVoucherId: { type: 'string' },
                },
              },
            },
            couponCode: { type: 'string' },
            pincode: { type: 'string', example: '600001' },
            currency: { type: 'string', example: 'INR' },
          },
        },
        CreatePaymentOrderResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Razorpay order id', example: 'order_NABC123' },
            amount: { type: 'integer', description: 'Amount in paise', example: 101750 },
            currency: { type: 'string', example: 'INR' },
            breakdown: {
              type: 'object',
              properties: {
                items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
                subtotal: { type: 'number' },
                taxAmount: { type: 'number' },
                discount: { type: 'number' },
                couponCode: { type: 'string', nullable: true },
                deliveryFee: { type: 'number' },
                grandTotal: { type: 'number' },
              },
            },
          },
        },
        VerifyPaymentInput: {
          type: 'object',
          required: ['orderData'],
          properties: {
            razorpayOrderId: { type: 'string' },
            razorpayPaymentId: { type: 'string' },
            razorpaySignature: { type: 'string' },
            orderData: {
              type: 'object',
              required: ['items', 'shippingAddress', 'paymentMethod'],
              properties: {
                items: { type: 'array', items: { type: 'object' } },
                shippingAddress: { $ref: '#/components/schemas/ShippingAddress' },
                paymentMethod: { type: 'string', enum: ['cod', 'razorpay'] },
                couponCode: { type: 'string' },
                giftWrap: { type: 'boolean' },
                giftMessage: { type: 'string' },
              },
            },
          },
        },
        VerifyPaymentResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            orderId: { type: 'string' },
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            isAdmin: { type: 'boolean' },
            role: { type: 'string', enum: ['customer', 'staff', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string', description: 'JWT (also set as an httpOnly cookie)' },
            promoCoupon: { type: 'string', description: 'Present only for stall-event signups' },
          },
        },
        SignupInput: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
            phone: { type: 'string' },
            stallEvent: { type: 'boolean', description: 'Issues a 10% single-use promo coupon' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
          },
        },
        CartItemInput: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string' },
            quantity: { type: 'integer', example: 1 },
          },
        },
        Cart: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'integer' },
                },
              },
            },
          },
        },
        Coupon: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            code: { type: 'string', example: 'WELCOME10' },
            discountType: { type: 'string', enum: ['percentage', 'fixed'] },
            discountValue: { type: 'number', example: 10 },
            minOrderAmount: { type: 'number' },
            maxUses: { type: 'integer', description: '0 = unlimited' },
            usedCount: { type: 'integer' },
            expiryDate: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean' },
          },
        },
        CouponInput: {
          type: 'object',
          required: ['code', 'discountType', 'discountValue'],
          properties: {
            code: { type: 'string' },
            discountType: { type: 'string', enum: ['percentage', 'fixed'] },
            discountValue: { type: 'number' },
            minOrderAmount: { type: 'number' },
            maxUses: { type: 'integer' },
            expiryDate: { type: 'string', format: 'date' },
            isActive: { type: 'boolean' },
          },
        },
        ApplyCouponInput: {
          type: 'object',
          required: ['code', 'orderAmount'],
          properties: {
            code: { type: 'string', example: 'WELCOME10' },
            orderAmount: { type: 'number', example: 5000 },
          },
        },
        ApplyCouponResponse: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            discount: { type: 'number' },
            message: { type: 'string' },
          },
        },
        GiftVoucher: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            label: { type: 'string', example: '₹5000 Gift Card' },
            amount: { type: 'number', example: 5000 },
            description: { type: 'string' },
            imageBase64: { type: 'string' },
            isActive: { type: 'boolean' },
            sortOrder: { type: 'integer' },
          },
        },
        GiftVoucherInput: {
          type: 'object',
          required: ['label', 'amount'],
          properties: {
            label: { type: 'string' },
            amount: { type: 'number' },
            description: { type: 'string' },
            imageBase64: { type: 'string' },
            isActive: { type: 'boolean' },
            sortOrder: { type: 'integer' },
          },
        },
        MetalRate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', format: 'date' },
            metal: { type: 'string', enum: ['SILVER', 'GOLD'] },
            karat: { type: 'integer', nullable: true },
            ratePerGram: { type: 'number' },
            ratePerKg: { type: 'number' },
            updatedBy: { type: 'string' },
          },
        },
        MetalRateInput: {
          type: 'object',
          required: ['date', 'metal', 'ratePerGram'],
          properties: {
            date: { type: 'string', format: 'date' },
            metal: { type: 'string', enum: ['SILVER', 'GOLD'] },
            karat: { type: 'integer', nullable: true, description: 'null for SILVER, 22 for GOLD' },
            ratePerGram: { type: 'number' },
          },
        },
        PincodeRate: {
          type: 'object',
          properties: {
            pincode: { type: 'string', example: '600001' },
            rate: { type: 'number', example: 50 },
          },
        },
        PricingConfig: {
          type: 'object',
          properties: {
            gstPercent: { type: 'number', example: 3 },
          },
        },
        DeliveryConfig: {
          type: 'object',
          required: ['chennai', 'otherDistrict', 'otherState'],
          properties: {
            chennai: { type: 'number', minimum: 0, description: 'Destination city is Chennai', example: 150 },
            otherDistrict: { type: 'number', minimum: 0, description: 'Same state (Tamil Nadu), not Chennai', example: 200 },
            otherState: { type: 'number', minimum: 0, description: 'Any other state', example: 250 },
          },
        },
        StoreConfig: {
          type: 'object',
          properties: {
            theme: { type: 'string', example: 'icy-silver' },
            isDark: { type: 'boolean' },
            marqueeMessages: { type: 'array', items: { type: 'string' } },
          },
        },
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            productId: { type: 'string' },
            userId: { type: 'string' },
            userName: { type: 'string' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ReviewInput: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            comment: { type: 'string' },
          },
        },
        MessageResponse: {
          type: 'object',
          properties: { message: { type: 'string' } },
        },
        Address: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string', example: 'Home' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            pincode: { type: 'string', example: '600001' },
            phone: { type: 'string', example: '9876543210' },
            isDefault: { type: 'boolean' },
          },
        },
        AddressInput: {
          type: 'object',
          required: ['firstName', 'lastName', 'address', 'city', 'state', 'pincode', 'phone'],
          properties: {
            label: { type: 'string', example: 'Home' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            pincode: { type: 'string', example: '600001', description: '6-digit PIN' },
            phone: { type: 'string', example: '9876543210', description: '10-digit Indian mobile' },
            isDefault: { type: 'boolean' },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts'],
};

export const specs = swaggerJsdoc(options);
