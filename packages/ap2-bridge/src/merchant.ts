/**
 * AP2 Bridge — stub merchant implementation.
 *
 * In a real integration this class would be replaced by a merchant-side
 * verification service that:
 *   1. Validates the SD-JWT signature on the CheckoutMandate.
 *   2. Fetches the obligations document from accordObligations.uri and
 *      verifies its SHA-256 digest matches accordObligations.hash.
 *   3. Checks that its own contractual obligations are satisfied.
 *
 * For the demo, we simply log the mandate and return a synthetic receipt.
 */

import type { CheckoutMandate, CheckoutReceipt } from "./types.js";

export class StubMerchant {
  private readonly issuerId: string;

  constructor(issuerId = "stub-merchant.demo.local") {
    this.issuerId = issuerId;
  }

  /**
   * Receive a {@link CheckoutMandate} and return a {@link CheckoutReceipt}.
   *
   * Returns status "Error" if `accordObligations.hash` is absent — the demo
   * treats a missing obligations hash as an unverified authorization.
   */
  receiveCheckoutMandate(m: CheckoutMandate): CheckoutReceipt {
    const reference = m.checkout_hash;
    const iat = Math.floor(Date.now() / 1000);

    if (!m.accordObligations?.hash) {
      console.warn(
        "[StubMerchant] REJECTED checkout mandate %s — accordObligations.hash is missing",
        reference
      );
      return {
        status: "Error",
        iss: this.issuerId,
        iat,
        reference,
        error: "OBLIGATIONS_HASH_MISSING",
        error_description:
          "The CheckoutMandate does not carry an accordObligations.hash. " +
          "The Accord Project MCP server must evaluate the contract and attach " +
          "the SHA-256 obligations hash before the merchant will accept the mandate.",
      };
    }

    console.log(
      "[StubMerchant] Accepted checkout mandate %s | obligationsHash=%s | templateHash=%s | templateId=%s",
      reference,
      m.accordObligations.hash,
      m.accordObligations.templateHash ?? "(none)",
      m.accordObligations.templateId ?? "(none)"
    );

    return {
      status: "Success",
      iss: this.issuerId,
      iat,
      reference,
      order_id: `order-${reference.slice(0, 12)}`,
    };
  }
}
