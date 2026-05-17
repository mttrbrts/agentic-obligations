/**
 * AP2 Bridge — TypeScript types derived from the AP2 JSON schemas.
 *
 * Schema source directory:
 *   repos/AP2/code/sdk/schemas/ap2/
 *
 * All types are plain interfaces (no enums) for maximum JSON compatibility.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/**
 * Amount in minor currency units.
 * @see types/amount.json
 */
export interface Amount {
  /** Amount in minor units per ISO 4217 (e.g. 27999 = $279.99). */
  amount: number;
  /** ISO-4217 3-letter alphabetic currency code (e.g. "USD"). */
  currency: string;
}

/**
 * A product / line-item.
 * @see types/item.json
 */
export interface Item {
  /** Product identifier, often the SKU. */
  id: string;
  /** Product title. */
  title: string;
  /** Unit price in the currency's minor unit (ISO 4217). */
  price: number;
  /** Optional product image URI. */
  image_url?: string;
}

/**
 * A merchant (payee).
 * @see types/merchant.json
 */
export interface Merchant {
  /** Unique identifier for the merchant. */
  id: string;
  /** Human-readable merchant name. */
  name: string;
  /** Optional merchant website URL. */
  website?: string;
}

/**
 * A Payment Initiation Service Provider (PISP).
 * @see types/pisp.json
 */
export interface PISP {
  /** Legal name of the PISP. */
  legal_name: string;
  /** Brand name of the PISP. */
  brand_name: string;
  /** Domain name secured by the eIDAS QWAC certificate. */
  domain_name: string;
}

/**
 * A payment instrument (card, bank account, wallet, etc.).
 * @see types/payment_instrument.json
 */
export interface PaymentInstrument {
  /** Unique identifier for this instrument. */
  id: string;
  /** String identifying the category of instrument (e.g. "card", "bank_transfer"). */
  type: string;
  /** Optional human-readable description shown to the user. */
  description?: string;
}

/**
 * EC P-256 public key in JWK format (RFC 7517).
 * @see types/jwk.json
 */
export interface JsonWebKey {
  /** Key type — always "EC" for AP2. */
  kty: string;
  /** Curve name — always "P-256" for AP2. */
  crv?: string;
  /** Base64url x coordinate. */
  x?: string;
  /** Base64url y coordinate. */
  y?: string;
  /** Public key use ("sig" | "enc"). */
  use?: string;
  /** Key operations. */
  key_ops?: string[];
  /** Algorithm — always "ES256" for AP2. */
  alg?: string;
  /** Key ID. */
  kid?: string;
}

// ---------------------------------------------------------------------------
// Receipt status
// ---------------------------------------------------------------------------

/**
 * Status of a checkout or payment receipt.
 * @see types/receipt_status.json
 */
export type ReceiptStatus = "Success" | "Error";

// ---------------------------------------------------------------------------
// Receipt types
// ---------------------------------------------------------------------------

/**
 * Receipt describing the final state of a checkout.
 * @see checkout_receipt.json
 */
export interface CheckoutReceipt {
  /** "Success" or "Error". */
  status: ReceiptStatus;
  /** Issuer of the receipt. */
  iss: string;
  /** Creation timestamp (Unix epoch). */
  iat: number;
  /** Hash of the closed mandate this receipt is bound to. */
  reference: string;
  /** Present only when status is "Success". */
  order_id?: string;
  /** Error code — present only when status is "Error". */
  error?: string;
  /** Human-readable error description — present only when status is "Error". */
  error_description?: string;
}

/**
 * Receipt describing the final state of a payment.
 * @see payment_receipt.json
 */
export interface PaymentReceipt {
  /** "Success" or "Error". */
  status: ReceiptStatus;
  /** Issuer of the receipt. */
  iss: string;
  /** Creation timestamp (Unix epoch). */
  iat: number;
  /** Hash of the closed mandate this receipt is bound to. */
  reference: string;
  /** Unique identifier for the payment. */
  payment_id: string;
  /** PSP confirmation ID — present only when status is "Success". */
  psp_confirmation_id?: string;
  /** Network confirmation ID — present only when status is "Success". */
  network_confirmation_id?: string;
  /** Error code — present only when status is "Error". */
  error?: string;
  /** Human-readable error description — present only when status is "Error". */
  error_description?: string;
}

