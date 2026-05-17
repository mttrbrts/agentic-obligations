import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listContracts } from '../lib/contract-store.js';

export function registerListAgreements(server: McpServer): void {
  server.tool(
    'list_agreements',
    'Lists all stored agreements with their template identifier and creation timestamp.',
    {},
    async () => {
      const items = await listContracts();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ items }, null, 2) }],
      };
    }
  );
}
