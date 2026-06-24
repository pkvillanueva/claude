#!/usr/bin/env node
"use strict";

/**
 * Stop hook: SILENTLY record substantive work to the daily work log.
 *
 * Why silent self-logging instead of nudging the agent: a Stop hook can only make
 * the agent act by *blocking* the stop, and Claude Code renders any blocking
 * Stop-hook output as "Stop hook error: …" — alarming, and it costs an extra agent
 * turn. So instead of asking the agent to log, this hook does the logging itself:
 * it summarizes on the cheapest model (Haiku 4.5) and appends one line to
 * ~/.claude/work-log/<YYYY-MM-DD>.md, then prints a non-blocking confirmation.
 *
 * Incremental, not once-per-session: the Stop hook fires at every turn end. We
 * remember how many transcript lines we've already examined per session and, on
 * each fire, look only at the NEW lines. So a follow-up unit of work ("now remove
 * X") gets its own log line instead of being swallowed by a one-shot guard. The
 * processed pointer always advances, so already-seen work is never re-summarized.
 *
 * The work-log *skill* still exists for explicit/manual logging ("log my work");
 * this hook is the automatic safety net. If the agent logged via the skill within
 * the new slice, the hook skips it to avoid a duplicate.
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
// Per-session progress: { "<session_id>": <transcript chars already examined> }.
// Tracked as a CHARACTER OFFSET, not a line count — transcripts are append-only
// and end in "\n", so a line count drifts by one (the trailing empty element)
// and would drop the first line of the next appended turn.
const PROGRESS_FILE = path.join(WORKLOG_DIR, ".session-progress.json");
// Cap the progress map so it can't grow without bound as sessions accumulate.
// On overflow we keep the most-recently-written entries (insertion order).
const MAX_PROGRESS_SESSIONS = 300;
const MODEL = "claude-haiku-4-5";

// Tool calls that signal real work landed and may be worth logging.
const WORK_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);
const WORKLOG_SKILL = "work-log";

// Digest sizing — keep the summarizer call cheap and fast. The floor only skips a
// near-empty slice; a real work turn always clears it.
const MAX_DIGEST_CHARS = 6000;
const MAX_MESSAGE_CHARS = 1000;
const MIN_DIGEST_CHARS = 20;

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

  if (!transcriptPath || !safeExists(transcriptPath)) process.exit(0);

  let text;
  try {
    text = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    process.exit(0);
  }

  // Only examine the bytes appended since we last looked at this session.
  const progress = readProgress();
  const seen = sessionId ? progress[sessionId] || 0 : 0;
  if (text.length <= seen) process.exit(0); // nothing new since last fire

  const { didWork, didLog, messages } = scanSlice(text.slice(seen).split("\n"));

  // summarize() returns a line, "" for trivial (model said NONE), or null when the
  // summarizer couldn't run (binary missing / error / timeout).
  let summary = null;
  if (didWork && !didLog) {
    const digest = buildDigest(messages);
    if (digest.length >= MIN_DIGEST_CHARS) summary = summarize(digest);
  }
  if (summary) appendEntry(summary, project);

  // Advance the pointer past everything we examined so it's never reconsidered —
  // UNLESS the summarizer failed to run (summary === null with work present). In
  // that case keep the pointer so the work is retried on a later turn rather than
  // silently lost. A trivial NONE ("") still advances.
  const execFailed = summary === null && didWork && !didLog;
  if (sessionId && !execFailed) {
    progress[sessionId] = text.length;
    writeProgress(progress);
  }

  if (summary) {
    // Non-blocking confirmation: `systemMessage` (no `decision`) surfaces a plain
    // info line without blocking the stop, so it never renders as a "Stop hook
    // error". Ignored harmlessly by builds that don't honor it on Stop hooks.
    process.stdout.write(JSON.stringify({ systemMessage: `📝 Work logged — ${summary}` }));
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

function safeExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Single pass over a slice of raw transcript lines. Returns whether a work tool
 * ran, whether the work-log skill was invoked, and the human/assistant prose for
 * the digest — thinking, tool calls, attachments, and sidechains excluded.
 * `didLog` requires a real `Skill` tool_use naming work-log — NOT a substring
 * match (the skill name is injected into every session as an available skill, so
 * a substring is always present and would suppress logging).
 */
function scanSlice(lines) {
  let didWork = false;
  let didLog = false;
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
      continue;
    }
    if (entry.type === "assistant" && Array.isArray(content)) {
      const texts = [];
      for (const block of content) {
        if (!block) continue;
        if (block.type === "text" && block.text) texts.push(block.text);
        else if (block.type === "tool_use") {
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
      const text = clean(texts.join("\n"));
      if (text) messages.push({ role: "assistant", text });
    }
  }
  return { didWork, didLog, messages };
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
 * Resolve the `claude` binary. A Stop-hook subprocess can get a minimal PATH that
 * omits ~/.local/bin (the default install location), so `claude` alone may not
 * resolve. Check known locations explicitly before falling back to PATH.
 */
function findClaude() {
  const candidates = [
    process.env.CLAUDE_WORKLOG_BIN,
    path.join(os.homedir(), ".local", "bin", "claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* keep looking */
    }
  }
  return "claude"; // last resort: rely on PATH
}

/**
 * Summarize the new-work slice into one line on the cheapest model. Returns the
 * line, "" for trivial work (model replies NONE / empty), or null when the
 * summarizer couldn't run (binary missing / error / timeout) — the caller keeps
 * the transcript pointer in the null case so the work is retried, not lost.
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
      findClaude(),
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
    return null; // binary missing / error / timeout — signal "couldn't run"
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

function readProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")) || {};
  } catch {
    return {}; // missing or corrupt — start fresh
  }
}

function writeProgress(progress) {
  try {
    let toWrite = progress;
    const keys = Object.keys(progress);
    if (keys.length > MAX_PROGRESS_SESSIONS) {
      toWrite = {};
      for (const k of keys.slice(-MAX_PROGRESS_SESSIONS)) toWrite[k] = progress[k];
    }
    fs.mkdirSync(WORKLOG_DIR, { recursive: true });
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(toWrite));
  } catch {
    /* best-effort */
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

main();
