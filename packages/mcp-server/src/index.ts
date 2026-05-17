#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTriggerAgreement } from './tools/authorize-procurement.js';
import { registerComputeObligationsHash } from './tools/compute-obligations-hash.js';
import { registerLoadTemplate } from './tools/load-template.js';
import { registerGetTemplateHash } from './tools/get-template-hash.js';
import { registerCreateAgreement } from './tools/create-agreement.js';
import { registerGetAgreement } from './tools/get-agreement.js';
import { registerListAgreements } from './tools/list-agreements.js';
import { registerDeleteAgreement } from './tools/delete-agreement.js';
import { registerConvertAgreementToFormat } from './tools/convert-agreement-to-format.js';

async function main(): Promise<void> {
  const server = new McpServer(
    { name: 'accord-obligations-mcp', version: '0.1.0' },
    { capabilities: { logging: {} } }
  );

  // Register all tools
  registerCreateAgreement(server);
  registerGetAgreement(server);
  registerListAgreements(server);
  registerDeleteAgreement(server);
  registerTriggerAgreement(server);
  registerComputeObligationsHash(server);
  registerLoadTemplate(server);
  registerGetTemplateHash(server);
  registerConvertAgreementToFormat(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[accord-obligations-mcp] server running on stdio\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`[accord-obligations-mcp] fatal: ${String(err)}\n`);
  process.exit(1);
});
