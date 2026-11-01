// Run before committing: fails if a secret could have reached the repository.
//   1. No secret from .env or .env.local appears in any file git would commit.
//   2. Workflow exports hold credential references only, and never read $env.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const problems = [];

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((file) => file && existsSync(file));

const secrets = [".env", ".env.local"]
  .filter((file) => existsSync(file))
  .flatMap((file) => readFileSync(file, "utf8").split("\n"))
  .filter((line) => /^(?!NEXT_PUBLIC_)[A-Z0-9_]*(SECRET|KEY)=.+/.test(line))
  .map((line) => line.slice(line.indexOf("=") + 1));
for (const file of files) {
  const text = readFileSync(file);
  if (secrets.some((secret) => text.includes(secret))) problems.push(`${file}: contains a secret value`);
}

for (const name of readdirSync("n8n/workflows")) {
  const file = `n8n/workflows/${name}`;
  const raw = readFileSync(file, "utf8");
  if (/\$env\b/.test(raw)) problems.push(`${file}: reads $env`);
  if (/hmacSecret/i.test(raw)) problems.push(`${file}: mentions hmacSecret`);
  // A long hex or base64 run is what a pasted secret looks like.
  if (/[A-Fa-f0-9]{40,}|[A-Za-z0-9+/]{48,}={0,2}/.test(raw)) problems.push(`${file}: contains a long token`);
  // n8n's CLI exports an array, while the committed files hold a single workflow.
  for (const workflow of [JSON.parse(raw)].flat()) {
    for (const node of workflow.nodes) {
      for (const [type, credential] of Object.entries(node.credentials ?? {})) {
        const keys = Object.keys(credential).sort().join();
        if (keys !== "id,name") problems.push(`${file}: credential ${type} on "${node.name}" has fields: ${keys}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Clean: scanned ${files.length} files and the workflow exports.`);
