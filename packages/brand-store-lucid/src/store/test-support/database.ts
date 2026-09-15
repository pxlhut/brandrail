/**
 * A standalone Lucid `Database` — no booted Adonis app, no ace, no
 * `adonisrc.ts` — built the same way AdonisJS's own factories are meant to
 * be used outside a full app: `AppFactory`/`EmitterFactory`/`LoggerFactory`
 * produce the three constructor arguments `Database` takes, so a Postgres
 * connection can be stood up for tests without any of the provider/IoC
 * wiring in `provider/`.
 *
 * Connection settings come from the standard `PG*` env vars, defaulting to
 * the CI service container in `.github/workflows/ci.yml`. For a local run
 * against a throwaway container instead:
 *
 * ```sh
 * docker run -d --name own-branding-test-pg \
 *   -e POSTGRES_PASSWORD=test -e POSTGRES_DB=own_branding_test -p 5599:5432 postgres:16-alpine
 * PGPORT=5599 PGPASSWORD=test pnpm --filter @pxlhut/brand-store-lucid test
 * ```
 */

import { AppFactory } from '@adonisjs/core/factories/app';
import { EmitterFactory } from '@adonisjs/core/factories/events';
import { LoggerFactory } from '@adonisjs/core/factories/logger';
import { Database } from '@adonisjs/lucid/database';
import type { DatabaseConfig } from '@adonisjs/lucid/types/database';

function connectionConfig(): DatabaseConfig {
  return {
    connection: 'postgres',
    connections: {
      postgres: {
        client: 'pg',
        connection: {
          host: process.env.PGHOST ?? '127.0.0.1',
          port: Number(process.env.PGPORT ?? 5432),
          user: process.env.PGUSER ?? 'postgres',
          password: process.env.PGPASSWORD ?? 'postgres',
          database: process.env.PGDATABASE ?? 'own_branding_test',
        },
      },
    },
  };
}

export function createTestDatabase(): Database {
  const app = new AppFactory().create(new URL('./', import.meta.url));
  const emitter = new EmitterFactory().create(app);
  const logger = new LoggerFactory().create();
  return new Database(connectionConfig(), logger, emitter);
}
