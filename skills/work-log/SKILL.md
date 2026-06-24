---
name: work-log
description: Use proactively (without being asked) right after completing a substantive unit of work in a session — shipping a feature, fixing a bug, refactoring, making a design decision, or any code/file change worth remembering. The agent decides whether the work is worth recording and, if so, logs one line. This is an automated self-invoked skill, not a user command; skip trivial lookups and questions.
---

# Work Log Writer

Automatically record substantive work as one rollup line in the local daily work
log at `~/.claude/work-log/<YYYY-MM-DD>.md`. **You** (the agent) decide when to
invoke this — proactively, after finishing real work — and whether the work is
worth logging at all. The user does not trigger this; don't ask permission, just
log it (or skip) and move on. Read the log back later with the **work-history**
skill.

## First: decide whether to log

Judge what just got done. Only log work worth remembering later.

| Log it | Skip it |
| --- | --- |
| Shipped/changed a feature | Pure lookup or "where is X" question |
| Fixed a bug | A question answered with no change made |
| Refactor, rename, cleanup that landed | Trivial one-liner with no lasting effect |
| A design/architecture decision | Work that was started but abandoned |
| Wrote/edited code, config, or docs | Reading/exploring with no outcome |
| Completed research with a conclusion | Anything already logged this session |

If it lands in the **Skip** column, do nothing — no log entry, no message about
it.

## Then: write the entry

1. **Summarize the work** into ONE terse past-tense line — what was actually
   accomplished, not what was attempted or asked. No leading dash, no markdown,
   no questions. Roll the whole unit of work into a single line; only split into
   multiple lines for clearly unrelated pieces.

2. **Append it** with this one command — it stamps the date/time, tags the
   project (the working directory's basename), and adds the day header on the
   first entry of the day. Replace `<SUMMARY>` with your one-line summary:

   ```bash
   d=$(date +%F); t=$(date +%H:%M); f=~/.claude/work-log/$d.md
   mkdir -p ~/.claude/work-log
   [ -f "$f" ] || printf '# Work Log — %s\n\n' "$d" > "$f"
   printf -- '- **%s** — %s _(project: %s)_\n' "$t" "<SUMMARY>" "$(basename "$PWD")" >> "$f"
   ```

3. Mention briefly that you logged it. Keep it to a few words — this is a side
   effect, not the main response.

## Format

Each line is exactly:

```md
- **HH:MM** — <past-tense summary> _(project: <name>)_
```

Keep this format stable — the **work-history** skill's query script parses the
`- ` prefix and the `(project: …)` tag.

## Notes

- The log is global (`~/.claude/work-log/`, across all projects) and not
  committed to any repo.
- One line per logged unit of work. Don't re-log work already in today's file —
  check the file first if unsure.