// ---------------------------------------------------------------------------
// Mandate types
// ---------------------------------------------------------------------------

/**
 * Accord Project obligations extension grafted onto mandates for demo purposes.
 * See README.md §"Where would this live in real AP2?" for rationale.
 */
export interface AccordObligations {
  /**
   * SHA-256 hex digest of the canonicalised obligations JSON returned by the
   * Cicero MCP server.  Allows downstream parties to verify the obligation
   * document without transmitting it inline.
   */
  hash?: string;
  /**
   * Optional URI where the full obligations document can be retrieved.
   * Not defined by AP2; purely a demo extension.
   */
  uri?: string;
  /**
   * Cicero Template.getHash() — SHA-256 over the canonical JSON of the
   * template's { metadata, grammar, models, scripts }. Proves which exact
   * template version produced the obligations above. Computed by
   * @accordproject/cicero-core; identical fingerprint that templateLibrary
   * uses for author-signature verification.
   */
  templateHash?: string;
  /**
   * Template identifier (name@version) corresponding to templateHash.
   */
  templateId?: string;
}

/**
 * Agreement from a user or agent to authorise a particular checkout action.
 *
 * Note: In production AP2, checkout_jwt and checkout_hash are SD-JWT fields.
 * For the demo we expose them as plain strings.
 *
 * DEMO EXTENSION: `accordObligations` carries the hash (and optional URI) of
 * the Cicero-evaluated obligations document.  See README.md for placement
 * rationale.
 *
 * @see checkout_mandate.json
 */
export interface CheckoutMandate {
  /** Always "mandate.checkout.1". */
  vct: "mandate.checkout.1";
  /** base64url-encoded merchant-signed JWT of the Checkout payload. */
  checkout_jwt: string;
  /** base64url-encoded SHA-256 hash of checkout_jwt. */
  checkout_hash: string;
  /** Creation timestamp (Unix epoch). */
  iat?: number;
  /** Expiration timestamp (Unix epoch). */
  exp?: number;

  // ---- Demo extension (not part of the AP2 spec) ----
  /**
   * Accord Project obligations grafted onto the mandate.
   * This field is OUTSIDE the AP2 spec and is used only for the Phase 2 demo.
   */
  accordObligations?: AccordObligations;

  // ---- Convenience fields added by the demo (not in spec) ----
  /** The agent identifier that proposed the checkout. */
  agentId?: string;
  /** Merchant receiving the payment. */
  merchant?: Merchant;
  /** Line items in this checkout. */
  items?: Item[];
  /** Total amount for the checkout. */
  totalAmount?: Amount;
}

/**
 * Agreement from a user or agent to authorise a particular payment action.
 *
 * DEMO EXTENSION: `accordObligations` carries the hash (and optional URI) of
 * the Cicero-evaluated obligations document.  See README.md for placement
 * rationale.
 *
 * @see payment_mandate.json
 */
export interface PaymentMandate {
  /** Always "mandate.payment.1". */
  vct: "mandate.payment.1";
  /** base64url hash of checkout_jwt, identifying the associated checkout. */
  transaction_id: string;
  /** The merchant receiving the payment. */
  payee: Merchant;
  /** The payment instrument used. */
  payment_instrument: PaymentInstrument;
  /** Final confirmed payment amount. */
  payment_amount: Amount;
  /** Optional PISP facilitating the transaction. */
  pisp?: PISP;
  /** ISO 8601 execution date; absent = immediate. */
  execution_date?: string;
  /** Risk signals collected at mandate creation time. */
  risk_data?: Record<string, unknown>;
  /** Creation timestamp (Unix epoch). */
  iat?: number;
  /** Expiration timestamp (Unix epoch). */
  exp?: number;

  // ---- Demo extension (not part of the AP2 spec) ----
  /**
   * Accord Project obligations grafted onto the mandate.
   * This field is OUTSIDE the AP2 spec and is used only for the Phase 2 demo.
   */
  accordObligations?: AccordObligations;
}

// ---------------------------------------------------------------------------
// Open mandate types
// ---------------------------------------------------------------------------

/** Constraint type identifiers used in OpenCheckoutMandate. */
export type CheckoutConstraintType = "checkout.allowed_merchants" | "checkout.line_items";

