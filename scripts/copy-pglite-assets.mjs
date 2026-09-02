#!/usr/bin/env node
/**
 * Nitro traces the PGLite JS but not the sibling wasm/data files that
 * `import.meta.url` loads at runtime. Copy them next to the bundled module so
 * `vite preview` (no DATABASE_URL) can boot the same fallback as dev.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules/@electric-sql/pglite/dist");
const FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];
const OUTPUT = join(ROOT, ".vercel/output");

// Deployed apps (Vercel) run on a real Postgres via DATABASE_URL — the embedded
// PGLite fallback is never loaded there, so there is nothing to copy. Skip
// gracefully instead of failing the build (the source dir does not exist).
if (!existsSync(SRC)) {
  console.log("[copy-pglite-assets] PGLite not installed — skipping.");
  process.exit(0);
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.includes("electric-sql__pglite") || name === "pglite.mjs") acc.push(p);
  }
  return acc;
}

const dests = new Set();
for (const found of walk(OUTPUT)) dests.add(dirname(found));
dests.add(join(OUTPUT, "functions/__server.func/_libs"));

let copied = 0;
for (const dest of dests) {
  mkdirSync(dest, { recursive: true });
  for (const file of FILES) {
    const from = join(SRC, file);
    if (!existsSync(from)) {
      console.warn(`[copy-pglite-assets] missing ${from}`);
      continue;
    }
    copyFileSync(from, join(dest, file));
    copied += 1;
  }
}

console.log(`[copy-pglite-assets] copied ${FILES.length} files into ${dests.size} dir(s)`);
