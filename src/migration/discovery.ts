import mongoose, { Model } from 'mongoose';
import { connectMongo, disconnectMongo } from './mongoConnection';
import { config } from '../config';

import { Cart } from './models/cart.model';
import { Category } from './models/category.model';
import { Coupon } from './models/coupon.model';
import { DeliveryConfig } from './models/deliveryConfig.model';
import { FilterConfig } from './models/filterConfig.model';
import { GiftVoucher } from './models/giftVoucher.model';
import { Inventory } from './models/inventory.model';
import { InventoryTransaction } from './models/inventoryTransaction.model';
import { InvoiceConfig } from './models/invoiceConfig.model';
import { MetalRate } from './models/metalrate.model';
import { Order } from './models/order.model';
import { OtpCode } from './models/otpCode.model';
import { PincodeRate } from './models/pincodeRate.model';
import { PricingConfig } from './models/pricingConfig.model';
import { Product } from './models/product.model';
import { RateStatus } from './models/rateStatus.model';
import { Return } from './models/return.model';
import { Review } from './models/review.model';
import { Savings } from './models/savings.model';
import { SchemePlan } from './models/schemePlan.model';
import { SilverRate } from './models/silverrate.model';
import { StallConfig } from './models/stallConfig.model';
import { StoreConfig } from './models/storeConfig.model';
import { UnmatchedReturnVideo } from './models/unmatchedReturnVideo.model';
import { User } from './models/user.model';
import { Wishlist } from './models/wishlist.model';

type AnyModel = Model<any>;
const SAMPLE_SIZE = 500;
const TOP_VALUES = 20;

const models: AnyModel[] = [
  Cart, Category, Coupon, DeliveryConfig, FilterConfig, GiftVoucher,
  Inventory, InventoryTransaction, InvoiceConfig, MetalRate, Order,
  OtpCode, PincodeRate, PricingConfig, Product, RateStatus, Return,
  Review, Savings, SchemePlan, SilverRate, StallConfig, StoreConfig,
  UnmatchedReturnVideo, User, Wishlist,
];

function failIfUnsafeMongoUri(): void {
  if (!config.mongoUri) {
    throw new Error('MONGO_URI is not set — refusing to run discovery.');
  }
  const uri = config.mongoUri.toLowerCase();
  if (uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('0.0.0.0')) {
    throw new Error('Refusing to run against a localhost/loopback MongoDB URI. Expected MongoDB Atlas.');
  }
}

function getMongoDb(): NonNullable<typeof mongoose.connection.db> {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error(
      'MongoDB connection established but mongoose.connection.db is unavailable.'
    );
  }

  return db;
}

function schemaFieldNames(model: AnyModel): string[] {
  return Object.keys(model.schema.paths)
    .filter((name) => !['_id', '__v'].includes(name))
    .sort();
}

function isArrayPath(model: AnyModel, field: string): boolean {
  const path = model.schema.path(field) as any;
  return Boolean(path?.$isMongooseArray || path?.instance === 'Array');
}

function enumValues(model: AnyModel, field: string): string[] {
  const path = model.schema.path(field) as any;
  return path?.enumValues?.length ? [...path.enumValues] : [];
}

function valueToKey(value: unknown): string {
  if (value === undefined) return '<missing>';
  if (value === null) return '<null>';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topValues(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_VALUES)
  );
}

