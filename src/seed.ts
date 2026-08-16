import { seedAdmin } from './utils/seeder';
import Logger from './utils/logger';
import { connectPostgres, disconnectPostgres } from './infrastructure/postgres/pool';

const seed = async () => {
  try {
    Logger.info('Connecting to PostgreSQL for seeding...');
    await connectPostgres();

    await seedAdmin();

    await disconnectPostgres();

    Logger.info('Seeding completed');
    process.exit(0);
  } catch (error) {
    Logger.error(`Seeding failed: ${String(error)}`);
    process.exit(1);
  }
};

seed();
