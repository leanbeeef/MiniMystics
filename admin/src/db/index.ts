import { Database, Resource } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import AdminJS from 'adminjs';

export const prisma = new PrismaClient();

AdminJS.registerAdapter({ Database, Resource });

const initialize = async () => {
  await prisma.$connect();
  return { prisma };
};

export default initialize;
