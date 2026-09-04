import { Container, getContainer } from '@cloudflare/containers';
import { env as runtimeEnv } from 'cloudflare:workers';

type AdminBindings = {
  ADMIN_CONTAINER: DurableObjectNamespace;
  DATABASE_URL: string;
  COOKIE_SECRET: string;
};

const secrets = runtimeEnv as unknown as AdminBindings;

export class MiniMysticsAdminContainer extends Container {
  defaultPort = 3001;
  sleepAfter = '30m';
  envVars = {
    DATABASE_URL: secrets.DATABASE_URL,
    COOKIE_SECRET: secrets.COOKIE_SECRET,
    HOST: '0.0.0.0',
    PORT: '3001',
    NODE_ENV: 'production',
    TRUST_PROXY: 'true',
    PUBLIC_GAME_URL: 'https://minimystics.com',
  };
}

export default {
  async fetch(request: Request, env: AdminBindings): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      url.pathname = '/admin';
      return Response.redirect(url.toString(), 302);
    }

    const admin = getContainer(env.ADMIN_CONTAINER, 'primary');
    return admin.fetch(request);
  },
};
