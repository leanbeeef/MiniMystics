import bcrypt from 'bcryptjs';
import { prisma } from '../db/index.js';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const role = process.env.ADMIN_BOOTSTRAP_ROLE ?? 'SUPER_ADMIN';
const allowedRoles = ['SUPER_ADMIN', 'GAME_ADMIN', 'MODERATOR', 'SUPPORT'] as const;

if (!email || !password || password.length < 12) {
  throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and an ADMIN_BOOTSTRAP_PASSWORD of at least 12 characters.');
}
if (!allowedRoles.includes(role as typeof allowedRoles[number])) {
  throw new Error(`ADMIN_BOOTSTRAP_ROLE must be one of: ${allowedRoles.join(', ')}`);
}

const passwordHash = await bcrypt.hash(password, 12);
await prisma.adminUser.upsert({
  where: { email },
  create: { email, passwordHash, role: role as typeof allowedRoles[number] },
  update: { passwordHash, role: role as typeof allowedRoles[number], active: true },
});

console.log(`Admin account ready for ${email} with role ${role}.`);
await prisma.$disconnect();
