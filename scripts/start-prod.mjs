// Production entry point: run migrations, then start the website and the
// worker side by side in one container, so both see the same upload folder.
// If either process stops, stop the other and exit with an error, so the host
// restarts the whole container instead of leaving half the app running.
import { spawn } from "node:child_process";

function run(name, command, args) {
  const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => {
    console.error(`[start] ${name} exited with code ${code}`);
    shutdown(code === 0 ? 1 : code ?? 1);
  });
  return child;
}

const children = [];
function shutdown(code) {
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

// Migrations must finish before anything touches the database.
const migrate = spawn("npm", ["run", "migrate"], { stdio: "inherit", shell: process.platform === "win32" });
migrate.on("exit", (code) => {
  if (code !== 0) {
    console.error("[start] migrations failed, not starting");
    process.exit(code ?? 1);
  }
  children.push(run("web", "npx", ["next", "start"])); // listens on $PORT
  // Next.js loads .env files itself; the worker needs the flag. On a host
  // there's no .env.local and the variables come from the host's settings.
  children.push(
    run("worker", "node", ["--env-file-if-exists=.env.local", "--import", "tsx", "worker/index.ts"]),
  );
});
