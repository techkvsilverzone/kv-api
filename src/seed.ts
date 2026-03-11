import { seedAdmin } from './utils/seeder';
import Logger from './utils/logger';
import { connectMongo, disconnectMongo } from './utils/db';

const seed = async () => {
  try {
    Logger.info('Connecting to MongoDB for seeding...');
    await connectMongo();

    await seedAdmin();

    await disconnectMongo();

    Logger.info('Seeding completed');
    process.exit(0);
  } catch (error) {
    Logger.error(`Seeding failed: ${String(error)}`);
    process.exit(1);
  }
};

seed();
