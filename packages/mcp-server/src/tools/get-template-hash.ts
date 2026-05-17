import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import pkg from '@accordproject/cicero-core';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// cicero-core is CJS; pull Template off the default export.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Template } = pkg as any;

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const DEFAULT_TEMPLATE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'agent-saas-authority'
);

/**
 * Cache template hash computations: hashing involves loading the template
 * (with external CTO fetches) so we cache per templatePath.
 */
const hashCache = new Map<string, { templateIdentifier: string; templateHash: string }>();

export async function computeTemplateHash(
  templatePath: string
): Promise<{ templateIdentifier: string; templateHash: string }> {
  const cached = hashCache.get(templatePath);
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tpl: any = await Template.fromDirectory(templatePath);
  const out = {
    templateIdentifier: tpl.getIdentifier() as string,
    templateHash: tpl.getHash() as string,
  };
  hashCache.set(templatePath, out);
  return out;
}

export function registerGetTemplateHash(server: McpServer): void {
  server.tool(
    'getTemplate',
    'Retrieve a template by ID. Returns the canonical Cicero template hash (SHA-256 over metadata + grammar + models + scripts) and identifier for a template directory. This is the same getHash() exposed by @accordproject/cicero-core and is the integrity fingerprint used for author signatures.',
    {
      templateId: z
        .string()
        .optional()
        .describe(
          'Absolute path to the template directory, used as the template ID. Defaults to agent-saas-authority.'
        ),
    },
    async ({ templateId }) => {
      const resolved = templateId ?? DEFAULT_TEMPLATE_PATH;
      process.stderr.write(`[getTemplate] computing for ${resolved}\n`);
      const { templateIdentifier, templateHash } = await computeTemplateHash(resolved);
      const result = {
        id: templateIdentifier,
        hash: templateHash,
        algorithm:
          'cicero-core@0.25 Template.getHash() — sha256 over canonical JSON of { metadata, grammar, models, scripts }',
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
