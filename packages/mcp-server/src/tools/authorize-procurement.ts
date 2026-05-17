import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { canonicalJSONStringify } from '../lib/canonical.js';
import { sha256Hex } from '../lib/hash.js';
import { loadContract, saveContract } from '../lib/contract-store.js';
import { createRequire } from 'node:module';

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
    },
    async ({ agreementId, payload, now: nowStr, includeObligationsHash }) => {
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

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(decision, null, 2) }],
      };
    }
  );
}
