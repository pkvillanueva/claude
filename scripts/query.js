#!/usr/bin/env node
"use strict";

/**
 * Read back the work log written by the work-log skill. Prints the dated
 * entries that fall in a time window, optionally filtered to one project.
 * Read-only; no LLM. The work-history skill runs this and narrates the result.
 *
 * Usage:
 *   node query.js --today
 *   node query.js --week [--project <name>]
 *   node query.js --month
 *   node query.js --since 2026-06-01 --until 2026-06-24 [--project <name>]
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const WORKLOG_DIR = path.join(os.homedir(), ".claude", "work-log");

const args = parseArgs(process.argv.slice(2));
const { since, until } = resolveRange(args);
printEntries(since, until, args.project);

function parseArgs(argv) {
  const out = { project: null, since: null, until: null, today: false, week: false, month: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--today") out.today = true;
    else if (arg === "--week") out.week = true;
    else if (arg === "--month") out.month = true;
    else if (arg === "--project") out.project = argv[++i] || null;
    else if (arg === "--since") out.since = argv[++i] || null;
    else if (arg === "--until") out.until = argv[++i] || null;
  }
  return out;
}

// Turn the requested window into an inclusive [since, until] date range.
// Explicit --since/--until win; otherwise the shorthands; default is today.
function resolveRange(a) {
  const today = new Date();
  let until = a.until ? new Date(a.until) : today;
  let since;

  if (a.since) since = new Date(a.since);
  else if (a.month) since = daysAgo(today, 29);
  else if (a.week) since = daysAgo(today, 6);
  else since = a.until ? new Date(a.until) : today; // --today or bare default

  return { since, until };
}

function printEntries(since, until, project) {
  const blocks = [];
  for (const date of dateRange(since, until)) {
    const file = path.join(WORKLOG_DIR, `${date}.md`);
    if (!fs.existsSync(file)) continue;

    const entries = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .filter((line) => !project || matchesProject(line, project));

    if (entries.length) blocks.push(`## ${date}\n${entries.join("\n")}`);
  }

  if (!blocks.length) {
    const scope = project ? ` for project "${project}"` : "";
    console.log(`No work-log entries found${scope} between ${toDateStr(since)} and ${toDateStr(until)}.`);
    return;
  }
  console.log(blocks.join("\n\n"));
}

function matchesProject(line, project) {
  const match = line.match(/\(project:\s*([^)]+)\)/i);
  return match ? match[1].trim().toLowerCase() === project.toLowerCase() : false;
}

function dateRange(since, until) {
  const dates = [];
  const cursor = new Date(since.getFullYear(), since.getMonth(), since.getDate());
  const end = new Date(until.getFullYear(), until.getMonth(), until.getDate());
  while (cursor <= end) {
    dates.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function daysAgo(from, n) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}
