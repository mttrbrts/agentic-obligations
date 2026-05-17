# @ap-demo/demo-cli

CLI orchestrator for the Accord Project Phase 2 end-to-end demo.

## Usage

From the monorepo root:

```bash
npm run demo
```

Or directly:

```bash
node packages/demo-cli/dist/index.js
```

## What It Does

The CLI runs three procurement scenarios against the `agent-saas-authority` Cicero template via the MCP server, then builds AP2 mandates for approved requests:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | GitHub Enterprise renewal — $1,800 | APPROVED |
| 2 | Figma new purchase — $3,500 | REQUIRES_HUMAN_APPROVAL |
| 3 | Databricks — $40,000 (over cap) | DENIED |

## What to Look For

- **Scenario 1 (Happy path):** Decision `APPROVED`, obligations hash appears in MCP response, hash is embedded in both CheckoutMandate and PaymentMandate `accordObligations.hash`, merchant and processor both accept, client re-computes hash and confirms it matches.
- **Scenario 2 (Human approval):** Decision `REQUIRES_HUMAN_APPROVAL`, AP2 mandates still created and accepted (human approval is tracked in obligations, not a blocker for mandate creation in this demo).
- **Scenario 3 (Denied):** Decision `DENIED`, AP2 path is skipped entirely.
- **Summary table:** Bottom of output shows all three results at a glance.

## Debug Mode

Set `DEBUG=1` to see raw MCP server stderr:

```bash
DEBUG=1 npm run demo
```

## Exit Code

- `0` — all scenarios produced expected decisions and mandates were accepted where applicable.
- `1` — at least one scenario failed unexpectedly.
