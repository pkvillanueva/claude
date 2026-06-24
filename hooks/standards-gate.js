#!/usr/bin/env node
"use strict";

/**
 * PreToolUse hook (Write|Edit): force the coding-standards skill to load ONCE
 * per session before any code is written.
 *
 * Why a deny-gate instead of a memory file or session-start reminder: an
 * always-on rule loads at session start and scrolls out of context mid-session,
 * so the model "forgets" it exactly when writing code — the failure this guards
 * against. A PreToolUse deny fires at write-time. On the first code edit of a
 * session we DENY the tool with a reason telling the model to invoke
 * coding-standards, then retry. The model loads the skill and re-issues the
 * edit; a per-session sentinel lets that retry (and every later edit) through.
 * Net cost: one extra round-trip on the first code write per session.
 *
 * This is a stopgap for glob-scoped rules (Cursor-style auto-attach), which
 * aren't pluginizable yet. When those ship, retire this hook. The skill stays
 * the single source of truth — this hook only forces its load, never duplicates
 * its content.
 *
 * Scope: only code/.md files (extension check below). Non-code edits pass
 * through untouched.
 *
 * Best-effort: this MUST NOT break a session. Every path exits 0; a thrown
 * error means "allow" (emit nothing), never a spurious block.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// File kinds the coding-standards skill governs. Anything else passes silently.
const GUARDED = /\.(ts|tsx|js|jsx|mjs|cjs|md|mdx)$/i;
const SKILL = "coding-standards";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Allow = emit nothing, exit 0. PreToolUse with no decision proceeds normally.
function allow() {
  process.exit(0);
}

try {
  const raw = readStdin();
  if (!raw.trim()) allow();

  const input = JSON.parse(raw);
  const filePath =
    (input.tool_input && (input.tool_input.file_path || input.tool_input.notebook_path)) || "";

  // Out of scope -> allow. Lets non-code writes (json, lock files, etc.) through.
  if (!GUARDED.test(filePath)) allow();

  // Sentinel keyed on session_id: present means we already gated this session.
  const sessionId = String(input.session_id || "nosession").replace(/[^a-zA-Z0-9_-]/g, "_");
  const sentinel = path.join(os.tmpdir(), `cc-standards-gate-${sessionId}`);

  if (fs.existsSync(sentinel)) allow();

  // First guarded write this session. Drop the sentinel BEFORE denying so the
  // model's retry — and every later edit — passes. Exactly one deny per session.
  try {
    fs.writeFileSync(sentinel, "");
  } catch {
    // Can't write sentinel -> don't risk denying every edit. Allow.
    allow();
  }

  const reason =
    `Before editing ${path.basename(filePath)}, invoke the \`${SKILL}\` skill ` +
    `and read the reference(s) for what you're touching (general + the language/framework files). ` +
    `Then retry this edit so it follows the house style. ` +
    `(One-time check per session — later edits won't be interrupted.)`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
} catch {
  // Any failure -> allow. Never block a session on this hook's account.
  process.exit(0);
}
