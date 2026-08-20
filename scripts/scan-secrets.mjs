import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["app", "components", "constants", "hooks", "lib", "server", "shared", "scripts", "runner", "docs"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".yml", ".yaml"]);
const assignment = /\b(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?([A-Za-z0-9_\-]{24,})/gi;
const ignored = /^(example|placeholder|changeme|your[_-]?(?:token|key|secret)|test[_-]?(?:token|key|secret))$/i;
const findings = [];

async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) await visit(next);
    else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      const content = await readFile(next, "utf8");
      for (const match of content.matchAll(assignment)) {
        const value = match[2] ?? "";
        if (!ignored.test(value)) findings.push(`${next}: credential-like literal for ${match[1]}`);
      }
    }
  }
}

for (const root of roots) await visit(root);
if (findings.length) {
  console.error("Potential committed secrets detected:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("Secret scan passed: no credential-like literals found.");
