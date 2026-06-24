#!/usr/bin/env node
"use strict";

/**
 * TaskCompleted hook: append a line to a per-day work log at
 * ~/.claude/work-log/<YYYY-MM-DD>.md every time a task is marked complete.
 *
 * Why TaskCompleted instead of SessionEnd: SessionEnd only fires on a *clean*
 * exit, so a crash / `kill -9` / closed terminal loses the log entirely, and it
 * also false-fires on `/clear`. TaskCompleted fires synchronously the moment a
 * unit of work finishes, mid-session, so completed work is captured no matter
 * how the session later dies.
 *
 * Granularity: one log line per completed task. The task's own description is
 * the summary when the payload carries it (instant, no LLM); otherwise we fall
 * back to a cheap `claude -p` summary of the recent transcript tail. That
 * nested call would itself complete tasks in its own session, so we guard
 * against recursion with an env var.
 *
 * CRITICAL: TaskCompleted blocks the task from being marked complete on exit 2.
 * This hook is best-effort logging — it MUST NEVER exit non-zero. Every path
 * exits 0.
 *
 * Self-correcting: TaskCompleted's task-specific payload fields are undocumented,
 * so each fire appends its raw payload to .task-payloads.jsonl (capped) until we
 * confirm the real field names from live data and can tighten extraction.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Recursion guard: the nested `claude -p` we may spawn sets this var, so any
// TaskCompleted it triggers becomes a no-op. Must be the very first thing we do.
if (process.env.CLAUDE_WORKLOG_ACTIVE) process.exit(0);

const WORKLOG_DIR = path.join(os.homedir(), ".claude", "work-log");
const LOGGED_FILE = path.join(WORKLOG_DIR, ".logged-tasks");
const PAYLOAD_DEBUG_FILE = path.join(WORKLOG_DIR, ".task-payloads.jsonl");
const MODEL = "claude-haiku-4-5";

// Cap the payload-capture file so it can't grow without bound. Once we've seen
// enough real payloads to confirm the schema, this capture can be removed.
const MAX_DEBUG_PAYLOADS = 50;

// Keep the digest small so the fallback summarizer call stays cheap and fast.
const MAX_DIGEST_CHARS = 6000;
const MAX_MESSAGE_CHARS = 1000;
const MIN_DIGEST_CHARS = 120; // below this the tail is too thin to summarize

// Common fields present on every hook payload — never the task description.
const COMMON_FIELDS = new Set([
  "session_id",
  "transcript_path",
  "cwd",
  "permission_mode",
  "hook_event_name",
  "agent_id",
  "agent_type",
]);

function main() {
  try {
    const input = JSON.parse(readStdin() || "{}");
    capturePayload(input); // best-effort schema discovery; never throws fatally

    const project = input.cwd ? path.basename(input.cwd) : "unknown";
    const transcriptPath = input.transcript_path;

    // The task description is the ideal log line — instant, no LLM. Field name
    // is undocumented, so pull the best human-readable string from the payload.
    let summary = extractTaskDescription(input);

    // Fall back to summarizing the recent transcript tail only if the payload
    // gave us nothing usable.
    if (!summary && transcriptPath && fs.existsSync(transcriptPath)) {
      const messages = readTranscript(transcriptPath);
      const digest = buildDigest(messages);
      if (digest.length >= MIN_DIGEST_CHARS) {
        summary = summarize(digest) || fallbackSummary(messages);
      }
    }

    if (!summary) process.exit(0); // nothing worth logging

    const key = dedupeKey(input.session_id || "", summary);
    if (alreadyLogged(key)) process.exit(0);

    appendEntry(summary, project);
    markLogged(key);
  } catch {
    // Best-effort logging must never block a task from completing.
  }
  process.exit(0);
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Append the raw payload to a capped debug file so we can confirm the real
// TaskCompleted schema from live data, then tighten extractTaskDescription.
function capturePayload(input) {
  try {
    fs.mkdirSync(WORKLOG_DIR, { recursive: true });
    let count = 0;
    if (fs.existsSync(PAYLOAD_DEBUG_FILE)) {
      count = fs.readFileSync(PAYLOAD_DEBUG_FILE, "utf8").split("\n").filter(Boolean).length;
    }
    if (count < MAX_DEBUG_PAYLOADS) {
      fs.appendFileSync(PAYLOAD_DEBUG_FILE, JSON.stringify(input) + "\n");
    }
  } catch {
    // capture is purely diagnostic — ignore any failure
  }
}

/**
 * The task description lives under an undocumented key. Heuristic: scan the
 * payload's own (non-common) string fields and pick the most descriptive one —
 * the longest plain-prose string that isn't a path, id, or status token. Returns
 * "" if nothing looks like a description, so the caller falls back to the LLM.
 */
function extractTaskDescription(input) {
  let best = "";
  for (const [k, v] of Object.entries(input)) {
    if (COMMON_FIELDS.has(k)) continue;
    const candidate = pickString(v);
    if (!candidate) continue;
    if (looksLikeNoise(candidate)) continue;
    if (candidate.length > best.length) best = candidate;
  }
  return best ? toOneLine(clean(best)) : "";
}

