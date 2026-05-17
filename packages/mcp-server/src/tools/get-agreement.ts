import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadContract } from '../lib/contract-store.js';

export function registerGetAgreement(server: McpServer): void {
  server.tool(
    'getAgreement',
    'Retrieve an agreement by ID. Returns the stored agreement data, current state, and trigger history for a given agreementId. Use this to inspect what the agreement knows about itself between trigger calls.',
    {
      agreementId: z.string().describe('Identifier of the agreement to look up.'),
    },
    async ({ agreementId }) => {
      const rec = await loadContract(agreementId);
      if (!rec) {
        throw new Error(`No agreement with id '${agreementId}'`);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(rec, null, 2) }],
      };
    }
  );
}
