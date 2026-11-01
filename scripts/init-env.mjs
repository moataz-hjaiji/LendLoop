// Creates .env from .env.example, filling blank secrets with random values.
// Never overwrites an existing .env, and never prints a secret.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (existsSync(".env")) {
  console.log(".env already exists, leaving it alone.");
  process.exit(0);
}
const SECRETS = ["N8N_ENCRYPTION_KEY", "CONVEX_TO_N8N_SECRET", "N8N_TO_CONVEX_SECRET"];
let output = readFileSync(".env.example", "utf8");
for (const name of SECRETS) {
  output = output.replace(new RegExp(`^${name}=$`, "m"), `${name}=${randomBytes(32).toString("hex")}`);
}
writeFileSync(".env", output, { mode: 0o600 });
console.log("Created .env with fresh random secrets. Now set CLERK_JWT_ISSUER_DOMAIN in it.");
