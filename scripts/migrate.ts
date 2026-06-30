// Standalone migration runner. Run locally or on Railway:
//   npm run migrate            (uses DATABASE_URL from env or .env)
//   railway run npm run migrate
import { migrate, pool } from "../src/db.ts";

try {
  (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
} catch {
  /* env may be set another way */
}

await migrate();
await pool?.end();
console.log("✓ migración completa.");
