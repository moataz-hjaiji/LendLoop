// Loads credentials and workflows into the running n8n container, then publishes them.
// Credentials come from .env over stdin, so secrets never appear in a file in this repo.
import { execFileSync } from "node:child_process";

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
inContainer("n8n import:workflow --separate --input=/workflows");
for (const id of ["lendloopSignedReq", "lendloopErrorWf1", "lendloopNotify01", "lendloopOverdue1"]) {
  inContainer(`n8n publish:workflow --id=${id}`);
}
execFileSync("docker", ["compose", "restart", "n8n"], { stdio: "inherit" });
console.log("n8n is ready at http://localhost:5678");
