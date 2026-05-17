import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { canonicalJSONStringify } from '../lib/canonical.js';
import { sha256Hex } from '../lib/hash.js';

/**
 * Fully implemented (not a stub).
 * Canonicalises the obligations array (stable key sort, deep) then SHA-256 hashes it.
 */
export function registerComputeObligationsHash(server: McpServer): void {
  server.tool(
    'computeObligationsHash',
    'Canonicalises an obligations array (stable JSON, sorted keys) and returns its SHA-256 hash. Useful for AP2 payment attestation.',
    {
      obligations: z
        .array(z.unknown())
        .describe('Array of obligation objects to hash'),
    },
    async ({ obligations }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const canonicalForm = canonicalJSONStringify(obligations);
      const hash = sha256Hex(canonicalForm);

      const result = {
        algorithm: 'SHA-256',
        hash,
        canonicalForm,
      };

      process.stderr.write(`[computeObligationsHash] hashed ${obligations.length} obligation(s) → ${hash}\n`);

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
