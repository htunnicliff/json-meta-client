# Triage labels

| Canonical role  | Tracker label   | Meaning                                  |
| --------------- | --------------- | ---------------------------------------- |
| needs-triage    | needs-triage    | Maintainer needs to evaluate the issue   |
| needs-info      | needs-info      | Waiting on reporter for more information |
| ready-for-agent | ready-for-agent | Fully specified, ready for an AFK agent  |
| ready-for-human | ready-for-human | Requires human implementation            |
| wontfix         | wontfix         | Will not be actioned                     |

When a skill mentions a canonical role, use its tracker label.
Edit the tracker-label column to change the vocabulary later.

## Transitions

Before changing labels, read [issue-tracker.md](issue-tracker.md).

Treat these five labels as mutually exclusive triage states. When setting
a state, remove any other label from this table and preserve unrelated
labels, including `wayfinder:*` labels.

- Use `needs-triage` when the issue needs a fresh evaluation.
- Use `needs-info` while a concrete question to the reporter remains unanswered.
- Use `ready-for-agent` when scope, acceptance criteria, and required context
  are sufficient for implementation without further clarification.
- Use `ready-for-human` when implementation requires human participation;
  explain that requirement in the issue.
- Use `wontfix` when the decision is to decline the work. Explain and close
  the issue using the tracker convention. For already closed issues, preserve
  the closed state and add the explanation.

When new information changes the disposition, replace the triage state.
Reopen a declined issue only when the decision to resume the work is made.
