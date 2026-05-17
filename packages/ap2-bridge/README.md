# @ap-demo/ap2-bridge

TypeScript types, deterministic builder helpers, and stub implementations for
the [AP2 (Agent Payments Protocol)](https://github.com/google/agent-payments-protocol)
– used in the Accord Project Phase 2 demo.

## What this package is

AP2 defines the wire format for an agent to propose and authorise payments on
behalf of a user:

- **CheckoutMandate** – agent commits to a specific basket of goods.
- **PaymentMandate** – agent commits to a specific payment instrument and amount.
- **Open mandates** – standing authorisation with constraints for future use.

This package provides:

| Module | Contents |
|---|---|
| `src/types.ts` | Plain TypeScript interfaces faithfully derived from the AP2 JSON schemas. |
| `src/builders.ts` | `buildCheckoutMandate` / `buildPaymentMandate` — deterministic helpers. |
| `src/merchant.ts` | `StubMerchant.receiveCheckoutMandate` — validates and returns a receipt. |
| `src/processor.ts` | `StubPaymentProcessor.processPayment` — validates and returns a receipt. |

## Where the AP2 spec lives

Schemas are at `repos/AP2/code/sdk/schemas/ap2/` relative to the monorepo root.
Python reference SDK: `repos/AP2/code/sdk/python/ap2/`.

## How `obligationsHash` is grafted on

Neither `CheckoutMandate` nor `PaymentMandate` in the AP2 spec provides a
generic extension field (`metadata`, `extensions`, etc.).  The mandates are
SD-JWT payloads with a closed set of registered claims.

For the demo we add a **top-level `accordObligations` object** to both mandate
interfaces:

```jsonc
{
  "vct": "mandate.checkout.1",
  "checkout_jwt": "…",
  "checkout_hash": "…",

  // ---- DEMO EXTENSION — not part of AP2 spec ----
  "accordObligations": {
    "hash": "<SHA-256 hex of canonicalised obligations JSON>",
    "uri":  "https://mcp.demo.local/obligations/<id>"   // optional
  }
}
```

The `hash` field is produced by the Accord Project MCP server after evaluating
the Agent SaaS Authority Cicero template.  It lets downstream parties (stub
merchant, stub processor) verify that the authorising contract obligations were
evaluated without transmitting the full obligations document.

### Where would this live in real AP2?

In a production integration the right approach would be one of:

1. **Custom SD-JWT extension claim** — propose `org.accordproject.obligations`
   as a vendor-prefixed claim to the AP2 working group.  The claim would be
   selectively disclosable so that the obligations hash can be shared without
   revealing other mandate fields.

2. **`risk_data` map** (available on `PaymentMandate`) — a short-term
   workaround; the map is open-ended but semantically meant for risk signals,
   not legal obligations.

3. **Out-of-band reference** — ship the hash in a separate AP2 "extension
   credential" alongside the mandate, linked by `transaction_id`.

Option 1 is the correct long-term path.  Options 2 and 3 are pragmatic
stop-gaps.  For the demo, the top-level `accordObligations` field was chosen
because it is the most readable during a live presentation.

## Caveats

- **Demo only.** The `accordObligations` field is outside the AP2 specification.
  Do not use this package in production without first agreeing an extension
  mechanism with the AP2 working group.
- `checkout_jwt` values produced by `buildCheckoutMandate` are **not**
  cryptographically signed.  They are base64url-encoded JSON stubs.  A real
  implementation must sign with the merchant's private key.
- The stub merchant and processor use `Date.now()` for receipt `iat`; this is
  the only non-deterministic part of the package.

## Build

```sh
npm install
npm run build        # tsc → dist/
npm run typecheck    # tsc --noEmit
```

No runtime dependencies. Dev dependencies: `typescript`, `@types/node`.
