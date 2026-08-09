import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(projectRoot, "dist", "prototype");
mkdirSync(dirname(target), { recursive: true });
cpSync(resolve(projectRoot, "prototype"), target, { recursive: true, force: true });
console.log(`Copied offline gameplay prototype to ${target}`);
