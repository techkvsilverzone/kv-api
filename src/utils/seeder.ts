import bcrypt from 'bcryptjs';
import Logger from './logger';
import { User } from '../models/user.model';

export const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@kvsilverzone.com';
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
      existing.passwordHash = adminPasswordHash;
      existing.name = 'System Admin';
      existing.isAdmin = true;
      existing.isActive = true;
      await existing.save();
      Logger.info('Admin user already exists (updated password/hash)');
    } else {
      await User.create({
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: 'System Admin',
        isAdmin: true,
        isActive: true,
      });
      Logger.info('Default admin user created successfully');
      Logger.info('Credentials: admin@kvsilverzone.com / Admin@123');
    }
  } catch (error) {
    Logger.error(`Error seeding admin user: ${String(error)}`);
  }
};
