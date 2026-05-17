/**
 * @ap-demo/ap2-bridge — public exports.
 *
 * Types derived from the AP2 JSON schemas, deterministic builder helpers, and
 * stub merchant / payment-processor implementations for the Accord Project
 * Phase 2 demo.
 */

// Types
export type {
  // Primitives
  Amount,
  Item,
  LineItem,
  Merchant,
  PISP,
  PaymentInstrument,
  JsonWebKey,
  ReceiptStatus,
  AccordObligations,

  // Mandates
  CheckoutMandate,
  PaymentMandate,
  OpenCheckoutMandate,
  OpenPaymentMandate,

  // Open mandate constraints
  CheckoutConstraint,
  CheckoutConstraintType,
  AllowedMerchantsConstraint,
  LineItemsConstraint,
  LineItemRequirements,
  PaymentConstraint,
  PaymentConstraintType,
  AgentRecurrenceConstraint,
  AllowedPayeesConstraint,
  AllowedPaymentInstrumentsConstraint,
  AllowedPISPsConstraint,
  AmountRangeConstraint,
  BudgetConstraint,
  ExecutionDateConstraint,
  PaymentReferenceConstraint,

  // Receipts
  CheckoutReceipt,
  PaymentReceipt,
} from "./types.js";

// Builders
export {
  buildCheckoutMandate,
  buildPaymentMandate,
} from "./builders.js";
export type {
  BuildCheckoutMandateInput,
  BuildPaymentMandateInput,
} from "./builders.js";

// Stub implementations
export { StubMerchant } from "./merchant.js";
export { StubPaymentProcessor } from "./processor.js";
