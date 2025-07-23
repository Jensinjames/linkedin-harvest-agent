// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL not set. Create .env and export it for CLI runs.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './shared/schema.ts',   // update if your schema path differs
  out: './drizzle',               // or ./migrations if you prefer
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
