/**
 * Runs before `npm run dev` (via "predev" in package.json).
 * Finds and kills any process still listening on PORT (default 5001)
 * so nodemon never hits EADDRINUSE on Windows.
 */

const { execSync } = require("child_process");
const { config } = require("dotenv");
const path = require("path");

// Load .env so we read the real PORT value (quiet: true suppresses the dotenv log line)
config({ path: path.join(__dirname, "../.env"), quiet: true });

const port = parseInt(process.env.PORT || "5001", 10);

try {
  // Ask PowerShell for the PID(s) owning that port
  const out = execSync(
    `powershell -NoProfile -Command "` +
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen ` +
      `-ErrorAction SilentlyContinue).OwningProcess"`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
  ).trim();

  if (!out) {
    console.log(`[predev] Port ${port} is free — starting backend.`);
    process.exit(0);
  }

  const pids = [...new Set(out.split(/\r?\n/).map((p) => p.trim()).filter(Boolean))];

  pids.forEach((pid) => {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      console.log(`[predev] Killed stale process PID ${pid} on port ${port}.`);
    } catch {
      // Already gone
    }
  });
} catch {
  // Port is free — nothing to kill
  console.log(`[predev] Port ${port} is free — starting backend.`);
}
