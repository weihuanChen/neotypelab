import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  parsePaintCatalogCsv,
  type PaintCatalogImportIssue,
  type PaintCatalogImportRecord,
} from "@/lib/paintCatalogImport";

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);
  const fileArg = positionalFileArg(args);
  const write = args.includes("--write");
  const previewDatabase = args.includes("--preview-db");
  const confirmed = args.includes("--yes");
  const push = args.includes("--push");
  const production = args.includes("--prod");
  const deploymentArg = optionValue(args, "--deployment");

  if (!fileArg || args.includes("--help")) {
    printUsage();
    process.exitCode = fileArg ? 0 : 1;
    return;
  }
  if (write && !confirmed) {
    throw new Error("Refusing to write without --yes. Run the default dry-run first.");
  }
  if (write && previewDatabase) {
    throw new Error("Choose either --write or --preview-db, not both.");
  }

  const filePath = resolve(fileArg);
  const csvText = await readFile(filePath, "utf8");
  const result = parsePaintCatalogCsv(csvText);
  printLocalReport(
    filePath,
    result.rowCount,
    result.records.length,
    result.errors,
    result.warnings
  );

  if (result.errors.length > 0) {
    throw new Error("Import blocked. Fix all validation errors and run the dry-run again.");
  }
  if (!write && !previewDatabase) {
    console.log("Dry-run complete. No database calls were made.");
    return;
  }

  const databaseResult = runDatabaseBatches(result.records, {
    dryRun: !write,
    push,
    production,
    deployment: deploymentArg,
  });
  console.log(JSON.stringify(databaseResult, null, 2));
  console.log(
    write ? "Import complete." : "Database preview complete. No records were written."
  );
}

function runDatabaseBatches(
  records: PaintCatalogImportRecord[],
  options: {
    dryRun: boolean;
    push: boolean;
    production: boolean;
    deployment?: string;
  }
) {
  const batchSize = 50;
  const batches = Array.from(
    { length: Math.ceil(records.length / batchSize) },
    (_, index) => records.slice(index * batchSize, (index + 1) * batchSize)
  );
  const results = batches.map((batch, index) => {
    const commandArgs = [
      "run",
      "paintCatalogImport:importBatch",
      JSON.stringify({ records: batch, dryRun: options.dryRun }),
      "--typecheck=disable",
      "--codegen=disable",
    ];
    if (options.push && index === 0) commandArgs.push("--push");
    if (options.production) commandArgs.push("--prod");
    if (options.deployment) commandArgs.push("--deployment", options.deployment);
    const execution = spawnSync("node_modules/.bin/convex", commandArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (execution.status !== 0) {
      throw new Error(
        execution.stderr.trim() || execution.stdout.trim() || `Batch ${index + 1} failed`
      );
    }
    return JSON.parse(execution.stdout);
  });
  return {
    dryRun: options.dryRun,
    batches: results.length,
    processed: results.reduce((total, batch) => total + batch.processed, 0),
    results,
  };
}

function printLocalReport(
  filePath: string,
  rowCount: number,
  validRecords: number,
  errors: PaintCatalogImportIssue[],
  warnings: PaintCatalogImportIssue[]
) {
  console.log(
    JSON.stringify(
      {
        file: filePath,
        rowCount,
        validRecords,
        errorCount: errors.length,
        warningCount: warnings.length,
        errorsByCode: countIssues(errors),
        warningsByCode: countIssues(warnings),
      },
      null,
      2
    )
  );
  printIssueSamples("Errors", errors);
  printIssueSamples("Warnings", warnings);
}

function printIssueSamples(label: string, issues: PaintCatalogImportIssue[]) {
  if (issues.length === 0) return;
  console.log(`${label} (first ${Math.min(20, issues.length)}):`);
  for (const issue of issues.slice(0, 20)) {
    const field = issue.field ? ` ${issue.field}` : "";
    console.log(`  row ${issue.row}${field} [${issue.code}] ${issue.message}`);
  }
}

function countIssues(issues: PaintCatalogImportIssue[]) {
  return Object.fromEntries(
    Array.from(
      issues.reduce((counts, issue) => {
        counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())
    ).sort(([left], [right]) => left.localeCompare(right))
  );
}

function optionValue(values: string[], option: string) {
  const index = values.indexOf(option);
  return index === -1 ? undefined : values[index + 1];
}

function positionalFileArg(values: string[]) {
  const deploymentIndex = values.indexOf("--deployment");
  return values.find(
    (value, index) =>
      !value.startsWith("--") &&
      (deploymentIndex === -1 || index !== deploymentIndex + 1)
  );
}

function printUsage() {
  console.log(`Usage:
  npm run import:paint-catalog -- <catalog.csv>
  npm run import:paint-catalog -- <catalog.csv> --preview-db [--push]
  npm run import:paint-catalog -- <catalog.csv> --write --yes [--push]

Options:
  --preview-db        Compare valid rows with the selected Convex deployment
  --write --yes       Upsert valid rows into the selected Convex deployment
  --push              Push local Convex functions before the first database batch
  --prod              Use the production deployment
  --deployment NAME   Use an explicit Convex deployment`);
}
