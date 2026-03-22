#!/usr/bin/env node

/**
 * 評価結果の比較スクリプト
 *
 * Usage:
 *   node .claude/evals/compare.mjs                          # 直近2回を比較
 *   node .claude/evals/compare.mjs <result1.json> <result2.json>  # 指定ファイルを比較
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");

function loadResult(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function getLatestResults(count = 2) {
  const files = readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, count)
    .reverse();

  return files.map((f) => ({
    file: f,
    data: loadResult(join(RESULTS_DIR, f)),
  }));
}

function compare(before, after) {
  console.log("\n========================================");
  console.log("  Evaluation Comparison");
  console.log("========================================\n");
  console.log(`  Before: ${before.file}`);
  console.log(`  After:  ${after.file}\n`);

  const beforeScores = before.data.scores?.scores || [];
  const afterScores = after.data.scores?.scores || [];

  if (beforeScores.length === 0 || afterScores.length === 0) {
    console.log("  No scores to compare (judge may not have run).");
    return;
  }

  const beforeMap = new Map(beforeScores.map((s) => [s.id, s]));
  const afterMap = new Map(afterScores.map((s) => [s.id, s]));

  const allIds = [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort();

  console.log("  ID            Before  After   Delta");
  console.log("  ---           ------  -----   -----");

  let totalBefore = 0;
  let totalAfter = 0;
  let count = 0;
  const improved = [];
  const regressed = [];

  for (const id of allIds) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);
    const bScore = b?.score ?? "-";
    const aScore = a?.score ?? "-";
    const delta =
      typeof bScore === "number" && typeof aScore === "number"
        ? aScore - bScore
        : null;

    const deltaStr =
      delta === null ? "  -" : delta > 0 ? ` +${delta}` : ` ${delta}`;
    const icon =
      delta === null ? " " : delta > 0 ? "+" : delta < 0 ? "-" : "=";

    console.log(
      `  [${icon}] ${id.padEnd(10)} ${String(bScore).padEnd(6)}  ${String(aScore).padEnd(6)}  ${deltaStr}`
    );

    if (typeof bScore === "number") totalBefore += bScore;
    if (typeof aScore === "number") totalAfter += aScore;
    if (delta !== null) count++;
    if (delta > 0) improved.push(id);
    if (delta < 0) regressed.push(id);
  }

  if (count > 0) {
    console.log(
      `\n  Average: ${(totalBefore / count).toFixed(2)} → ${(totalAfter / count).toFixed(2)}`
    );

    const beforePass = beforeScores.filter((s) => s.pass).length;
    const afterPass = afterScores.filter((s) => s.pass).length;
    console.log(
      `  Pass rate: ${beforePass}/${beforeScores.length} → ${afterPass}/${afterScores.length}`
    );
  }

  if (improved.length > 0) {
    console.log(`\n  Improved: ${improved.join(", ")}`);
  }
  if (regressed.length > 0) {
    console.log(`\n  Regressed: ${regressed.join(", ")}`);
  }

  console.log("");
}

// --- Main ---

const args = process.argv.slice(2);

if (args.length === 2) {
  compare(
    { file: args[0], data: loadResult(args[0]) },
    { file: args[1], data: loadResult(args[1]) }
  );
} else {
  const results = getLatestResults(2);
  if (results.length < 2) {
    console.log("Need at least 2 result files to compare. Run evals first.");
    process.exit(1);
  }
  compare(results[0], results[1]);
}
