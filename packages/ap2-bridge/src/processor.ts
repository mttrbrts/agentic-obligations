/**
 * AP2 Bridge — stub payment processor implementation.
 *
 * In a real integration this class would be replaced by a payment processor
 * that:
 *   1. Validates the SD-JWT signature on the PaymentMandate.
 *   2. Checks the accordObligations hash against the obligations document.
 *   3. Initiates the actual payment rail (card network, bank transfer, etc.).
 *
 * For the demo, we simply log the mandate and return a synthetic receipt.
 */

import type { PaymentMandate, PaymentReceipt } from "./types.js";

export class StubPaymentProcessor {
  private readonly issuerId: string;

  constructor(issuerId = "stub-processor.demo.local") {
    this.issuerId = issuerId;
  }

  /**
   * Process a {@link PaymentMandate} and return a {@link PaymentReceipt}.
   *
   * Returns status "Error" if `accordObligations.hash` is absent — the demo
   * treats a missing obligations hash as an unverified authorization.
   */
  processPayment(m: PaymentMandate): PaymentReceipt {
    const reference = m.transaction_id;
    const paymentId = `pmt-${reference.slice(0, 12)}`;
    const iat = Math.floor(Date.now() / 1000);

    if (!m.accordObligations?.hash) {
      console.warn(
        "[StubPaymentProcessor] REJECTED payment mandate %s — accordObligations.hash is missing",
        reference
      );
      return {
        status: "Error",
        iss: this.issuerId,
        iat,
        reference,
        payment_id: paymentId,
        error: "OBLIGATIONS_HASH_MISSING",
        error_description:
          "The PaymentMandate does not carry an accordObligations.hash. " +
          "The Accord Project MCP server must evaluate the contract and attach " +
          "the SHA-256 obligations hash before the processor will initiate the payment.",
      };
    }

    console.log(
      "[StubPaymentProcessor] Processing payment mandate %s | payee=%s | amount=%d %s | obligationsHash=%s | templateHash=%s",
      reference,
      m.payee.name,
      m.payment_amount.amount,
      m.payment_amount.currency,
      m.accordObligations.hash,
      m.accordObligations.templateHash ?? "(none)"
    );

    return {
      status: "Success",
      iss: this.issuerId,
      iat,
      reference,
      payment_id: paymentId,
      psp_confirmation_id: `psp-${reference.slice(0, 8)}`,
      network_confirmation_id: `net-${reference.slice(0, 8)}`,
    };
  }
}
