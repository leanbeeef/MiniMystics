import express from 'express';
import AdminJS from 'adminjs';
import { buildAuthenticatedRouter } from '@adminjs/express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

import provider from './admin/auth-provider.js';
import options from './admin/options.js';
import initializeDb, { prisma } from './db/index.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const requireEnvironment = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.length < 32) {
    throw new Error('COOKIE_SECRET must be at least 32 characters.');
  }
};

const sessionConnectionString = () => {
  const value = process.env.DATABASE_URL as string;
  const url = new URL(value);

  // Supabase's shared pooler presents a managed certificate chain that
  // node-postgres treats differently from libpq when sslmode=require.
  // Preserve encrypted transport while opting into standard libpq semantics.
  if (url.hostname.endsWith('.pooler.supabase.com') && url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('uselibpqcompat', 'true');
  }

  return url.toString();
};

const start = async () => {
  requireEnvironment();
  const app = express();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.get('/healthz', (_request, response) => response.status(200).json({ status: 'ok' }));

  await initializeDb();

  const admin = new AdminJS(options);

  if (process.env.NODE_ENV === 'production') {
    await admin.initialize();
  } else {
    admin.watch();
  }

  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    conString: sessionConnectionString(),
    createTableIfMissing: true,
  });

  app.use(
    `${admin.options.rootPath}/login`,
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  const router = buildAuthenticatedRouter(
    admin,
    {
      cookiePassword: process.env.COOKIE_SECRET,
      cookieName: 'adminjs',
      provider,
    },
    null,
    {
      secret: process.env.COOKIE_SECRET,
      store: sessionStore,
      saveUninitialized: false,
      resave: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
      },
    },
  );

  app.use(admin.options.rootPath, router);

  const server = app.listen(port, host, () => {
    console.log(`AdminJS listening on ${host}:${port}${admin.options.rootPath}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((error) => {
  console.error('Admin service failed to start.', error);
  process.exit(1);
});
