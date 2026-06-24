#!/usr/bin/env node
"use strict";

/**
 * Stop hook: SILENTLY record substantive work to the daily work log.
 *
 * Why silent self-logging instead of nudging the agent: a Stop hook can only
 * make the agent act by *blocking* the stop, and Claude Code renders any blocking
 * Stop-hook output as "Stop hook error: …" — alarming, and it costs an extra
 * agent turn. So instead of asking the agent to log, this hook does the logging
 * itself: it summarizes the session on the cheapest model (Haiku 4.5) and appends
 * one line to ~/.claude/work-log/<YYYY-MM-DD>.md. No block, no message, no turn.
 *
 * The work-log *skill* still exists for explicit/manual logging ("log my work");
 * this hook is the automatic safety net so nothing is lost when the agent doesn't
 * log proactively.
 *
 * Best-effort: this MUST NOT break a session. Every path exits 0, all IO wrapped.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Recursion guard FIRST: the nested `claude -p` we spawn sets this var, so the
// Stop hook it triggers becomes a no-op. Must precede everything else.
if (process.env.CLAUDE_WORKLOG_ACTIVE) process.exit(0);

const WORKLOG_DIR = path.join(os.homedir(), ".claude", "work-log");
const LOGGED_FILE = path.join(WORKLOG_DIR, ".logged-sessions");
const MODEL = "claude-haiku-4-5";

// Tool calls that signal real work landed and may be worth logging.
const WORK_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);
const WORKLOG_SKILL = "work-log";

// Digest sizing — keep the summarizer call cheap and fast.
const MAX_DIGEST_CHARS = 6000;
const MAX_MESSAGE_CHARS = 1000;
const MIN_DIGEST_CHARS = 80;

const SUMMARY_SYSTEM_PROMPT =
  "You summarize a completed Claude Code session for a work log. Reply with ONLY " +
  "one terse past-tense line describing WHAT was accomplished — no leading dash, " +
  "no markdown, no preamble, no questions. Do NOT name the project, repo, or " +
  "directory (it's recorded separately). If the work was trivial (only a lookup " +
  "or a question, or nothing was really done), reply with exactly: NONE.";

function main() {
  let input;
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    process.exit(0);
  }

  if (input.stop_hook_active) process.exit(0); // not a continuation re-fire

  const sessionId = input.session_id || "";
  const transcriptPath = input.transcript_path;
  const project = input.cwd ? path.basename(input.cwd) : "unknown";

  if (sessionId && alreadyLogged(sessionId)) process.exit(0); // once per session
  if (!transcriptPath || !safeExists(transcriptPath)) process.exit(0);

  const messages = readTranscript(transcriptPath);
  const { didWork, didLog } = scan(messages, transcriptPath);

  // Nothing substantive, or the agent already logged via the skill → leave it.
  if (!didWork || didLog) process.exit(0);

  const digest = buildDigest(messages);
  if (digest.length < MIN_DIGEST_CHARS) process.exit(0);

  const summary = summarize(digest);
  if (!summary) process.exit(0); // trivial / summarizer unavailable

  appendEntry(summary, project);
  markLogged(sessionId);

  // Non-blocking confirmation. `systemMessage` (no `decision`) surfaces a plain
  // info line to the user without blocking the stop — so it never renders as a
  // "Stop hook error". If a Claude Code build doesn't honor systemMessage on Stop
  // hooks, the JSON is ignored and the capture is simply silent. Either is fine.
  process.stdout.write(JSON.stringify({ systemMessage: `📝 Work logged — ${summary}` }));
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
 * Parse the transcript once: collect human/assistant prose for the digest, and
 * report whether a work tool ran and whether the work-log skill was invoked.
 * `didLog` requires a real `Skill` tool_use naming work-log — NOT a bare
 * substring (the skill's name is injected into every session as an available
 * skill, so a substring match is always true and would suppress all logging).
 */
function scan(messages, transcriptPath) {
  let didWork = false;
  let didLog = false;
  try {
    for (const line of fs.readFileSync(transcriptPath, "utf8").split("\n")) {
      if (didWork && didLog) break;
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
        else if (
          block.name === "Skill" &&
          typeof (block.input && block.input.skill) === "string" &&
          block.input.skill.includes(WORKLOG_SKILL)
        ) {
          didLog = true;
        }
      }
    }
  } catch {
    /* unreadable — treat as nothing to log */
  }
  return { didWork, didLog };
}

/**
 * Pull human asks + assistant replies out of the transcript JSONL, dropping
 * thinking, tool calls, attachments, and sidechain (subagent) entries.
 */
function readTranscript(transcriptPath) {
  const messages = [];
  try {
    for (const line of fs.readFileSync(transcriptPath, "utf8").split("\n")) {
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
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n"),
        );
        if (text) messages.push({ role: "assistant", text });
      }
    }
  } catch {
    /* ignore */
  }
  return messages;
}

// Strip command-wrapper / system tags and collapse whitespace.
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
  return digest.slice(-MAX_DIGEST_CHARS); // keep the most recent context
}

/**
 * Summarize the session tail into one line on the cheapest model. Returns "" on
 * trivial work (model replies NONE) or any failure (offline / not installed).
 *
 *   --strict-mcp-config        no MCP servers (fast, no auth prompts)
 *   --no-session-persistence   no throwaway session files
 *   --system-prompt            replaces the default prompt (drops CLAUDE.md/plugins)
 *   cwd: tmpdir + env guard     no project CLAUDE.md, no Stop-hook recursion
 */
function summarize(digest) {
  let out;
  try {
    out = execFileSync(
      "claude",
      [
        "-p",
        "--strict-mcp-config",
        "--no-session-persistence",
        "--model",
        MODEL,
        "--system-prompt",
        SUMMARY_SYSTEM_PROMPT,
        `Summarize the most recently completed work in this session tail:\n\n<session_transcript>\n${digest}\n</session_transcript>`,
      ],
      {
        encoding: "utf8",
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        cwd: os.tmpdir(),
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, CLAUDE_WORKLOG_ACTIVE: "1" },
      },
    );
  } catch {
    return "";
  }
  const oneLine = toOneLine((out || "").trim());
  if (!oneLine || /^none\b/i.test(oneLine)) return "";
  return oneLine;
}

// Flatten to one line, stripping bullet markers.
function toOneLine(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .join("; ");
}

function appendEntry(summary, project) {
  try {
    fs.mkdirSync(WORKLOG_DIR, { recursive: true });
    const now = new Date();
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const file = path.join(WORKLOG_DIR, `${date}.md`);
    const prefix = fs.existsSync(file) ? "" : `# Work Log — ${date}\n\n`;
    fs.appendFileSync(file, `${prefix}- **${time}** — ${summary} _(project: ${project})_\n`);
  } catch {
    /* best-effort */
  }
}

function alreadyLogged(sessionId) {
  try {
    if (!fs.existsSync(LOGGED_FILE)) return false;
    return fs.readFileSync(LOGGED_FILE, "utf8").split("\n").includes(sessionId);
  } catch {
    return false;
  }
}

function markLogged(sessionId) {
  if (!sessionId) return;
  try {
    fs.mkdirSync(WORKLOG_DIR, { recursive: true });
    fs.appendFileSync(LOGGED_FILE, `${sessionId}\n`);
  } catch {
    /* best-effort */
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

main();
