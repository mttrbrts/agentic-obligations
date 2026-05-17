import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadContract } from '../lib/contract-store.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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

export function registerConvertAgreementToFormat(server: McpServer): void {
  server.tool(
    'convert-agreement-to-format',
    'Converts an existing agreement to an output format (html or markdown) using TemplateArchiveProcessor.draft(). The agreement must exist (created via create_agreement).',
    {
      agreementId: z.string().describe('Identifier of an existing agreement.'),
      format: z.enum(['html', 'markdown']).describe('Output format: html or markdown.'),
    },
    async ({ agreementId, format }) => {
      const rec = await loadContract(agreementId);
      if (!rec) {
        throw new Error(
          `No agreement with id '${agreementId}'. Call create_agreement first.`
        );
      }

      process.stderr.write(
        `[convert-agreement-to-format] agreementId=${agreementId} format=${format}\n`
      );

      const proc = await getProcessor(rec.templatePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let drafted: any;
      try {
        drafted = await proc.draft(rec.contractData, format);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`TemplateArchiveProcessor.draft() failed: ${msg}`);
      }

      const text = typeof drafted === 'string' ? drafted : JSON.stringify(drafted, null, 2);

      return {
        content: [{ type: 'text' as const, text }],
      };
    }
  );
}
