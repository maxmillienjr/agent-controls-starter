# Review rules

These are rules a reviewer applies by hand. No check in this repository enforces them.

## A new tool needs a second reviewer

A pull request that adds a name to `ALLOWED_TOOLS` in `src/tools.js` is approved by two
people, and one of them is not the author of the tool. The allowlist is the agent's reach;
widening it is the change most worth a second reader.

## Prompts are reviewed as code

A change to what the agent is told goes through a pull request like any other change.
