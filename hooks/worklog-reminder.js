#!/usr/bin/env node
"use strict";

/**
 * Stop hook: nudge the agent to consider the work-log skill when a turn ends
 * after substantive work, but the work was never logged.
 *
 * Why this exists: work-log is a proactive, self-invoked skill — nothing fires
 * it, so it depends on the agent *remembering* at end of work, which fails once
 * context fills (observed: a 3-file cleanup went unlogged until the user asked).
 * This hook is the missing completion-time trigger. It carries NO logging logic
 * — it only injects a one-line reminder. The skill still judges worth-it-or-skip
 * and writes the line.
 *
 * Reliability guards (any one short-circuits to a clean stop):
 *   1. stop_hook_active  — we're already continuing from a prior nudge; bail to
 *      avoid an infinite stop→nudge→stop loop.
 *   2. already logged     — the work-log skill was already invoked this session.
 *   3. no substantive work — no Edit/Write/NotebookEdit in the transcript.
 *   4. already nudged      — we reminded once for this session; don't nag again.
 *
 * This hook is best-effort. It MUST NOT break a session: every path that isn't a
 * deliberate nudge exits 0, and all IO is wrapped.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const WORKLOG_DIR = path.join(os.homedir(), ".claude", "work-log");
const NUDGED_FILE = path.join(WORKLOG_DIR, ".nudged-sessions");

// Tool calls that signal real work landed and may be worth logging.
const WORK_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

// Substring identifying the work-log skill. Only meaningful inside a `Skill`
// tool_use's input — NOT as a bare transcript substring: the skill's name is
// injected into every session's context as an available skill (a system-reminder
// "attachment"), so a plain `line.includes()` is true even when nothing was
// logged, which would suppress every nudge. Match the actual invocation only.
const WORKLOG_SKILL = "work-log";

// True only for a real `Skill` tool_use that invoked work-log.
function isWorklogInvocation(block) {
  if (!block || block.type !== "tool_use" || block.name !== "Skill") return false;
  const skill = block.input && block.input.skill;
  return typeof skill === "string" && skill.includes(WORKLOG_SKILL);
}

// Shown to the agent (and surfaced to the user). Claude Code prefixes blocking
// Stop-hook output with "Stop hook error:" — a label we can't change from here —
// so the body leads by saying it's a benign reminder, not a failure.
const NUDGE =
  "Reminder, not an error — this is the work-log nudge. Substantive edits landed " +
  "this session but the work-log skill hasn't recorded them yet. If the work is " +
  "worth remembering, invoke the work-log skill now to log one line; if it was " +
  "trivial (a lookup, a question, abandoned work), just stop — nothing is wrong.";

// An explicit next action for the agent to act on while continuing.
const NUDGE_CONTEXT =
  "Invoke the pkvillanueva:work-log skill to record this session, then stop. " +
  "If the work was trivial, stop without logging — both are fine.";

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0); // unreadable payload — never block the stop
  }

  // Guard 1: already continuing from a stop-hook nudge — don't loop.
  if (input.stop_hook_active) process.exit(0);

  const sessionId = input.session_id || "";
  const transcriptPath = input.transcript_path;

  // Guard 4: we already reminded for this session.
  if (sessionId && alreadyNudged(sessionId)) process.exit(0);

  if (!transcriptPath || !safeExists(transcriptPath)) process.exit(0);

  const { didWork, didLog } = scanTranscript(transcriptPath);

  // Guard 2 + 3: nothing worth logging, or already logged.
  if (!didWork || didLog) process.exit(0);

  // All guards passed — nudge once, record it, and block the stop so the agent
  // gets the reminder in-context.
  markNudged(sessionId);
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: NUDGE,
      hookSpecificOutput: { hookEventName: "Stop", additionalContext: NUDGE_CONTEXT },
    }),
  );
  process.exit(0);
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function safeExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Single pass over the transcript JSONL. Returns whether a work tool was used
 * (Edit/Write/NotebookEdit) and whether the work-log skill was already invoked.
 * Sidechain (subagent) entries are ignored — only the main session counts.
 */
function scanTranscript(transcriptPath) {
  let didWork = false;
  let didLog = false;
  try {
    const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
    for (const line of lines) {
      if (didWork && didLog) break; // both known — stop scanning
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.isSidechain) continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || block.type !== "tool_use") continue;
        if (WORK_TOOLS.has(block.name)) didWork = true;
        else if (isWorklogInvocation(block)) didLog = true;
      }
    }
  } catch {
    // unreadable transcript — treat as "nothing to nudge about"
  }
  return { didWork, didLog };
}

function alreadyNudged(sessionId) {
  try {
    if (!fs.existsSync(NUDGED_FILE)) return false;
    return fs.readFileSync(NUDGED_FILE, "utf8").split("\n").includes(sessionId);
  } catch {
    return false;
  }
}

function markNudged(sessionId) {
  if (!sessionId) return;
  try {
    fs.mkdirSync(WORKLOG_DIR, { recursive: true });
    fs.appendFileSync(NUDGED_FILE, `${sessionId}\n`);
  } catch {
    // marker is best-effort; worst case we nudge once more next stop
  }
}

main();
