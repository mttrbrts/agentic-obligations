import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { deleteContract } from '../lib/contract-store.js';

export function registerDeleteAgreement(server: McpServer): void {
  server.tool(
    'delete_agreement',
    'Deletes a stored agreement by id. Returns whether a record was actually removed.',
    {
      agreementId: z.string().describe('Identifier of the agreement to delete.'),
    },
    async ({ agreementId }) => {
      const removed = await deleteContract(agreementId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ agreementId, removed }, null, 2),
          },
        ],
      };
    }
  );
}
