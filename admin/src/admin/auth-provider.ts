import { DefaultAuthProvider } from 'adminjs';
import bcrypt from 'bcryptjs';

import componentLoader from './component-loader.js';
import { prisma } from '../db/index.js';

const INVALID_PASSWORD_HASH = '$2b$12$xP5kMJDKejc.gQXwEHGD1OSLd6hUBf47Cw6FdB2AjKBpb6BC/zs3e';

const provider = new DefaultAuthProvider({
  componentLoader,
  authenticate: async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const admin = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
    const valid = await bcrypt.compare(password, admin?.passwordHash ?? INVALID_PASSWORD_HASH);
    if (!admin || !admin.active || !valid) return null;
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    return { id: admin.id, email: admin.email, role: admin.role, title: admin.email };
  },
});

export default provider;
