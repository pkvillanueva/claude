#!/usr/bin/env node
"use strict";

/**
 * SessionEnd hook: append a short AI summary of the just-ended session to a
 * per-day work log at ~/.claude/work-log/<YYYY-MM-DD>.md.
 *
 * A hook command cannot call an LLM directly (the prompt/agent hook types only
 * work for tool events), so we shell out to a headless `claude -p`. That nested
 * call would itself fire SessionEnd, so we guard against recursion with an env
 * var. The whole thing is best-effort: it must never block the user from
 * quitting, so every failure path still exits 0.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Recursion guard: the nested `claude -p` we spawn below sets this var, so its
// own SessionEnd becomes a no-op. Must be the very first thing we do.
if (process.env.CLAUDE_WORKLOG_ACTIVE) process.exit(0);

const WORKLOG_DIR = path.join(os.homedir(), ".claude", "work-log");
const SESSIONS_FILE = path.join(WORKLOG_DIR, ".logged-sessions");
const MODEL = "claude-haiku-4-5";

// Keep the digest small so the summarizer call stays cheap and fast.
const MAX_DIGEST_CHARS = 6000;
const MAX_MESSAGE_CHARS = 1000;
const MIN_DIGEST_CHARS = 120; // below this the session is too thin to summarize

function main() {
  try {
    const input = JSON.parse(readStdin() || "{}");
    const transcriptPath = input.transcript_path;
    const sessionId = input.session_id || "";
    const project = input.cwd ? path.basename(input.cwd) : "unknown";

    if (!transcriptPath || !fs.existsSync(transcriptPath)) process.exit(0);
    if (sessionId && alreadyLogged(sessionId)) process.exit(0);

    const messages = readTranscript(transcriptPath);
    const digest = buildDigest(messages);
    if (digest.length < MIN_DIGEST_CHARS) {
      markLogged(sessionId); // thin session — record so we never retry it
      process.exit(0);
    }

    const summary = summarize(digest) || fallbackSummary(messages);
    if (summary) appendEntry(summary, project);

    markLogged(sessionId);
  } catch {
    // Best-effort logging must never interrupt session shutdown.
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
  "You summarize completed Claude Code sessions for a work log. Reply ONLY with " +
  "1-2 terse past-tense bullet points (no leading dash, no preamble, no questions, " +
  "no markdown headers) describing what was accomplished. If the session has no " +
  "substantive work (only trivial questions or lookups), reply with exactly: NONE. " +
  "The session is already over — never ask questions or offer to do anything.";

/**
 * Ask a cheap model to condense the session into 1-2 bullets, or "NONE" if the
 * work was trivial. Returns a single-line summary, or "" to skip.
 *
 * The call is isolated so it summarizes instead of trying to *do* the work:
 *   --strict-mcp-config        no MCP servers (fast, no auth prompts)
 *   --no-session-persistence   don't write throwaway session files
 *   --system-prompt            replace the default prompt (drops CLAUDE.md/caveman)
 *   cwd: tmpdir                no project CLAUDE.md picked up
 * The digest is wrapped as past-tense data so the model treats it as a record.
 */
function summarize(digest) {
  const userMessage =
    "Summarize this completed, already-finished session. Do NOT perform any task " +
    "or ask questions. Only describe what was accomplished:\n\n" +
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

// The model may return two bullets (-, *, or •); flatten to one log line.
function toOneLine(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .join("; ");
}

// Used when the summarizer is unavailable: log the last thing the user asked for
// so the session still leaves a trace.
function fallbackSummary(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  const text = lastUser.text.slice(0, 140);
  return `[unsummarized] ${text}`;
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

function alreadyLogged(sessionId) {
  if (!fs.existsSync(SESSIONS_FILE)) return false;
  const seen = fs.readFileSync(SESSIONS_FILE, "utf8").split("\n");
  return seen.includes(sessionId);
}

function markLogged(sessionId) {
  if (!sessionId) return;
  fs.mkdirSync(WORKLOG_DIR, { recursive: true });
  fs.appendFileSync(SESSIONS_FILE, `${sessionId}\n`);
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
