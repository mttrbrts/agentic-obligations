# Accord Project Phase 2 Demo

This repo demonstrates how the Accord Project obligations layer binds an AI agent's
payment actions to a smart legal contract. An **Agent Purchasing Authority** contract
controls what the `agent-007` procurement agent may buy. Every `trigger-agreement`
call enforces the contract terms **and** — for approved decisions — automatically
runs the AP2 mandate chain (checkout → merchant → payment → processor) as a side
effect, embedding the obligations hash into each mandate.

---

## Setup

```bash
npm run build          # build all packages (do this once, or after code changes)
```

Open Claude Code in this directory. The `accord-obligations` MCP server starts
automatically (configured in `.claude/settings.json`).

To reset state between runs: call `delete_agreement` with `agreementId: "acme-2026"`.
State is persisted in `.state/acme-2026.json` and survives between sessions.

---

## Contract parameters (`templates/agent-saas-authority`)

| Parameter | Value |
|---|---|
| Principal | Acme Corp (issues the policy) |
| Authorized agent | agent-007 (AP2 agent, no legal standing) |
| Annual spend cap | $8,000 USD |
| Per-transaction cap | $5,000 USD |
| Human-approval threshold | > $2,500 USD |
| Effective | 2025-01-01 → 2027-12-31 |
| Permitted categories | `saas-productivity`, `saas-devtools` |
| Permitted vendors | `workspace.google.com`, `atlassian.com`, `notion.so`, `slack.com`, `figma.com` |
| Governing law | Delaware |

**Contract data (`contractData` to pass to `create_agreement`):**
```json
{
  "$class": "org.accordproject.demo.agentauthority@0.1.0.AgentSaaSAuthorityContract",
  "principal": {
    "$class": "org.accordproject.demo.agentauthority@0.1.0.Party",
    "name": "Acme Corp",
    "jurisdiction": "Delaware, USA"
  },
  "agent": {
    "$class": "org.accordproject.demo.agentauthority@0.1.0.AgentIdentity",
    "agentId": "agent-007",
    "framework": "Google Agent Payments Protocol (AP2)",
    "publicKeyFingerprint": "SHA256:4xK9mN2pQ7rLvWsYtUjBhCgDeFiAzXoPlMkNbVcTrSw"
  },
  "effectiveDate": "2025-01-01T00:00:00.000Z",
  "expiryDate": "2027-12-31T23:59:59.000Z",
  "maximumAnnualSpend": {
    "$class": "org.accordproject.money@0.3.0.MonetaryAmount",
    "doubleValue": 8000,
    "currencyCode": "USD"
  },
  "maximumPerTransaction": {
    "$class": "org.accordproject.money@0.3.0.MonetaryAmount",
    "doubleValue": 5000,
    "currencyCode": "USD"
  },
  "permittedVendorCategories": ["saas-productivity", "saas-devtools"],
  "permittedVendorAllowList": [
    "workspace.google.com", "atlassian.com", "notion.so", "slack.com", "figma.com"
  ],
  "requiresHumanApprovalAbove": {
    "$class": "org.accordproject.money@0.3.0.MonetaryAmount",
    "doubleValue": 2500,
    "currencyCode": "USD"
  },
  "governingLaw": "Delaware",
  "noticeOfTerminationDays": 30,
  "auditRightsRetentionDays": 1825
}
```

---

## The 4 demo scenarios

The scenarios run in sequence. Each builds on the state accumulated by the previous
one. **The agent never supplies YTD spend totals — the contract tracks them.**

| # | Vendor | Product | Amount | Expected decision | YTD after |
|---|---|---|---|---|---|
| 1 | Google Workspace | Business Plus (10 seats, annual renewal) | $1,800 | APPROVED | $1,800 |
| 2 | Figma | Organization (20 seats, annual) | $3,500 | REQUIRES_HUMAN_APPROVAL | $5,300 |
| 3 | Atlassian | Jira Premium (25 users, annual) | $2,000 | APPROVED | $7,300 |
| 4 | Slack | Pro (annual) | $1,000 | **DENIED** | $7,300 (unchanged) |

Scenario 4 is the headline: Slack Pro is on the allowlist, in a permitted category,
under the per-tx cap, under the human-approval threshold — perfectly fine in
isolation. The ONLY reason it is denied is that $7,300 + $1,000 = $8,300 > $8,000
annual cap. The contract knows; the agent never had to tell it.

---

## MCP tool reference

All tools are on the `accord-obligations` server.

### Setup tools

| Tool | Key inputs | Returns |
|---|---|---|
| `getTemplate` | `templateId: "templates/agent-saas-authority"` | `{ templateIdentifier, templateHash, algorithm }` |
| `delete_agreement` | `agreementId` | confirmation (ignore errors) |
| `create_agreement` | `agreementId`, `contractData`, `templatePath: "templates/agent-saas-authority"`, `replace: true` | `{ agreementId, templateHash }` |
| `convert-agreement-to-format` | `agreementId`, `format: "markdown"` | rendered policy text — **call after `create_agreement`** so the agent reads and acknowledges the policy before running scenarios |

### Per-scenario tools

| Tool | Key inputs | Returns |
|---|---|---|
| `getAgreement` | `agreementId` | `{ state: { currentYearSpend, approvedRequestIds }, history }` |
| `trigger-agreement` | `agreementId`, `payload` (ProcurementRequest JSON string), `agentId?` | `AuthorizationDecision` + `ap2` block |

### `trigger-agreement` response shape

```json
{
  "requestId": "req-demo-001",
  "decision": "APPROVED",
  "reasons": ["..."],
  "obligations": [...],
  "obligationsHash": "<sha256-hex>",
  "ap2": {
    "checkoutReceipt": { "status": "Success", "order_id": "..." },
    "paymentReceipt":  { "status": "Success", "payment_id": "..." },
    "obligationsHashVerified": true,
    "mandateChain": {
      "checkoutHash": "...",
      "paymentTransactionId": "...",
      "accordObligationsHash": "..."
    }
  }
}
```

`ap2` is `null` when the decision is `DENIED`.

### ProcurementRequest payload shape

```json
{
  "$class": "org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest",
  "requestId": "req-demo-001",
  "vendorId": "workspace.google.com",
  "vendorCategory": "saas-productivity",
  "productName": "Google Workspace Business Plus (10 seats, annual)",
  "subscriptionTermMonths": 12,
  "amount": {
    "$class": "org.accordproject.money@0.3.0.MonetaryAmount",
    "doubleValue": 1800,
    "currencyCode": "USD"
  },
  "isRenewal": true
}
```

---

## Template path

`templates/agent-saas-authority` (relative to repo root — use this as-is in tool calls
from Claude Code, which runs from the repo root).

## State reset

Call `delete_agreement { agreementId: "acme-2026" }` before starting a fresh run.
The state file is `.state/acme-2026.json` — you can also delete it manually.
