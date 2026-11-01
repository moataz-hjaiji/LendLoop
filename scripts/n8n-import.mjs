// Imports credentials (from .env, over stdin) and workflows into n8n, then publishes them.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

process.loadEnvFile(".env");
const { env } = process;

const inContainer = (script, input) =>
  execFileSync("docker", ["compose", "exec", "-T", "n8n", "sh", "-c", script], {
    input,
    stdio: [input ? "pipe" : "ignore", "inherit", "inherit"],
  });

const credentials = [
  { id: "lendloopHmacOut", name: "LendLoop HMAC n8n to Convex", type: "crypto", data: { hmacSecret: env.N8N_TO_CONVEX_SECRET } },
  { id: "lendloopHmacIn", name: "LendLoop HMAC Convex to n8n", type: "crypto", data: { hmacSecret: env.CONVEX_TO_N8N_SECRET } },
];
inContainer(
  "umask 077; cat > /tmp/credentials.json; n8n import:credentials --input=/tmp/credentials.json; status=$?; rm -f /tmp/credentials.json; exit $status",
  JSON.stringify(credentials),
);
const convexSiteUrl = env.CONVEX_SITE_URL || "http://host.docker.internal:3211";
for (const name of readdirSync("n8n/workflows").filter((file) => file.endsWith(".json"))) {
  const workflow = readFileSync(`n8n/workflows/${name}`, "utf8").replaceAll("__CONVEX_SITE_URL__", convexSiteUrl);
  inContainer(
    "cat > /tmp/workflow.json; n8n import:workflow --input=/tmp/workflow.json; status=$?; rm -f /tmp/workflow.json; exit $status",
    workflow,
  );
}
for (const id of ["lendloopSignedReq", "lendloopErrorWf1", "lendloopNotify01", "lendloopOverdue1"]) {
  inContainer(`n8n publish:workflow --id=${id}`);
}
execFileSync("docker", ["compose", "restart", "n8n"], { stdio: "inherit" });
console.log("n8n is ready at http://localhost:5678");
