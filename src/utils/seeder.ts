import bcrypt from 'bcryptjs';
import Logger from './logger';
import { User } from '../models/user.model';

export const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@kvsilverzone.com';
    const staffEmail = 'staff@kvsilverzone.com';
    const adminPasswordHash = await bcrypt.hash('adminkvz123', 10);
    const staffPasswordHash = await bcrypt.hash('staffkvz123', 10);

    const existing = await User.findOne({ email: adminEmail });
    const existingStaff = await User.findOne({ email: staffEmail });

    if (existing) {
      existing.passwordHash = adminPasswordHash;
      existing.name = 'System Admin';
      existing.isAdmin = true;
      existing.role = 'admin';
      existing.isActive = true;
      await existing.save();
      Logger.info('Admin user already exists (updated password/hash)');
    } else {
      await User.create({
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: 'System Admin',
        isAdmin: true,
        role: 'admin',
        isActive: true,
      });
      Logger.info('Default admin user created successfully');
      Logger.info('Credentials: admin@kvsilverzone.com / adminkvz123');
    }

    if (existingStaff) {
      existingStaff.passwordHash = staffPasswordHash;
      existingStaff.name = 'System Staff';
      existingStaff.isAdmin = false;
      existingStaff.role = 'staff';
      existingStaff.isActive = true;
      await existingStaff.save();
      Logger.info('Staff user already exists (updated password/hash)');
    } else {
      await User.create({
        email: staffEmail,
        passwordHash: staffPasswordHash,
        name: 'System Staff',
        isAdmin: false,
        role: 'staff',
        isActive: true,
      });
      Logger.info('Default staff user created successfully');
      Logger.info('Credentials: staff@kvsilverzone.com / staffkvz123');
    }
  } catch (error) {
    Logger.error(`Error seeding admin user: ${String(error)}`);
  }
};
