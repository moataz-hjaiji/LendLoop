// Copies only the variables Convex needs from .env to the Convex deployment.
import { execFileSync } from "node:child_process";

const NEEDED = [
  "CLERK_JWT_ISSUER_DOMAIN",
  "N8N_REQUEST_WEBHOOK_URL",
  "CONVEX_TO_N8N_SECRET",
  "N8N_TO_CONVEX_SECRET",
];
process.loadEnvFile(".env");
const { env } = process;
for (const name of NEEDED) {
  if (!env[name]) {
    console.error(`${name} is empty in .env`);
    process.exit(1);
  }
  execFileSync("npx", ["convex", "env", "set", name, env[name]], { stdio: "ignore" });
  console.log(`Set ${name}`);
}
