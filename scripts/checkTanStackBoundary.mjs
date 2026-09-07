import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = join(repositoryRoot, "src");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const nextImportPattern =
  /\b(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](?:next(?:\/[^"']*)?|@clerk\/nextjs(?:\/[^"']*)?)["']/g;
const violations = [];

for (const filePath of walk(sourceRoot)) {
  if (!sourceExtensions.has(extname(filePath))) {
    continue;
  }

  const source = readFileSync(filePath, "utf8");
  const matches = source.match(nextImportPattern);

  if (matches) {
    violations.push({
      file: relative(repositoryRoot, filePath),
      imports: matches,
    });
  }
}

if (violations.length > 0) {
  console.error("TanStack source files must not import the Next runtime:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.imports.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log("TanStack runtime boundary is free of Next imports.");
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}
