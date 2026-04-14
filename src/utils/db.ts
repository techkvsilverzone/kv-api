import mongoose from 'mongoose';
import { config } from '../config';
import Logger from './logger';

export const connectMongo = async (): Promise<void> => {
  const uri = config.mongoUri || 'mongodb://localhost:27017/kv-silver-zone';
  await mongoose.connect(uri);
  Logger.info('Connected to MongoDB');
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};