/** A constraint item within an OpenCheckoutMandate line_items constraint. */
export interface LineItemRequirements {
  id: string;
  acceptable_items: Array<{ id: string; title: string }>;
  quantity: number;
}

/** Constraint allowing specific merchants. */
export interface AllowedMerchantsConstraint {
  type: "checkout.allowed_merchants";
  allowed: Merchant[];
}

/** Constraint specifying required line items. */
export interface LineItemsConstraint {
  type: "checkout.line_items";
  items: LineItemRequirements[];
}

export type CheckoutConstraint = AllowedMerchantsConstraint | LineItemsConstraint;

/**
 * Open (standing) checkout mandate — authorises future checkout actions within
 * defined constraints.
 * @see open_checkout_mandate.json
 */
export interface OpenCheckoutMandate {
  /** Always "mandate.checkout.open.1". */
  vct: "mandate.checkout.open.1";
  /** Constraints that future checkout actions must satisfy. */
  constraints: CheckoutConstraint[];
  /** Key-binding confirmation claim (RFC 7800 §3.1). */
  cnf: Record<string, unknown>;
  /** Creation timestamp (Unix epoch). */
  iat?: number;
  /** Expiration timestamp (Unix epoch). */
  exp?: number;
}

/** Constraint types for OpenPaymentMandate. */
export type PaymentConstraintType =
  | "payment.agent_recurrence"
  | "payment.allowed_payees"
  | "payment.allowed_payment_instruments"
  | "payment.allowed_pisps"
  | "payment.amount_range"
  | "payment.budget"
  | "payment.execution_date"
  | "payment.reference";

export interface AgentRecurrenceConstraint {
  type: "payment.agent_recurrence";
  frequency: "ON_DEMAND" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  max_occurrences?: number;
}

export interface AllowedPayeesConstraint {
  type: "payment.allowed_payees";
  allowed: Merchant[];
}

export interface AllowedPaymentInstrumentsConstraint {
  type: "payment.allowed_payment_instruments";
  allowed: PaymentInstrument[];
}

export interface AllowedPISPsConstraint {
  type: "payment.allowed_pisps";
  allowed: PISP[];
}

export interface AmountRangeConstraint {
  type: "payment.amount_range";
  currency: string;
  max: number;
  min?: number;
}

export interface BudgetConstraint {
  type: "payment.budget";
  max: number;
  currency: string;
}

export interface ExecutionDateConstraint {
  type: "payment.execution_date";
  not_before?: string;
  not_after?: string;
}

export interface PaymentReferenceConstraint {
  type: "payment.reference";
  conditional_transaction_id: string;
}

export type PaymentConstraint =
  | AgentRecurrenceConstraint
  | AllowedPayeesConstraint
  | AllowedPaymentInstrumentsConstraint
  | AllowedPISPsConstraint
  | AmountRangeConstraint
  | BudgetConstraint
  | ExecutionDateConstraint
  | PaymentReferenceConstraint;

/**
 * Open (standing) payment mandate — authorises future payment actions within
 * defined constraints.
 * @see open_payment_mandate.json
 */
export interface OpenPaymentMandate {
  /** Always "mandate.payment.open.1". */
  vct: "mandate.payment.open.1";
  /** Constraints the future payment actions must satisfy. */
  constraints: PaymentConstraint[];
  /** Key-binding confirmation claim (RFC 7800 §3.1). */
  cnf: Record<string, unknown>;
  /** Optional pre-set payee. */
  payee?: Merchant;
  /** Optional pre-set payment amount. */
  payment_amount?: Amount;
  /** Optional pre-set payment instrument. */
  payment_instrument?: PaymentInstrument;
  /** Optional pre-set PISP. */
  pisp?: PISP;
  /** ISO 8601 execution date; absent = immediate. */
  execution_date?: string;
  /** Risk signals. */
  risk_data?: Record<string, unknown>;
  /** Creation timestamp (Unix epoch). */
  iat?: number;
  /** Expiration timestamp (Unix epoch). */
  exp?: number;
}

// ---------------------------------------------------------------------------
// Re-export LineItem alias (used by builders)
// ---------------------------------------------------------------------------

/**
 * Alias for Item used when the item appears in a mandate line-items context.
 * @see types/item.json
 */
export type LineItem = Item;
