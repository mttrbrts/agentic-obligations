Agent SaaS Procurement Authority Policy
====

1\. Issuing Party
----

This Agent SaaS Procurement Authority Policy (the "Policy") is issued as of 01/01/2025 by:

**Principal:** Acme Corp, incorporated under the laws of Delaware, USA.

2\. Authorized Agent
----

Principal hereby designates the following AI agent as the authorized procurement agent under this Policy:

**Agent ID:** agent-007\
**Protocol Framework:** Google Agent Payments Protocol (AP2)\
**Public-Key Fingerprint:** SHA256:4xK9mN2pQ7rLvWsYtUjBhCgDeFiAzXoPlMkNbVcTrSw

This Policy takes effect on 01/01/2025 and expires on 12/31/2027 unless revoked earlier under Section 8.

3\. Scope and Spend Limits
----

**3.1 Annual Spend Cap.** Agent's aggregate procurement authority shall not exceed 50000.0 USD per calendar year.

**3.2 Per-Transaction Cap.** No single transaction executed by Agent shall exceed 5000.0 USD.

**3.3 Permitted Vendor Categories.** Agent is authorised to transact only within the following SaaS vendor categories:
-  saas-productivity
-  saas-devtools

**3.4 Approved Vendor List.** Agent is further limited to the following approved vendors:
-  github.com
-  atlassian.com
-  notion.so
-  slack.com
-  figma.com

4\. Human-in-the-Loop Threshold
----

Any proposed transaction with a value exceeding 2500.0 USD requires prior approval from a designated human authoriser within Principal's organisation before Agent may proceed.

5\. Operating Constraints
----

When performing procurement actions under this Policy, Agent shall:

(a) maintain complete and accurate records of each transaction, including vendor identity, contract value, subscription term, and execution timestamp;

(b) transmit a transaction confirmation to Principal within 24 hours of each completed procurement;

(c) immediately notify Principal of any attempted transaction that exceeds the limits set out in Section 3 or triggers the human-approval threshold in Section 4;

(d) upon request, provide Principal with a full audit trail of all procurement decisions and actions taken under this Policy; and

(e) comply with Principal's internal procurement policies as notified to Agent from time to time.

6\. Record Retention
----

Principal shall retain all procurement records and Agent activity logs for a minimum of 1825 days following the end of the Policy term. Principal, or any auditor appointed by Principal, shall have the right to inspect such records on reasonable notice.

7\. Authorization Scope
----

This Policy constitutes Principal's complete and exclusive statement of the authority granted to Agent for SaaS procurement. Any action taken by Agent outside the bounds of this Policy is unauthorized. Agent has no independent legal standing under this Policy; it is a machine-readable authorization instrument enforced by the Accord Project runtime and embedded as a cryptographic hash in each AP2 payment mandate.

8\. Revocation
----

Principal may revoke this Policy at any time by providing 30 days' prior notice. Upon revocation:

(a) Agent's authority to execute new transactions shall cease on the effective date of revocation; and

(b) records of all transactions executed prior to revocation shall be retained in accordance with Section 6.

9\. Enforcement
----

This Policy is enforced programmatically: each authorized transaction embeds a SHA-256 hash of the evaluated obligations bundle into the AP2 payment mandate, cryptographically binding each payment to the constraints defined here. For any disputes requiring human resolution, the laws of Delaware apply.