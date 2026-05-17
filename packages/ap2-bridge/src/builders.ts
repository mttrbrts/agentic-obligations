/**
 * AP2 Bridge — mandate builder helpers.
 *
 * DESIGN NOTE — where obligationsHash is grafted
 * ------------------------------------------------
 * The AP2 CheckoutMandate and PaymentMandate schemas are SD-JWT Verifiable
 * Credential payloads.  Neither schema defines a generic `metadata` bag or an
 * `extensions` field.  Rather than silently dropping unknown fields inside a
 * sealed JWT claim-set, the demo adds a top-level `accordObligations` object
 * to each mandate interface.  This is explicitly out-of-spec and is
 * documented in README.md §"Where would this live in real AP2?".
 *
 * In a production integration the natural home would be a custom SD-JWT
 * extension claim (prefixed with the vendor reverse-domain, e.g.
 * `org.accordproject.obligations`), negotiated with the AP2 working group.
 */

import type {
  Amount,
  CheckoutMandate,
  Item,
  Merchant,
  PaymentInstrument,
  PaymentMandate,
} from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Encode a string to base64url (no runtime deps — pure JS).
 * Used to produce deterministic checkout_jwt / checkout_hash placeholders.
 */
function toBase64url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// buildCheckoutMandate
// ---------------------------------------------------------------------------

export interface BuildCheckoutMandateInput {
  /** Identifier of the agent proposing the checkout. */
  agentId: string;
  /** Identifier of the merchant (used to build the payee). */
  merchantId: string;
  /** Human-readable merchant name. */
  merchantName?: string;
  /** Optional merchant website. */
  merchantWebsite?: string;
  /** Items in this checkout. */
  items: Item[];
  /** Total amount for the checkout. */
  totalAmount: Amount;
  /**
   * SHA-256 hex digest of the canonicalised obligations JSON.
   * Embedded in `accordObligations.hash`.
   */
  obligationsHash?: string;
  /**
   * Optional URI pointing to the full obligations document.
   * Embedded in `accordObligations.uri`.
   */
  obligationsUri?: string;
  /**
   * Cicero Template.getHash() — fingerprint of the template that produced
   * the obligations. Embedded in `accordObligations.templateHash`.
   */
  templateHash?: string;
  /** Template identifier (name@version). Embedded in `accordObligations.templateId`. */
  templateId?: string;
}

/**
 * Build a {@link CheckoutMandate} from structured inputs.
 *
 * The mandate is deterministic given fixed inputs — no Date.now() or UUID
 * calls are made internally.  Callers that need timestamping should set
 * `iat`/`exp` themselves after calling this function.
 *
 * The `checkout_jwt` placeholder is a base64url-encoded JSON summary of the
 * key mandate fields (not a real signed JWT — the demo does not perform JWT
 * signing).  `checkout_hash` is the base64url of `checkout_jwt` re-encoded,
 * which gives a stable, deterministic reference value.
 */
export function buildCheckoutMandate(
  input: BuildCheckoutMandateInput
): CheckoutMandate {
  const merchant: Merchant = {
    id: input.merchantId,
    name: input.merchantName ?? input.merchantId,
    ...(input.merchantWebsite ? { website: input.merchantWebsite } : {}),
  };

  // Deterministic stub JWT payload (not cryptographically signed).
  const payload = JSON.stringify({
    agent_id: input.agentId,
    merchant_id: input.merchantId,
    items: input.items.map((i) => ({ id: i.id, price: i.price })),
    total: input.totalAmount,
  });

  const checkout_jwt = toBase64url(payload);
  const checkout_hash = toBase64url(checkout_jwt);

  const mandate: CheckoutMandate = {
    vct: "mandate.checkout.1",
    checkout_jwt,
    checkout_hash,
    agentId: input.agentId,
    merchant,
    items: input.items,
    totalAmount: input.totalAmount,
  };

  if (
    input.obligationsHash !== undefined ||
    input.obligationsUri !== undefined ||
    input.templateHash !== undefined ||
    input.templateId !== undefined
  ) {
    mandate.accordObligations = {
      ...(input.obligationsHash !== undefined ? { hash: input.obligationsHash } : {}),
      ...(input.obligationsUri !== undefined ? { uri: input.obligationsUri } : {}),
      ...(input.templateHash !== undefined ? { templateHash: input.templateHash } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
    };
  }

  return mandate;
}

// ---------------------------------------------------------------------------
// buildPaymentMandate
// ---------------------------------------------------------------------------

export interface BuildPaymentMandateInput {
  /** The checkout mandate this payment is linked to. */
  checkoutMandate: CheckoutMandate;
  /** Payment instrument selected by the user/agent. */
  paymentInstrument: PaymentInstrument;
  /**
   * SHA-256 hex digest of the canonicalised obligations JSON.
   * If not supplied, falls through from `checkoutMandate.accordObligations.hash`
   * when present.
   */
  obligationsHash?: string;
  /** Cicero template hash override; otherwise propagated from checkout mandate. */
  templateHash?: string;
  /** Template identifier override; otherwise propagated from checkout mandate. */
  templateId?: string;
}

/**
 * Build a {@link PaymentMandate} from a completed {@link CheckoutMandate} and a
 * chosen {@link PaymentInstrument}.
 *
 * The `transaction_id` is taken directly from the checkout mandate's
 * `checkout_hash` so the two mandates are cryptographically linked.
 *
 * `obligationsHash` precedence:
 *   1. `input.obligationsHash` (explicit override)
 *   2. `input.checkoutMandate.accordObligations.hash` (propagated from checkout)
 */
export function buildPaymentMandate(
  input: BuildPaymentMandateInput
): PaymentMandate {
  const { checkoutMandate, paymentInstrument } = input;

  if (!checkoutMandate.merchant) {
    throw new Error(
      "buildPaymentMandate: checkoutMandate.merchant is required. " +
        "Build the CheckoutMandate using buildCheckoutMandate()."
    );
  }
  if (!checkoutMandate.totalAmount) {
    throw new Error(
      "buildPaymentMandate: checkoutMandate.totalAmount is required."
    );
  }

  const resolvedHash = input.obligationsHash ?? checkoutMandate.accordObligations?.hash;
  const resolvedUri = checkoutMandate.accordObligations?.uri;
  const resolvedTemplateHash =
    input.templateHash ?? checkoutMandate.accordObligations?.templateHash;
  const resolvedTemplateId = input.templateId ?? checkoutMandate.accordObligations?.templateId;

  const mandate: PaymentMandate = {
    vct: "mandate.payment.1",
    transaction_id: checkoutMandate.checkout_hash,
    payee: checkoutMandate.merchant,
    payment_instrument: paymentInstrument,
    payment_amount: checkoutMandate.totalAmount,
  };

  if (
    resolvedHash !== undefined ||
    resolvedUri !== undefined ||
    resolvedTemplateHash !== undefined ||
    resolvedTemplateId !== undefined
  ) {
    mandate.accordObligations = {
      ...(resolvedHash !== undefined ? { hash: resolvedHash } : {}),
      ...(resolvedUri !== undefined ? { uri: resolvedUri } : {}),
      ...(resolvedTemplateHash !== undefined ? { templateHash: resolvedTemplateHash } : {}),
      ...(resolvedTemplateId !== undefined ? { templateId: resolvedTemplateId } : {}),
    };
  }

  return mandate;
}
