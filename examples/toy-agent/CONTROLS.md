<!-- Generated from controls.yaml. Do not edit by hand: the controls lint fails when this file differs from what the catalogue renders. -->

# Controls

7 controls: 4 `implemented`, 1 `procedural`, 1 `planned`, 1 `not-applicable`.

**A green check means the evidence resolves, not that it is sufficient.**

The lint proves that each anchor below exists in the tracked tree: the symbol is declared, the test title is present and not skipped, the workflow job exists and its workflow runs on pull requests. It does not prove that a test asserts what its control claims, that the job actually collects the cited test, or that a mapping to a framework id is the right one. Those are judgements, and each sits beside its evidence so a reader can disagree with it.

**Coverage is not claimed.** The lint asserts that every catalogued control has evidence, not that every id of a framework has a control. Each framework section below says how many of its ids no control here maps.

| Status | Means |
| --- | --- |
| `implemented` | A test or a CI job fails if the control stops holding. |
| `procedural` | A person enforces it by applying a written rule. No check does. |
| `planned` | Not delivered yet. The owner is who delivers it. |
| `not-applicable` | Excluded, with a written rationale. |

## Catalogue

| Id | Control | Status | Maps to | Evidence, owner or rationale |
| --- | --- | --- | --- | --- |
| CTL-TOOL-01 | The agent calls only tools on its allowlist, and refuses any other | `implemented` | owasp-asi-2026 ASI02; owasp-llm-2025 LLM06:2025 | [`checkToolCall`](src/tools.js); test [`refuses a tool that is not on the allowlist`](test/agent.test.js) in [`agent.yml`](.github/workflows/agent.yml) job `test`, runs `npm test`, on pull_request, push |
| CTL-COST-01 | A run stops after a fixed number of model steps | `implemented` | owasp-llm-2025 LLM10:2025 | [`MAX_STEPS`](src/agent.js); test [`stops when the step budget is spent`](test/agent.test.js) in [`agent.yml`](.github/workflows/agent.yml) job `test`, on pull_request, push |
| CTL-DATA-01 | Customer email addresses and phone numbers are redacted before the model sees a request | `implemented` | owasp-llm-2025 LLM02:2025 | [`redactCustomer`](src/redact.js); test [`sends no email address or phone number to the model`](test/agent.test.js) in [`agent.yml`](.github/workflows/agent.yml) job `test`, on pull_request, push |
| CTL-SUPPLY-01 | A pull request fails on a high or critical advisory in a dependency | `implemented` | owasp-llm-2025 LLM03:2025 | [`agent.yml`](.github/workflows/agent.yml) job `audit`, runs `npm audit`, on pull_request, push |
| CTL-REVIEW-01 | A new tool on the allowlist is approved by a second reviewer who did not write it | `procedural` | nist-ai-rmf-1.0 GOVERN 3.2; owasp-asi-2026 ASI02 | [`docs/review.md`](docs/review.md), section "A new tool needs a second reviewer" |
| CTL-MEM-01 | Conversation memory expires after the repair is closed | `planned` | owasp-asi-2026 ASI06 | Owner: service-desk maintainers; The agent keeps no memory between runs today, so there is nothing to expire yet. |
| CTL-NET-01 | Messages between agents are authenticated | `not-applicable` | owasp-asi-2026 ASI07 | Rationale: The toy agent talks to no other agent; the model and the tools are in-process functions, so there is no channel between agents to authenticate. |

## Frameworks

### NIST AI 100-1, AI Risk Management Framework (AI RMF 1.0), core subcategories

Registry `nist-ai-rmf-1.0`, ids from <https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf>, retrieved 2026-11-17.

**1 of 72 subcategories have a control here; 71 have none.** Coverage of this framework is not claimed.

| Id | Controls |
| --- | --- |
| GOVERN 3.2 | CTL-REVIEW-01 |

### OWASP Top 10 for Agentic Applications for 2026

Registry `owasp-asi-2026`, ids from <https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/>, retrieved 2026-11-17.

**3 of 10 risks have a control here; 7 have none.** Coverage of this framework is not claimed.

| Id | Controls |
| --- | --- |
| ASI02 | CTL-TOOL-01, CTL-REVIEW-01 |
| ASI06 | CTL-MEM-01 |
| ASI07 | CTL-NET-01 |

### OWASP Top 10 for LLM Applications 2025

Registry `owasp-llm-2025`, ids from <https://genai.owasp.org/llm-top-10/>, retrieved 2026-11-17.

**4 of 10 risks have a control here; 6 have none.** Coverage of this framework is not claimed.

| Id | Controls |
| --- | --- |
| LLM02:2025 | CTL-DATA-01 |
| LLM03:2025 | CTL-SUPPLY-01 |
| LLM06:2025 | CTL-TOOL-01 |
| LLM10:2025 | CTL-COST-01 |
