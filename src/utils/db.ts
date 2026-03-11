import mongoose from 'mongoose';
import { config } from '../config';
import Logger from './logger';

export const connectMongo = async (): Promise<void> => {
  await mongoose.connect(config.mongoUri);
  Logger.info('Connected to MongoDB');
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};
