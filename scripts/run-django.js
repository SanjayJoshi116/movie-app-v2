#!/usr/bin/env node
// Starts backend/start.py with the developer's Python, for `npm run dev`,
// `npm start` and `npm run django`. The interpreter comes from DJANGO_PYTHON:
// the shell environment first, then the untracked root .env, else `python`.
// It must be the env with the pinned backend requirements: a base Python with
// another Django writes migrations for the wrong version (see .env.example).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/** DJANGO_PYTHON from the root .env, or undefined. Only that one key is read. */
function fromDotEnv() {
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  } catch {
    return undefined;
  }
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\s*(?:export\s+)?DJANGO_PYTHON\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const value = match[1].replace(/^(["'])(.*)\1$/, "$2");
    return value || undefined;
  }
  return undefined;
}

const configured = process.env.DJANGO_PYTHON || fromDotEnv();
const python = configured || "python";
console.log(`[django] using ${python}${configured ? " (DJANGO_PYTHON)" : " (DJANGO_PYTHON not set)"}`);

const child = spawn(python, [path.join("backend", "start.py"), ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error(
      `[django] DJANGO_PYTHON=${python} was not found. Set DJANGO_PYTHON in the root .env ` +
        "to the Python of the environment with the backend requirements (see .env.example).",
    );
  } else {
    console.error(`[django] couldn't start ${python}: ${err.message}`);
  }
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
