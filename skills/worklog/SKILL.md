---
name: worklog
description: Use when the user asks what they have done/worked on/accomplished over a time window — "what did I do today", "what have I worked on this week", "summarize my past month", "what did I get done yesterday", optionally scoped to a project. Reads the local work log written automatically at the end of each Claude Code session.
---

# Work Log Query

Answer "what did I do?" questions by reading the work log that the SessionEnd hook
writes to `~/.claude/work-log/<YYYY-MM-DD>.md`. Do **not** reconstruct work from
git history or memory — read the log via the query script.

## How to answer

1. Map the user's phrasing to a flag for the query script:

   | User asks                          | Flag                                  |
   | ---------------------------------- | ------------------------------------- |
   | today / so far today              | `--today`                             |
   | yesterday                         | `--since <date> --until <date>`       |
   | this week / past week / last 7d   | `--week`                              |
   | this month / past month / last 30d| `--month`                             |
   | a specific range                  | `--since YYYY-MM-DD --until YYYY-MM-DD`|

   Add `--project <name>` when the user scopes to a project (the name is the
   project folder's basename, e.g. `claude`).

2. Run the script (today's date is available to you — compute explicit dates for
   "yesterday" and custom ranges):

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/query.js --week --project claude
   ```

3. Summarize the returned entries for the user. For a single day, list them. For
   a week or month, group by day or theme and give a brief rollup — keep it
   scannable, not a raw dump.

## Notes

- Each log entry is one ended session, tagged with its project.
- Entries marked `[unsummarized]` are sessions logged while the summarizer was
  offline — present them as-is.
- If the script prints "No work-log entries found", tell the user plainly; don't
  invent activity.
