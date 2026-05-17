# Agent SaaS Procurement Authority Policy

## 1. Issuing Party

This Agent SaaS Procurement Authority Policy (the "Policy") is issued as of {{effectiveDate}} by:

{{#with principal}}
**Principal:** {{name}}, incorporated under the laws of {{jurisdiction}}.
{{/with}}

## 2. Authorized Agent

Principal hereby designates the following AI agent as the authorized procurement agent under this Policy:

{{#with agent}}
**Agent ID:** {{agentId}}\
**Protocol Framework:** {{framework}}\
**Public-Key Fingerprint:** {{publicKeyFingerprint}}
{{/with}}

This Policy takes effect on {{effectiveDate}} and expires on {{expiryDate}} unless revoked earlier under Section 8.

## 3. Scope and Spend Limits

**3.1 Annual Spend Cap.** Agent's aggregate procurement authority shall not exceed {{maximumAnnualSpend}} per calendar year.

**3.2 Per-Transaction Cap.** No single transaction executed by Agent shall exceed {{maximumPerTransaction}}.

**3.3 Permitted Vendor Categories.** Agent is authorised to transact only within the following SaaS vendor categories:

{{#ulist permittedVendorCategories}}
- {{this}}
{{/ulist}}

**3.4 Approved Vendor List.** Agent is further limited to the following approved vendors:

{{#ulist permittedVendorAllowList}}
- {{this}}
{{/ulist}}

## 4. Human-in-the-Loop Threshold

Any proposed transaction with a value exceeding {{requiresHumanApprovalAbove}} requires prior approval from a designated human authoriser within Principal's organisation before Agent may proceed.

## 5. Operating Constraints

When performing procurement actions under this Policy, Agent shall:

(a) maintain complete and accurate records of each transaction, including vendor identity, contract value, subscription term, and execution timestamp;

(b) transmit a transaction confirmation to Principal within 24 hours of each completed procurement;

(c) immediately notify Principal of any attempted transaction that exceeds the limits set out in Section 3 or triggers the human-approval threshold in Section 4;

(d) upon request, provide Principal with a full audit trail of all procurement decisions and actions taken under this Policy; and

(e) comply with Principal's internal procurement policies as notified to Agent from time to time.

## 6. Record Retention

Principal shall retain all procurement records and Agent activity logs for a minimum of {{auditRightsRetentionDays}} days following the end of the Policy term. Principal, or any auditor appointed by Principal, shall have the right to inspect such records on reasonable notice.

## 7. Authorization Scope

This Policy constitutes Principal's complete and exclusive statement of the authority granted to Agent for SaaS procurement. Any action taken by Agent outside the bounds of this Policy is unauthorized. Agent has no independent legal standing under this Policy; it is a machine-readable authorization instrument enforced by the Accord Project runtime and embedded as a cryptographic hash in each AP2 payment mandate.

## 8. Revocation

Principal may revoke this Policy at any time by providing {{noticeOfTerminationDays}} days' prior notice. Upon revocation:

(a) Agent's authority to execute new transactions shall cease on the effective date of revocation; and

(b) records of all transactions executed prior to revocation shall be retained in accordance with Section 6.

## 9. Enforcement

This Policy is enforced programmatically: each authorized transaction embeds a SHA-256 hash of the evaluated obligations bundle into the AP2 payment mandate, cryptographically binding each payment to the constraints defined here. For any disputes requiring human resolution, the laws of {{governingLaw}} apply.
