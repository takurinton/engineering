#!/usr/bin/env node

/**
 * Claude Code 評価基盤 - 実行スクリプト
 *
 * テストケース（YAML）→ Claude 実行 → LLM-as-Judge 採点 → auto-fix のサイクルで
 * .claude/ 設定を継続改善する。
 *
 * Usage:
 *   node .claude/evals/run.mjs                     # 全テストケース実行
 *   node .claude/evals/run.mjs --category skill-routing  # カテゴリ指定
 *   node .claude/evals/run.mjs --id sr-001         # 単一ケース指定
 *   node .claude/evals/run.mjs --dry-run           # 実行せずケース一覧表示
 *   node .claude/evals/run.mjs --auto-fix          # FAIL時にimprove-skillを自動実行
 */

import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, "cases");
const RESULTS_DIR = join(__dirname, "results");
const JUDGE_PROMPT_PATH = join(__dirname, "judge-prompt.md");
const PROJECT_ROOT = join(__dirname, "..", "..");

// --- YAML parser (minimal, supports our flat test-case format) ---
// 制約: 複数行文字列 (| / >) 非対応、ネスト深度2段まで。
// テストケースが複雑化した場合は js-yaml 等のライブラリへの移行を検討。

function parseYaml(text) {
  const cases = [];
  let current = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");

    if (line.startsWith("#") || line.trim() === "") continue;

    if (line.startsWith("- id:")) {
      if (current) {
        delete current._lastExpectedKey;
        cases.push(current);
      }
      current = { id: line.replace("- id:", "").trim(), expected: {} };
      continue;
    }

    if (!current) continue;

    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    if (indent === 2 && trimmed.startsWith("input:")) {
      current.input = trimmed
        .replace("input:", "")
        .trim()
        .replace(/^["']|["']$/g, "");
    } else if (indent === 2 && trimmed.startsWith("tags:")) {
      current.tags = parseInlineArray(trimmed.replace("tags:", "").trim());
    } else if (indent === 4 && current) {
      // expected fields
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      if (!key) continue;
      if (!value) {
        // key with no inline value — list follows on next lines
        current.expected[key] = [];
        current._lastExpectedKey = key;
      } else if (value.startsWith("[")) {
        current.expected[key] = parseInlineArray(value);
        current._lastExpectedKey = key;
      } else {
        current.expected[key] = value.replace(/^["']|["']$/g, "");
        current._lastExpectedKey = key;
      }
    } else if (indent === 6 && trimmed.startsWith("- ")) {
      // list item in expected
      const key = current._lastExpectedKey;
      if (key) {
        if (!Array.isArray(current.expected[key])) {
          current.expected[key] = [];
        }
        current.expected[key].push(
          trimmed.replace(/^- /, "").trim().replace(/^["']|["']$/g, "")
        );
      }
    }
  }

  if (current) {
    delete current._lastExpectedKey;
    cases.push(current);
  }

  // バリデーション: 必須フィールドが欠けているケースを警告
  for (const c of cases) {
    if (!c.input) {
      console.warn(`  Warning: case "${c.id}" is missing "input" field`);
    }
  }

  return cases;
}

function parseInlineArray(str) {
  return str
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

// --- Load test cases ---

function loadCases(options = {}) {
  const allCases = [];

  for (const category of readdirSync(CASES_DIR)) {
    const categoryDir = join(CASES_DIR, category);
    if (!statSync(categoryDir).isDirectory()) continue;

    for (const file of readdirSync(categoryDir)) {
      if (!file.endsWith(".yaml")) continue;
      const content = readFileSync(join(categoryDir, file), "utf-8");
      const cases = parseYaml(content);
      for (const c of cases) {
        c.category = category;
        c.file = file;
        allCases.push(c);
      }
    }
  }

  if (options.category) {
    return allCases.filter((c) => c.category === options.category);
  }
  if (options.id) {
    return allCases.filter((c) => c.id === options.id);
  }
  return allCases;
}

// --- Run a single test case ---

async function runCase(testCase) {
  console.log(`\n  Running: [${testCase.id}] ${testCase.input}`);

  const startTime = Date.now();

  try {
    // 被験者: プロジェクトディレクトリで実行（.claude設定が自動ロード）
    // --allowedTools で安全なツールのみ許可（ファイル変更・コマンド実行を防止）
    // --max-budget-usd で暴走防止
    // stdinでプロンプトを渡す
    const subjectResult = spawnSync(
      "claude",
      [
        "-p",
        "--output-format", "json",
        "--verbose",
        "--max-budget-usd", "0.50",
        "--allowedTools", "Read", "Glob", "Grep", "Skill",
        "--dangerously-skip-permissions",
      ],
      {
        cwd: PROJECT_ROOT,
        input: testCase.input,
        encoding: "utf-8",
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (subjectResult.status !== 0 && !subjectResult.stdout) {
      throw new Error(subjectResult.stderr?.slice(0, 500) || "Subject process failed");
    }

    const result = subjectResult.stdout;

    let messages;
    try {
      messages = JSON.parse(result);
    } catch {
      throw new Error(`Failed to parse claude output as JSON. Raw output starts with: ${result?.slice(0, 200)}`);
    }
    const extracted = extractFromMessages(messages);
    const durationMs = Date.now() - startTime;

    return {
      id: testCase.id,
      category: testCase.category,
      input: testCase.input,
      expected: testCase.expected,
      actual: extracted,
      raw_message_count: messages.length,
      duration_ms: durationMs,
      cost_usd: extracted.cost_usd,
      status: "executed",
    };
  } catch (err) {
    return {
      id: testCase.id,
      category: testCase.category,
      input: testCase.input,
      expected: testCase.expected,
      actual: null,
      error: err.message?.slice(0, 500),
      duration_ms: Date.now() - startTime,
      status: "error",
    };
  }
}

// --- Extract structured data from claude -p output ---

function extractFromMessages(messages) {
  const toolCalls = [];
  const skillCalls = [];
  const textResponses = [];
  const filesRead = [];
  let costUsd = 0;

  for (const msg of messages) {
    // Result message
    if (msg.type === "result") {
      costUsd = msg.total_cost_usd || 0;
      if (msg.result) textResponses.push(msg.result);
      continue;
    }

    const content = msg.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          name: block.name,
          input: block.input,
        });

        // Skill tool invocation
        if (block.name === "Skill") {
          skillCalls.push({
            skill: block.input?.skill,
            args: block.input?.args || null,
          });
        }

        // File reads
        if (block.name === "Read" && block.input?.file_path) {
          filesRead.push(block.input.file_path);
        }
        if (block.name === "Glob") {
          filesRead.push(`glob:${block.input?.pattern}`);
        }
        if (block.name === "Grep") {
          filesRead.push(`grep:${block.input?.pattern}`);
        }
      }

      if (block.type === "text" && block.text) {
        textResponses.push(block.text);
      }
    }
  }

  return {
    tool_calls: toolCalls,
    skill_calls: skillCalls,
    text_responses: textResponses,
    files_read: filesRead,
    cost_usd: costUsd,
  };
}

// --- Judge: LLM-as-Judge scoring ---

async function judgeResults(results) {
  const judgePrompt = readFileSync(JUDGE_PROMPT_PATH, "utf-8");

  const casesForJudge = results
    .filter((r) => r.status === "executed")
    .map((r) => ({
      id: r.id,
      category: r.category,
      input: r.input,
      expected: r.expected,
      actual: {
        skill_calls: r.actual.skill_calls,
        tool_calls: r.actual.tool_calls.map((t) => t.name),
        files_read: r.actual.files_read,
        text_summary: r.actual.text_responses
          .join("\n")
          .slice(0, 500),
      },
    }));

  const prompt = `${judgePrompt}\n\n## 評価対象データ\n\n\`\`\`json\n${JSON.stringify(casesForJudge, null, 2)}\n\`\`\``;

  console.log("\n  Judging results...");

  try {
    // stdinでプロンプトを渡す（シェル引数の長さ制限を回避）
    // Judgeはテキスト生成のみ — ツール不要なので全て無効化
    const result = spawnSync(
      "claude",
      [
        "-p",
        "--output-format", "json",
        "--bare",
        "--max-budget-usd", "0.50",
        "--tools", "",
        "--dangerously-skip-permissions",
      ],
      {
        cwd: PROJECT_ROOT,
        input: prompt,
        encoding: "utf-8",
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (result.status !== 0) {
      return { error: result.stderr?.slice(0, 500) || "Judge process failed" };
    }

    const resultOutput = result.stdout;

    let parsed;
    try {
      parsed = JSON.parse(resultOutput);
    } catch {
      return { error: `Failed to parse judge output as JSON. Raw output starts with: ${resultOutput?.slice(0, 200)}` };
    }
    // Judge output is in the result field
    const judgeText =
      parsed.result || (Array.isArray(parsed) ? parsed.at(-1)?.result : "");

    // Try to extract JSON from judge response
    const jsonMatch = judgeText.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try direct JSON parse
    try {
      return JSON.parse(judgeText);
    } catch {
      return { raw_judge_response: judgeText };
    }
  } catch (err) {
    return { error: err.message?.slice(0, 500) };
  }
}

// --- Auto-fix: FAILケースに基づいてimprove-skillを実行 ---

async function autoFix(scores) {
  const failedScores = scores?.scores?.filter((s) => !s.pass) || [];

  if (failedScores.length === 0) {
    console.log("\n  All cases passed — no auto-fix needed.");
    return null;
  }

  console.log(`\n--- Auto-fix: ${failedScores.length} FAIL cases detected ---`);

  // FAILケースから改善プロンプトを組み立てる
  const failSummary = failedScores
    .map((s) => {
      const missed = s.details?.expected_missed?.join(", ") || "N/A";
      return `- [${s.id}] score=${s.score}/5: ${s.reason} (missed: ${missed})`;
    })
    .join("\n");

  const recommendation = scores.summary?.recommendation || "";
  const weakestArea = scores.summary?.weakest_area || "";
  const avgScore = scores.summary?.average_score ?? "N/A";

  // improve-skillに渡すフィードバックを構築
  const feedbackRating = Math.round(avgScore);
  const feedbackText = [
    `評価基盤の自動テスト結果に基づく改善要求。`,
    ``,
    `平均スコア: ${avgScore}/5`,
    `最も弱い領域: ${weakestArea}`,
    ``,
    `## FAILしたケース`,
    ``,
    failSummary,
    ``,
    `## 改善提案`,
    ``,
    recommendation,
    ``,
    `## 対応方針`,
    ``,
    `上記のFAILケースを分析し、該当するSKILL.mdのdescription・手順・トリガー条件を`,
    `より明確にすることでスキル呼び出しの精度を向上させてください。`,
    `settings.jsonのskill descriptionも必要に応じて更新してください。`,
  ].join("\n");

  const improvePrompt = `/improve-skill ${feedbackRating} ${feedbackText}`;

  console.log(`\n  Feedback rating: ${feedbackRating}/5`);
  console.log(`  Running improve-skill...\n`);

  try {
    // auto-fixはファイル編集・git操作・PR作成を行うため全ツールが必要。
    // --allowedTools による制限は意図的に行わない。
    const result = spawnSync(
      "claude",
      [
        "-p",
        "--output-format", "json",
        "--verbose",
        "--max-budget-usd", "2.00",
        "--dangerously-skip-permissions",
      ],
      {
        cwd: PROJECT_ROOT,
        input: improvePrompt,
        encoding: "utf-8",
        timeout: 600_000, // 10 min — PRの作成まで含むため長め
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (result.status !== 0 && !result.stdout) {
      console.log(`  Auto-fix error: ${result.stderr?.slice(0, 300)}`);
      return { error: result.stderr?.slice(0, 500) };
    }

    let messages;
    try {
      messages = JSON.parse(result.stdout);
    } catch {
      console.log(`  Auto-fix: failed to parse output. Raw: ${result.stdout?.slice(0, 200)}`);
      return { error: `Failed to parse auto-fix output as JSON. Raw: ${result.stdout?.slice(0, 200)}` };
    }
    const lastResult = messages.find((m) => m.type === "result");
    const output = lastResult?.result || "";

    console.log(`  Auto-fix complete.`);
    console.log(`  Output: ${output.slice(0, 500)}`);

    return {
      feedback_rating: feedbackRating,
      failed_cases: failedScores.map((s) => s.id),
      improve_skill_output: output.slice(0, 2000),
      cost_usd: lastResult?.total_cost_usd || 0,
    };
  } catch (err) {
    console.log(`  Auto-fix error: ${err.message?.slice(0, 300)}`);
    return { error: err.message?.slice(0, 500) };
  }
}

// --- Compare: auto-fix前後の結果を比較 ---

function runCompare() {
  console.log("\n--- Comparing before/after auto-fix ---");
  try {
    const comparePath = join(__dirname, "compare.mjs");
    const output = execFileSync("node", [comparePath], {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    });
    console.log(output);
  } catch (err) {
    console.log(`  Compare failed: ${err.message?.slice(0, 300)}`);
  }
}

// --- Utility ---

function printSummary(results, scores) {
  console.log("\n========================================");
  console.log("  Evaluation Summary");
  console.log("========================================\n");

  const executed = results.filter((r) => r.status === "executed");
  const errors = results.filter((r) => r.status === "error");

  console.log(`  Total cases:    ${results.length}`);
  console.log(`  Executed:       ${executed.length}`);
  console.log(`  Errors:         ${errors.length}`);

  const totalCost = executed.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  console.log(`  Total cost:     $${totalCost.toFixed(4)}`);

  if (scores?.scores) {
    console.log("\n  --- Scores by case ---\n");
    for (const s of scores.scores) {
      const icon = s.pass ? "PASS" : "FAIL";
      console.log(`  [${icon}] ${s.id}: ${s.score}/5 - ${s.reason}`);
    }

    const avg =
      scores.scores.reduce((sum, s) => sum + s.score, 0) /
      scores.scores.length;
    const passRate =
      scores.scores.filter((s) => s.pass).length / scores.scores.length;
    console.log(`\n  Average score:  ${avg.toFixed(2)} / 5`);
    console.log(
      `  Pass rate:      ${(passRate * 100).toFixed(1)}% (${scores.scores.filter((s) => s.pass).length}/${scores.scores.length})`
    );
  }

  if (errors.length > 0) {
    console.log("\n  --- Errors ---\n");
    for (const e of errors) {
      console.log(`  [${e.id}] ${e.error?.slice(0, 100)}`);
    }
  }

  console.log("");
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) options.category = args[++i];
    if (args[i] === "--id" && args[i + 1]) options.id = args[++i];
    if (args[i] === "--dry-run") options.dryRun = true;
    if (args[i] === "--no-judge") options.noJudge = true;
    if (args[i] === "--auto-fix") options.autoFix = true;
  }

  const cases = loadCases(options);
  console.log(`\nLoaded ${cases.length} test cases`);

  if (options.dryRun) {
    for (const c of cases) {
      console.log(`  [${c.id}] (${c.category}) ${c.input}`);
    }
    return;
  }

  if (cases.length === 0) {
    console.log("No test cases found.");
    return;
  }

  // Execute test cases sequentially
  console.log("\n--- Executing test cases ---");
  const results = [];
  for (const c of cases) {
    const result = await runCase(c);
    results.push(result);
  }

  // Judge
  let scores = null;
  if (!options.noJudge) {
    console.log("\n--- Judging ---");
    scores = await judgeResults(results);
  }

  // Auto-fix: FAILケースがあればimprove-skillを実行
  let fixResult = null;
  let verifyResults = null;
  let verifyScores = null;
  if (options.autoFix && scores?.scores?.some((s) => !s.pass)) {
    fixResult = await autoFix(scores);

    // Auto-fix成功後、再度evalsを実行して改善を検証
    if (fixResult && !fixResult.error) {
      console.log("\n--- Verifying improvement: re-running evals ---");
      const verifyCases = loadCases(options);
      verifyResults = [];
      for (const c of verifyCases) {
        const result = await runCase(c);
        verifyResults.push(result);
      }

      console.log("\n--- Verifying improvement: judging ---");
      verifyScores = await judgeResults(verifyResults);
    }
  }

  // Save results (pre-fix)
  mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = join(RESULTS_DIR, `${timestamp}.json`);
  writeFileSync(
    outputPath,
    JSON.stringify({ timestamp, results, scores, fix: fixResult }, null, 2)
  );
  console.log(`\nResults saved to: ${outputPath}`);

  // Save verify results (post-fix)
  if (verifyResults) {
    const verifyTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const verifyOutputPath = join(RESULTS_DIR, `${verifyTimestamp}.json`);
    writeFileSync(
      verifyOutputPath,
      JSON.stringify({ timestamp: verifyTimestamp, results: verifyResults, scores: verifyScores }, null, 2)
    );
    console.log(`Verify results saved to: ${verifyOutputPath}`);
  }

  // Print summary
  printSummary(results, scores);

  // Auto-fix後: 比較表示
  if (verifyScores) {
    console.log("\n  === Post-fix verification ===");
    printSummary(verifyResults, verifyScores);
    runCompare();
  } else if (fixResult && !fixResult.error) {
    console.log("  Auto-fix ran improve-skill and created a PR.");
    console.log("  Verification re-run was skipped.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