async function discoverModel(model: AnyModel) {
  const collectionName = model.collection.name;
  const count = await model.countDocuments();
  const docs = await model.find({}).limit(SAMPLE_SIZE).lean();

  const fields = schemaFieldNames(model);
  const fieldPresence: Record<string, number> = {};
  const arrayStats: Record<string, { documentsWithValues: number; totalItems: number; maxItems: number }> = {};

  for (const field of fields) {
    let present = 0;
    if (isArrayPath(model, field)) {
      arrayStats[field] = { documentsWithValues: 0, totalItems: 0, maxItems: 0 };
    }

    for (const doc of docs) {
      const value = doc[field];

      if (value !== undefined && value !== null && !(Array.isArray(value) && value.length === 0)) {
        present++;
      }

      if (Array.isArray(value)) {
        const length = value.length;
        if (length > 0) arrayStats[field].documentsWithValues++;
        arrayStats[field].totalItems += length;
        arrayStats[field].maxItems = Math.max(arrayStats[field].maxItems, length);
      }
    }
    fieldPresence[field] = present;
  }

  const enumDistribution: Record<string, Record<string, number>> = {};

  for (const field of fields) {
    if (!enumValues(model, field).length) continue;

    const distribution = new Map<string, number>();

    for (const doc of docs) {
      const value = doc[field];
      if (Array.isArray(value)) {
        for (const item of value) increment(distribution, valueToKey(item));
      } else {
        increment(distribution, valueToKey(value));
      }
    }
    enumDistribution[field] = topValues(distribution);
  }

  return {
    model: model.modelName,
    collection: collectionName,
    documentCount: count,
    sampledDocuments: docs.length,
    schemaFields: fields,
    fieldPresenceInSample: fieldPresence,
    arrayStatsInSample: arrayStats,
    enumDistributionInSample: enumDistribution,
    migrationAttentionFields: fields.filter((field) =>
      /legacy|original|old|deprecated|sqlserver|totalamount|tax/i.test(field)
    ),
  };
}

async function discoverActualCollections() {
  // const collections = await mongoose.connection.db.listCollections().toArray();
  const db = getMongoDb();
  const collections = await db.listCollections().toArray();
  const actual = collections.map((c) => c.name).sort();
  const modelCollections = [...new Set(models.map((m) => m.collection.name))].sort();
  const modelSet = new Set(modelCollections);

  return {
    actual,
    modelCollections,
    orphanCollections: actual.filter((name) => !modelSet.has(name)),
  };
}

async function main(): Promise<void> {
  failIfUnsafeMongoUri();

  // Discovery must never create Mongoose indexes/collections.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);

  console.log('==============================================');
  console.log('KVS MongoDB READ-ONLY DISCOVERY');
  console.log('==============================================');
  console.log(`Models: ${models.length}`);
  console.log(`Sample size per model: ${SAMPLE_SIZE}`);
  console.log('MongoDB writes: DISABLED');
  console.log('Mongoose autoIndex: DISABLED');
  console.log('');

  await connectMongo();

  // const dbName = mongoose.connection.db.databaseName;
  
  const dbName = getMongoDb().databaseName;
  console.log(`Connected database: ${dbName}`);
  console.log('');

  const modelResults = [];

  for (const model of models) {
    process.stdout.write(`Inspecting ${model.modelName}... `);
    const result = await discoverModel(model);
    modelResults.push(result);
    console.log(`${result.documentCount} documents`);
  }

  const collections = await discoverActualCollections();

  const report = {
    generatedAt: new Date().toISOString(),
    database: dbName,
    modelCount: models.length,
    models: modelResults,
    collections,
  };

  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const outputDir = path.resolve(process.cwd(), 'migration-reports');

  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(outputDir, `mongo-discovery-${timestamp}.json`);

  await fs.writeFile(outputFile, JSON.stringify(report, null, 2), 'utf8');

  console.log('');
  console.log('==============================================');
  console.log('DISCOVERY COMPLETE');
  console.log('==============================================');
  console.log(`Actual MongoDB collections: ${collections.actual.length}`);
  console.log(`Model collections: ${collections.modelCollections.length}`);

  if (collections.orphanCollections.length) {
    console.log('');
    console.log('ORPHAN COLLECTIONS (no current Mongoose model):');
    for (const collection of collections.orphanCollections) {
      console.log(`  - ${collection}`);
    }
  } else {
    console.log('Orphan collections: none');
  }

  console.log('');
  console.log(`Report: ${outputFile}`);
}

main()
  .catch((error) => {
    console.error('');
    console.error('DISCOVERY FAILED');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo().catch(() => undefined);
  });
