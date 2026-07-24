import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'apps/enchanted-notes-api/prisma/schema.prisma',
  migrations: {
    path: 'apps/enchanted-notes-api/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
