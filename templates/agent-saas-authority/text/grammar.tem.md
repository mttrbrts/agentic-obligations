# Agent SaaS Procurement Authority Agreement

## 1. Parties

This Agent SaaS Procurement Authority Agreement (the "Agreement") is entered into as of {{effectiveDate}} (the "Effective Date") by and between:

{{#with principal}}
**Principal:** {{name}}, a company incorporated under the laws of {{jurisdiction}} ("Principal"); and
{{/with}}

{{#with agent}}
**Agent:** AI agent identified as {{agentId}}, operating under the {{framework}} framework, with public-key fingerprint {{publicKeyFingerprint}} ("Agent").
{{/with}}

## 2. Grant of Authority

Subject to the terms and conditions of this Agreement, Principal hereby grants Agent a limited, non-exclusive, non-transferable authority to evaluate, procure, and renew SaaS software subscriptions on Principal's behalf during the Term.

This Agreement expires on {{expiryDate}} unless earlier terminated in accordance with Section 8.

## 3. Scope and Spend Limits

**3.1 Annual Spend Cap.** Agent's aggregate procurement authority shall not exceed {{maximumAnnualSpend}} per calendar year across all transactions executed under this Agreement.

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

Any proposed transaction with a contract value exceeding {{requiresHumanApprovalAbove}} requires prior written approval from a designated human authoriser within Principal's organisation before Agent may execute. Agent shall submit such requests through Principal's designated approval workflow and must not proceed until approval is confirmed.

## 5. Obligations on the Agent

Agent shall, in performing its duties under this Agreement:

(a) maintain complete and accurate records of each transaction, including vendor identity, contract value, subscription term, and execution timestamp;

(b) transmit a transaction confirmation to Principal within 24 hours of each completed procurement;

(c) immediately notify Principal of any attempted transaction that exceeds the limits set out in Section 3 or triggers the human-approval threshold in Section 4;

(d) upon request, provide Principal with a full audit trail of all procurement decisions and actions taken under this Agreement; and

(e) comply with all applicable laws and Principal's internal procurement policies as notified to Agent from time to time.

## 6. Audit Rights

Principal shall retain all procurement records and Agent activity logs for a minimum of {{auditRightsRetentionDays}} days following the end of the Term. Principal, or any auditor appointed by Principal, shall have the right to inspect such records on reasonable notice.

## 7. Representations and Warranties

Each party represents and warrants that it has full power and authority to enter into this Agreement and that this Agreement constitutes a valid and binding obligation enforceable against it in accordance with its terms.

## 8. Termination

Either party may terminate this Agreement for any reason by providing {{noticeOfTerminationDays}} days' prior written notice to the other party. Upon termination:

(a) Agent's authority to execute new transactions shall cease immediately on the effective date of termination; and

(b) all obligations arising from transactions executed prior to termination shall survive and continue in full force.

## 9. Governing Law

This Agreement shall be governed by and construed in accordance with the laws of {{governingLaw}}, without regard to its conflict-of-laws principles.

## 10. Entire Agreement

This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior negotiations, representations, and agreements.
