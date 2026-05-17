import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  ContractRecord,
  loadContract,
  saveContract,
} from '../lib/contract-store.js';
import { computeTemplateHash } from './get-template-hash.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

const DEFAULT_TEMPLATE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'agent-saas-authority'
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const templateCache = new Map<string, any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTemplate(path: string): Promise<any> {
  const cached = templateCache.get(path);
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cc = require('@accordproject/cicero-core') as any;
  const tpl = await cc.Template.fromDirectory(path);
  templateCache.set(path, tpl);
  return tpl;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getProcessor(path: string): Promise<any> {
  const tpl = await loadTemplate(path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const te = require('@accordproject/template-engine') as any;
  return new te.TemplateArchiveProcessor(tpl);
}

export function registerCreateAgreement(server: McpServer): void {
  server.tool(
    'create_agreement',
    'Creates a new agreement instance from the supplied template and agreement data. Calls TemplateArchiveProcessor.init() to seed the initial state, then persists everything under an agreementId. Subsequent calls to trigger_agreement reference the agreement by id without re-supplying the agreement data.',
    {
      contractData: z
        .object({})
        .passthrough()
        .describe('Agreement instance (Concerto JSON conforming to the template model).'),
      agreementId: z
        .string()
        .optional()
        .describe('Identifier to use for the agreement. Defaults to a derived agreement id.'),
      templatePath: z
        .string()
        .optional()
        .describe('Absolute path to the template directory. Defaults to agent-saas-authority.'),
      replace: z
        .boolean()
        .optional()
        .default(false)
        .describe('When true, overwrite any existing agreement with this id.'),
    },
    async ({ contractData, agreementId, templatePath, replace }) => {
      const resolvedTemplatePath = templatePath ?? DEFAULT_TEMPLATE_PATH;
      const id =
        agreementId ??
        (contractData as Record<string, unknown>)['contractId']?.toString() ??
        'default';

      const existing = await loadContract(id);
      if (existing && !replace) {
        throw new Error(
          `Agreement '${id}' already exists. Pass replace: true to overwrite, or delete_agreement first.`
        );
      }

      // Compute the template hash once at create time — it locks the rules
      // for this contract instance.
      const { templateIdentifier, templateHash } = await computeTemplateHash(resolvedTemplatePath);

      // Run init() to get the initial state. If the template doesn't define
      // an init function, the runtime returns undefined and we fall back to
      // a minimal State stamp.
      const proc = await getProcessor(resolvedTemplatePath);
      let initialState: unknown;
      try {
        const initResp = await proc.init(contractData);
        initialState =
          initResp?.state ?? {
            $class: 'org.accordproject.runtime@0.2.0.State',
            $identifier: `state-${id}`,
          };
      } catch (err: unknown) {
        process.stderr.write(
          `[create_agreement] init() raised ${err instanceof Error ? err.message : String(err)} — falling back to empty State\n`
        );
        initialState = {
          $class: 'org.accordproject.runtime@0.2.0.State',
          $identifier: `state-${id}`,
        };
      }

      const now = new Date().toISOString();
      const rec: ContractRecord = {
        contractId: id,
        templatePath: resolvedTemplatePath,
        templateIdentifier,
        templateHash,
        contractData,
        state: initialState,
        history: [],
        createdAt: now,
        updatedAt: now,
      };
      await saveContract(rec);

      process.stderr.write(
        `[create_agreement] id=${id} template=${templateIdentifier} hash=${templateHash.slice(0, 12)}…\n`
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                agreementId: id,
                templateIdentifier,
                templateHash,
                initialState,
                createdAt: now,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
