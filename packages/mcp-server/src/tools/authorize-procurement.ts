import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { canonicalJSONStringify } from '../lib/canonical.js';
import { sha256Hex } from '../lib/hash.js';
import { loadContract, saveContract } from '../lib/contract-store.js';
import { createRequire } from 'node:module';
import {
  buildCheckoutMandate,
  buildPaymentMandate,
  StubMerchant,
  StubPaymentProcessor,
} from '@ap-demo/ap2-bridge';
import type { CheckoutReceipt, PaymentReceipt } from '@ap-demo/ap2-bridge';

const require = createRequire(import.meta.url);

export interface Obligation {
  id: string;
  obligor: string;
  description: string;
  triggerCondition: string;
  deadlineDays?: number;
}

export type AuthorizationOutcome = 'APPROVED' | 'DENIED' | 'REQUIRES_HUMAN_APPROVAL';

export interface AuthorizationDecision {
  requestId: string;
  decision: AuthorizationOutcome;
  reasons: string[];
  obligations: Obligation[];
  obligationsHash?: string;
  canonicalObligations?: string;
  newState?: unknown;
  triggerResponse?: unknown;
}

/** Human-readable display names for the demo vendors. */
const VENDOR_NAMES: Record<string, string> = {
  'workspace.google.com': 'Google Workspace',
  'figma.com': 'Figma',
  'atlassian.com': 'Atlassian',
  'slack.com': 'Slack',
  'notion.so': 'Notion',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const procCache = new Map<string, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getProcessor(templatePath: string): Promise<any> {
  const cached = procCache.get(templatePath);
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cc = require('@accordproject/cicero-core') as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const te = require('@accordproject/template-engine') as any;
  const tpl = await cc.Template.fromDirectory(templatePath);
  const proc = new te.TemplateArchiveProcessor(tpl);
  procCache.set(templatePath, proc);
  return proc;
}

export function registerTriggerAgreement(server: McpServer): void {
  server.tool(
    'trigger-agreement',
    'Sends a request payload (as a JSON string) to an existing agreement, evaluating the template-engine TypeScript logic against the input data. Resolves agreement data and current state from persistent memory using agreementId, invokes the runtime, persists the returned state, and appends to the agreement\'s audit history.',
    {
      agreementId: z
        .string()
        .describe('Identifier of an existing agreement (see create_agreement / list_agreements).'),
      payload: z
        .string()
        .describe('Request payload as a JSON string. The schema must be one of the transaction types extending Request defined in the template model.'),
      now: z.string().optional().describe('ISO-8601 timestamp for "now". Defaults to current time.'),
      includeObligationsHash: z
        .boolean()
        .optional()
        .default(true)
        .describe('When true, include obligationsHash and canonicalObligations in the response.'),
      agentId: z
        .string()
        .optional()
        .default('agent-007')
        .describe('Agent identifier embedded in the AP2 checkout mandate. Defaults to "agent-007".'),
    },
    async ({ agreementId, payload, now: nowStr, includeObligationsHash, agentId }) => {
      const rec = await loadContract(agreementId);
      if (!rec) {
        throw new Error(`No agreement with id '${agreementId}'. Call create_agreement first.`);
      }
      const nowIso = nowStr ?? new Date().toISOString();

      let request: unknown;
      try {
        request = JSON.parse(payload);
      } catch (err: unknown) {
        throw new Error(`payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }

      process.stderr.write(
        `[trigger-agreement] agreementId=${agreementId} requestId=${
          (request as Record<string, unknown>)['requestId'] ?? 'unknown'
        }\n`
      );

      const proc = await getProcessor(rec.templatePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let triggerResponse: any;
      try {
        triggerResponse = await proc.trigger(rec.contractData, request, rec.state, nowIso);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`TemplateArchiveProcessor.trigger failed: ${msg}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = triggerResponse?.result as any;
      if (!result || typeof result.decision !== 'string') {
        throw new Error(
          `Template logic returned an unexpected shape: ${JSON.stringify(triggerResponse)}`
        );
      }

      const decision: AuthorizationDecision = {
        requestId: result.requestId,
        decision: result.decision as AuthorizationOutcome,
        reasons: result.reasons ?? [],
        obligations: (result.obligations ?? []) as Obligation[],
        newState: triggerResponse.state,
        triggerResponse,
      };

      if (includeObligationsHash && decision.obligations.length > 0) {
        const canonicalObligations = canonicalJSONStringify(decision.obligations);
        decision.obligationsHash = sha256Hex(canonicalObligations);
        decision.canonicalObligations = canonicalObligations;
      }

      // Persist new state + append audit entry.
      rec.state = triggerResponse.state ?? rec.state;
      rec.history.push({
        at: nowIso,
        request,
        decision: decision.decision,
        obligationsHash: decision.obligationsHash,
      });
      rec.updatedAt = new Date().toISOString();
      await saveContract(rec);

      process.stderr.write(
        `[trigger-agreement] decision=${decision.decision} obligations=${decision.obligations.length} hash=${decision.obligationsHash ?? 'n/a'} historyLen=${rec.history.length}\n`
      );

      // ── AP2 mandate chain — side-effect of authorization ───────────────────
      // DENIED decisions produce no payment mandate. APPROVED and
      // REQUIRES_HUMAN_APPROVAL both advance through the full chain.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ap2: any = null;
      if (decision.decision !== 'DENIED') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req = request as any;
        const merchantId: string = req.vendorId ?? 'unknown-vendor';
        const merchantName: string = VENDOR_NAMES[merchantId] ?? merchantId;
        const amountMinorUnits = Math.round((req.amount?.doubleValue ?? 0) * 100);
        const currency: string = req.amount?.currencyCode ?? 'USD';

        const checkoutMandate = buildCheckoutMandate({
          agentId,
          merchantId,
          merchantName,
          items: [{ id: merchantId + '-sku', title: req.productName ?? merchantId, price: amountMinorUnits }],
          totalAmount: { amount: amountMinorUnits, currency },
          obligationsHash: decision.obligationsHash,
          templateId: rec.templatePath,
        });

        const paymentMandate = buildPaymentMandate({
          checkoutMandate,
          paymentInstrument: { id: 'pi-acme-corp-visa', type: 'card', description: 'Acme Corp Visa ****4242' },
        });

        // Stubs log to console.log — redirect to stderr so we don't corrupt
        // the JSON-RPC stdio channel.
        const origLog = console.log.bind(console);
        const origWarn = console.warn.bind(console);
        console.log = (...args: unknown[]) =>
          process.stderr.write('[ap2] ' + args.map(String).join(' ') + '\n');
        console.warn = (...args: unknown[]) =>
          process.stderr.write('[ap2] ' + args.map(String).join(' ') + '\n');

        let checkoutReceipt: CheckoutReceipt;
        let paymentReceipt: PaymentReceipt;
        try {
          checkoutReceipt = new StubMerchant('stub-merchant.demo.local').receiveCheckoutMandate(checkoutMandate);
          paymentReceipt = new StubPaymentProcessor('stub-processor.demo.local').processPayment(paymentMandate);
        } finally {
          console.log = origLog;
          console.warn = origWarn;
        }

        const obligationsHashVerified =
          !!decision.obligationsHash &&
          checkoutMandate.accordObligations?.hash === decision.obligationsHash;

        ap2 = {
          checkoutReceipt,
          paymentReceipt,
          obligationsHashVerified,
          mandateChain: {
            checkoutHash: checkoutMandate.checkout_hash,
            paymentTransactionId: paymentReceipt.payment_id ?? null,
            accordObligationsHash: checkoutMandate.accordObligations?.hash ?? null,
          },
        };

        process.stderr.write(
          `[trigger-agreement] ap2 checkout=${checkoutReceipt.status} payment=${paymentReceipt.status} hashVerified=${obligationsHashVerified}\n`
        );
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ...decision, ap2 }, null, 2) }],
      };
    }
  );
}
