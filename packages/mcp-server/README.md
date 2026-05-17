# @ap-demo/obligations-mcp

stdio MCP server exposing the Accord Project obligations runtime to any MCP-aware agent. Part of the Phase 2 prototype demonstrating the gap AP fills between AP2 agent payment authorization and underlying contractual obligations.

## Quick start

```bash
npm install
npm run build
# server reads JSON-RPC from stdin, writes to stdout; logs go to stderr
node dist/index.js
```

Or via the bin entry after a global/local link:

```bash
npm link
obligations-mcp
```

## Tests

```bash
node --test test/authorize.test.mjs
```

Runs 11 tests covering all 7 decision branches (a–g), currency mismatch, and obligations shape.

## Tools

### `authorize_procurement`

Evaluates a `ProcurementRequest` against an `AgentSaaSAuthorityContract` using Concerto model validation and pure TypeScript business rules. Returns a real `AuthorizationDecision` with obligations and an AP2-compatible obligations hash.

**Wave 2: fully implemented.**

Input:
```json
{
  "contractData":            { "$class": "org.accordproject.demo.agentauthority@0.1.0.AgentSaaSAuthorityContract", "...": "..." },
  "request":                 { "$class": "org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest", "requestId": "req-001", "...": "..." },
  "templatePath":            "/absolute/path/to/agent-saas-authority",
  "now":                     "2026-05-17T00:00:00.000Z",
  "includeObligationsHash":  true
}
```

`templatePath` defaults to `../../templates/agent-saas-authority` relative to the package.
`now` defaults to the current time. `includeObligationsHash` defaults to `true`.

Output (`AuthorizationDecision`):
```json
{
  "requestId":            "req-2025-0317-001",
  "decision":             "REQUIRES_HUMAN_APPROVAL",
  "reasons":              ["amount above human-approval threshold"],
  "obligations":          [ { "id": "...", "obligor": "agent-007", "..." : "..." } ],
  "obligationsHash":      "34085950f91f2e70dc758bd88849beed982d27d9da52af35e378cf4c65d7c52a",
  "canonicalObligations": "[{...sorted keys...}]"
}
```

#### Decision rules (evaluated in order)

| Branch | Condition | Outcome |
|--------|-----------|---------|
| currency | any monetary field currency ≠ `request.amount.currencyCode` | DENIED: "currency mismatch" |
| a | `request.amount > contract.maximumPerTransaction` | DENIED: "exceeds per-transaction cap" |
| b | `priorYearSpendToDate + amount > maximumAnnualSpend` | DENIED: "would exceed annual cap" |
| c | `now < effectiveDate` or `now > expiryDate` | DENIED: "outside contract effective window" |
| d | `vendorCategory` not in `permittedVendorCategories` | DENIED: "vendor category not permitted" |
| e | `vendorId` not in non-empty `permittedVendorAllowList` | DENIED: "vendor not on allow list" |
| f | `amount > requiresHumanApprovalAbove` | REQUIRES_HUMAN_APPROVAL |
| g | all rules pass | APPROVED |

#### Obligations generated (APPROVED / REQUIRES_HUMAN_APPROVAL only)

1. Agent delivers subscription confirmation within `noticeOfTerminationDays` days.
2. Vendor maintains audit records for `auditRightsRetentionDays` days.
3. *(if `isRenewal`)* Agent provides renewal notice by `subscriptionTermMonths * 30 - noticeOfTerminationDays` days.

---

### `compute_obligations_hash`

Canonicalises an obligations array (stable JSON stringify, keys sorted at every level) and returns its SHA-256 hash. Intended for AP2 payment attestation.

Input:
```json
{
  "obligations": [
    { "type": "payment", "amount": 100, "currency": "USD" }
  ]
}
```

Output:
```json
{
  "algorithm":     "SHA-256",
  "hash":          "a3f1...",
  "canonicalForm": "[{\"amount\":100,\"currency\":\"USD\",\"type\":\"payment\"}]"
}
```

---

### `load_template`

Loads a Cicero template directory and returns metadata using `@accordproject/concerto-core` ModelManager for real concept introspection.

**Wave 2: uses ModelManager — returns qualified concept names and request/response types.**

Input:
```json
{ "templatePath": "/absolute/path/to/my-template" }
```

Output:
```json
{
  "name":            "agent-saas-authority",
  "version":         "0.1.0",
  "modelNamespace":  "org.accordproject.demo.agentauthority@0.1.0",
  "concepts":        [
    "org.accordproject.demo.agentauthority@0.1.0.Party",
    "org.accordproject.demo.agentauthority@0.1.0.AgentIdentity",
    "org.accordproject.demo.agentauthority@0.1.0.AgentSaaSAuthorityContract",
    "org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest",
    "org.accordproject.demo.agentauthority@0.1.0.Obligation",
    "org.accordproject.demo.agentauthority@0.1.0.AuthorizationOutcome",
    "org.accordproject.demo.agentauthority@0.1.0.AuthorizationDecision"
  ],
  "hasGrammar":      true,
  "requestType":     "org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest",
  "responseType":    "org.accordproject.demo.agentauthority@0.1.0.AuthorizationDecision"
}
```

---

## End-to-end smoke test

```bash
# From packages/mcp-server, after npm run build:
TEMPLATE=/absolute/path/to/templates/agent-saas-authority
CONTRACT=$(cat $TEMPLATE/data.json)
REQUEST=$(cat $TEMPLATE/request.json)

printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"authorize_procurement\",\"arguments\":{\"contractData\":$CONTRACT,\"request\":$REQUEST,\"templatePath\":\"$TEMPLATE\",\"now\":\"2026-05-17T00:00:00.000Z\",\"includeObligationsHash\":true}}}" \
  | node dist/index.js 2>/dev/null | tail -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(json.loads(d['result']['content'][0]['text']), indent=2))"
```

Expected: `decision: REQUIRES_HUMAN_APPROVAL`, 3 obligations, `obligationsHash: 34085950f91f2e70dc758bd88849beed982d27d9da52af35e378cf4c65d7c52a`.

## Architecture

```
src/
  index.ts                        # Entry point: McpServer + StdioServerTransport
  tools/
    authorize-procurement.ts      # Wave 2: real Concerto validation + business rules
    compute-obligations-hash.ts   # Real: canonical JSON → SHA-256
    load-template.ts              # Wave 2: ModelManager introspection
  lib/
    canonical.ts                  # canonicalJSONStringify (sorted keys, deep)
    hash.ts                       # sha256Hex helper
    model-loader.ts               # Offline Concerto ModelManager loader (no network)
test/
  authorize.test.mjs              # node:test — 11 tests covering all 7 branches
```

All logs to stderr — stdout is reserved for the MCP stdio protocol.
