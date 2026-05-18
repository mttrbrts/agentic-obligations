---
name: accord-obligations-demo
description: 'Run the Accord Project AP2 procurement demo. Use when demonstrating how an AI agent procurement workflow is governed by a smart legal contract (accord-obligations MCP). Covers setup, 4 purchase scenarios (Google Workspace, Figma, Atlassian, Slack), and the AP2 mandate chain with cryptographic obligations binding.'
argument-hint: 'Optional: scenario number (1-4) to run a single scenario'
---

# Accord Project AP2 Procurement Demo

Demonstrates how the Accord Project obligations layer binds an AI agent's payment actions to a smart legal contract. An **Agent Purchasing Authority** contract controls what `agent-007` may buy. Every `trigger-agreement` call enforces the contract terms and — for approved decisions — automatically runs the AP2 mandate chain (checkout → merchant → payment → processor), embedding the obligations hash into each mandate.

## When to Use

- Demonstrating smart legal contract enforcement for AI agents
- Showing how `accord-obligations` MCP governs autonomous purchasing
- Illustrating AP2 (Agent Payments Protocol) mandate chain with cryptographic binding
- Testing the 4 canonical scenarios (APPROVED / REQUIRES_HUMAN_APPROVAL / DENIED)

## Procedure

Follow these steps precisely and narrate each result clearly.

---

### Setup

**Step 1 — Load template**

Call `getTemplate` with:
```json
{ "templateId": "templates/agent-saas-authority" }
```
Save the returned `templateIdentifier` and `templateHash`.

**Step 2 — Reset state**

Call `delete_agreement` with `{ "agreementId": "acme-2026" }`. Ignore any error — this just clears prior state.

**Step 3 — Create agreement**

Call `create_agreement` with:
```json
{
  "agreementId": "acme-2026",
  "templatePath": "templates/agent-saas-authority",
  "replace": true,
  "contractData": {
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
}
```

Report: "Agreement `acme-2026` created. Template hash: `<hash>`."

**Step 4 — Read the policy**

Call `convert-agreement-to-format` with:
```json
{ "agreementId": "acme-2026", "format": "markdown" }
```

Read the returned policy document in full. This is the authoritative statement of the rules you must operate within as `agent-007`. Summarise it to the user in 3–5 bullet points covering the key constraints (annual cap, per-transaction cap, approved vendors, human-approval threshold). Acknowledge that you understand these are enforced by the contract runtime — not by your own judgment — before proceeding.

---

### Scenarios

Run each scenario in order. For each:
1. Call `getAgreement { "agreementId": "acme-2026" }` → note YTD spend before.
2. Call `trigger-agreement` with the payload below (pass as a **JSON string** in the `payload` field).
3. Report decision, reasons, and AP2 outcome.
4. Call `getAgreement` again → note YTD spend after.

---

#### Scenario 1 — Google Workspace Business Plus renewal ($1,800)

Expected: **APPROVED** (renewal triggers extra notice obligation). YTD advances to $1,800.

`trigger-agreement` arguments:
```json
{
  "agreementId": "acme-2026",
  "includeObligationsHash": true,
  "payload": "{\"$class\":\"org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest\",\"requestId\":\"req-demo-001\",\"vendorId\":\"workspace.google.com\",\"vendorCategory\":\"saas-productivity\",\"productName\":\"Google Workspace Business Plus (10 seats, annual)\",\"subscriptionTermMonths\":12,\"amount\":{\"$class\":\"org.accordproject.money@0.3.0.MonetaryAmount\",\"doubleValue\":1800,\"currencyCode\":\"USD\"},\"isRenewal\":true}"
}
```

Report:
- Decision and reasons
- `ap2.checkoutReceipt.status` and `ap2.paymentReceipt.status`
- `ap2.obligationsHashVerified`
- YTD before → after

---

#### Scenario 2 — Figma Organization ($3,500)

Expected: **REQUIRES_HUMAN_APPROVAL** (above $2,500 threshold). YTD advances to $5,300.

`trigger-agreement` arguments:
```json
{
  "agreementId": "acme-2026",
  "includeObligationsHash": true,
  "payload": "{\"$class\":\"org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest\",\"requestId\":\"req-demo-002\",\"vendorId\":\"figma.com\",\"vendorCategory\":\"saas-productivity\",\"productName\":\"Figma Organization (20 seats, annual)\",\"subscriptionTermMonths\":12,\"amount\":{\"$class\":\"org.accordproject.money@0.3.0.MonetaryAmount\",\"doubleValue\":3500,\"currencyCode\":\"USD\"},\"isRenewal\":false}"
}
```

Report:
- Decision and reasons
- `ap2.checkoutReceipt.status` and `ap2.paymentReceipt.status`
- `ap2.obligationsHashVerified`
- YTD before → after

---

#### Scenario 3 — Atlassian Jira Premium ($2,000)

Expected: **APPROVED**. YTD advances to $7,300.

`trigger-agreement` arguments:
```json
{
  "agreementId": "acme-2026",
  "includeObligationsHash": true,
  "payload": "{\"$class\":\"org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest\",\"requestId\":\"req-demo-003\",\"vendorId\":\"atlassian.com\",\"vendorCategory\":\"saas-devtools\",\"productName\":\"Jira Premium (25 users, annual)\",\"subscriptionTermMonths\":12,\"amount\":{\"$class\":\"org.accordproject.money@0.3.0.MonetaryAmount\",\"doubleValue\":2000,\"currencyCode\":\"USD\"},\"isRenewal\":false}"
}
```

Report:
- Decision and reasons
- `ap2.checkoutReceipt.status` and `ap2.paymentReceipt.status`
- `ap2.obligationsHashVerified`
- YTD before → after

---

#### Scenario 4 — Slack Pro ($1,000)

Expected: **DENIED**. Slack is on the allowlist, in a permitted category, under every per-transaction limit — the ONLY reason it is denied is the running total: $7,300 + $1,000 = $8,300 > $8,000 annual cap. YTD stays at $7,300. No AP2 mandate is issued.

`trigger-agreement` arguments:
```json
{
  "agreementId": "acme-2026",
  "includeObligationsHash": true,
  "payload": "{\"$class\":\"org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest\",\"requestId\":\"req-demo-004\",\"vendorId\":\"slack.com\",\"vendorCategory\":\"saas-productivity\",\"productName\":\"Slack Pro (annual)\",\"subscriptionTermMonths\":12,\"amount\":{\"$class\":\"org.accordproject.money@0.3.0.MonetaryAmount\",\"doubleValue\":1000,\"currencyCode\":\"USD\"},\"isRenewal\":false}"
}
```

Report:
- Decision and reason (the cap breach)
- Confirm `ap2` is null — no mandate issued
- Confirm YTD unchanged at $7,300

---

### Summary

After all 4 scenarios, print a markdown table:

| Scenario | Amount | Decision | AP2 Checkout | AP2 Payment | Hash OK | YTD After |
|---|---|---|---|---|---|---|
| Google Workspace | $1,800 | APPROVED | Success | Success | ✓ | $1,800 |
| Figma | $3,500 | REQUIRES_HUMAN_APPROVAL | Success | Success | ✓ | $5,300 |
| Atlassian | $2,000 | APPROVED | Success | Success | ✓ | $7,300 |
| Slack | $1,000 | DENIED | — | — | — | $7,300 |

Fill in actual values from the tool responses. Flag (🚨) any row that deviates from the expected values above.

Close with a one-paragraph explanation of what the demo showed: why the contract — not the agent — is the source of truth for spend limits, and how the obligations hash threads through the AP2 mandate chain to make every payment cryptographically bound to the contract terms.