// Pull a usable string out of a value that may be a string or a shallow object
// (e.g. { description } / { text } / { content }).
function pickString(v) {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const key of ["description", "text", "content", "prompt", "title", "summary"]) {
      if (typeof v[key] === "string" && v[key].trim()) return v[key].trim();
    }
  }
  return "";
}

// Reject values that are clearly not a human task description.
function looksLikeNoise(s) {
  if (s.length < 8) return true; // too short to be a description
  if (/^[0-9a-f-]{8,}$/i.test(s)) return true; // uuid / hash / id
  if (/^(\/|~|[a-z]:\\)/i.test(s)) return true; // filesystem path
  if (/^(completed|pending|in_progress|success|failed|done)$/i.test(s)) return true; // status
  return false;
}

/**
 * Pull the human asks and assistant replies out of the transcript JSONL,
 * dropping thinking, tool calls, attachments, and sidechain (subagent) entries.
 */
function readTranscript(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  const messages = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.isSidechain) continue;

    const content = entry.message && entry.message.content;
    if (entry.type === "user" && typeof content === "string") {
      const text = clean(content);
      if (text) messages.push({ role: "user", text });
    } else if (entry.type === "assistant" && Array.isArray(content)) {
      const text = clean(
        content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n"),
      );
      if (text) messages.push({ role: "assistant", text });
    }
  }
  return messages;
}

// Strip command-wrapper / system tags and collapse whitespace so the digest is
// plain prose the summarizer can read.
function clean(raw) {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDigest(messages) {
  const digest = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text.slice(0, MAX_MESSAGE_CHARS)}`)
    .join("\n");
  // Keep the most recent context if the session is long.
  return digest.slice(-MAX_DIGEST_CHARS);
}

// System prompt fully replaces the default one so the summarizer is NOT
// influenced by the project's CLAUDE.md, caveman mode, or other plugins.
const SUMMARY_SYSTEM_PROMPT =
  "You summarize a just-completed unit of work from a Claude Code session for a " +
  "work log. Reply ONLY with one terse past-tense line (no leading dash, no " +
  "preamble, no questions, no markdown) describing what was accomplished. If the " +
  "work was trivial (only a lookup or trivial question), reply with exactly: NONE. " +
  "The work is already done — never ask questions or offer to do anything.";

/**
 * Fallback only: ask a cheap model to condense the recent transcript tail into
 * one line, or "NONE" if trivial. Returns a single-line summary, or "" to skip.
 *
 *   --strict-mcp-config        no MCP servers (fast, no auth prompts)
 *   --no-session-persistence   don't write throwaway session files
 *   --system-prompt            replace the default prompt (drops CLAUDE.md/caveman)
 *   cwd: tmpdir                no project CLAUDE.md picked up
 */
function summarize(digest) {
  const userMessage =
    "Summarize the most recently completed work in this transcript tail. Do NOT " +
    "perform any task or ask questions. Only describe what was accomplished:\n\n" +
    `<session_transcript>\n${digest}\n</session_transcript>`;

  let output;
  try {
    output = execFileSync(
      "claude",
      [
        "-p",
        "--strict-mcp-config",
        "--no-session-persistence",
        "--model",
        MODEL,
        "--system-prompt",
        SUMMARY_SYSTEM_PROMPT,
        userMessage,
      ],
      {
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        cwd: os.tmpdir(),
        stdio: ["ignore", "pipe", "ignore"], // no stdin wait, drop stderr noise
        env: { ...process.env, CLAUDE_WORKLOG_ACTIVE: "1" },
      },
    );
  } catch {
    return ""; // offline / not installed / timeout — caller falls back
  }

  const oneLine = toOneLine((output || "").trim());
  if (!oneLine || /^none\b/i.test(oneLine)) return "";
  return oneLine;
}

// The model (or a multi-line description) may return several lines; flatten to
// one log line, stripping any bullet markers (-, *, •).
function toOneLine(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .join("; ");
}

// Used when the summarizer is unavailable: log the last thing the user asked for
// so the work still leaves a trace.
function fallbackSummary(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  const text = lastUser.text.slice(0, 140);
  return `[unsummarized] ${text}`;
}

// Stable dedupe key so a re-fired TaskCompleted (or an identical line) logs once.
function dedupeKey(sessionId, summary) {
  const normalized = summary.toLowerCase().replace(/\s+/g, " ").trim();
  return `${sessionId}::${normalized}`;
}

function appendEntry(summary, project) {
  fs.mkdirSync(WORKLOG_DIR, { recursive: true });
  const now = new Date();
  const date = toDateStr(now);
  const time = toTimeStr(now);
  const file = path.join(WORKLOG_DIR, `${date}.md`);

  let prefix = "";
  if (!fs.existsSync(file)) prefix = `# Work Log — ${date}\n\n`;

  const line = `- **${time}** — ${summary} _(project: ${project})_\n`;
  fs.appendFileSync(file, prefix + line);
}

function alreadyLogged(key) {
  if (!fs.existsSync(LOGGED_FILE)) return false;
  const seen = fs.readFileSync(LOGGED_FILE, "utf8").split("\n");
  return seen.includes(key);
}

function markLogged(key) {
  if (!key) return;
  fs.mkdirSync(WORKLOG_DIR, { recursive: true });
  fs.appendFileSync(LOGGED_FILE, `${key}\n`);
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// Invoked last so all const declarations above are initialized (no TDZ).
main();
