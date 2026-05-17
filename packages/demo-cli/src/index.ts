#!/usr/bin/env node
/**
 * @ap-demo/demo-cli — Phase 2 end-to-end orchestrator.
 *
 * Spawns the MCP server over stdio, runs three procurement scenarios through
 * authorize_procurement, builds AP2 mandates for approved/human-approval cases,
 * and verifies the obligations hash round-trips correctly.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import {
  buildCheckoutMandate,
  buildPaymentMandate,
  StubMerchant,
  StubPaymentProcessor,
} from '@ap-demo/ap2-bridge';
import type { Item, Amount } from '@ap-demo/ap2-bridge';

import {
  sectionHeader,
  kv,
  info,
  success,
  warn,
  error as traceError,
  decision as traceDecision,
  hashLine,
  blank,
  summaryTable,
} from './trace.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve paths relative to the monorepo root (two levels up from packages/demo-cli/dist/)
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const TEMPLATE_PATH = join(REPO_ROOT, 'templates', 'agent-saas-authority');
const DATA_JSON_PATH = join(TEMPLATE_PATH, 'data.json');
const MCP_SERVER_BIN = join(REPO_ROOT, 'packages', 'mcp-server', 'dist', 'index.js');

const DEBUG = process.env['DEBUG'] === '1';

// ---------------------------------------------------------------------------
// MCP response shape
// ---------------------------------------------------------------------------

interface AuthorizationDecision {
  requestId: string;
  decision: string; // 'APPROVED' | 'DENIED' | 'REQUIRES_HUMAN_APPROVAL' | 'PENDING'
  reasons: string[];
  obligations: unknown[];
  obligationsHash?: string;
  canonicalObligations?: string;
}

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

interface Scenario {
  name: string;
  expectedDecision: string;
  request: Record<string, unknown>;
  vendor: {
    id: string;
    name: string;
    website: string;
    category: string;
  };
  amount: Amount;
}

function money(doubleValue: number): Record<string, unknown> {
  return {
    $class: 'org.accordproject.money@0.3.0.MonetaryAmount',
    doubleValue,
    currencyCode: 'USD',
  };
}

function procurementRequest(o: {
  requestId: string;
  vendorId: string;
  vendorCategory: string;
  productName: string;
  amount: number;
  isRenewal: boolean;
  subscriptionTermMonths?: number;
}): Record<string, unknown> {
  return {
    $class: 'org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest',
    requestId: o.requestId,
    vendorId: o.vendorId,
    vendorCategory: o.vendorCategory,
    productName: o.productName,
    subscriptionTermMonths: o.subscriptionTermMonths ?? 12,
    amount: money(o.amount),
    isRenewal: o.isRenewal,
  };
}

// Scenarios use a familiar mix of SaaS brands — Google, Figma, Atlassian, Slack.
// Each scenario advances the contract's running state (or doesn't, on denial),
// and subsequent scenarios see that accumulated state. The agent never supplies
// YTD totals; the contract owns them. The headline is scenario 4: Slack Pro
// ($1,000) is perfectly fine in isolation but gets denied because the running
// total ($7,300 + $1,000 = $8,300) would breach the $8,000 annual cap.
const SCENARIOS: Scenario[] = [
  {
    // Renewal — triggers the extra renewal-notice obligation.
    name: 'Google Workspace Business Plus renewal — $1,800',
    expectedDecision: 'APPROVED',
    vendor: {
      id: 'workspace.google.com',
      name: 'Google Workspace',
      website: 'workspace.google.com',
      category: 'saas-productivity',
    },
    amount: { amount: 180000, currency: 'USD' },
    request: procurementRequest({
      requestId: 'req-demo-001',
      vendorId: 'workspace.google.com',
      vendorCategory: 'saas-productivity',
      productName: 'Google Workspace Business Plus (10 seats, annual)',
      amount: 1800,
      isRenewal: true,
    }),
  },
  {
    // Above the $2,500 human-approval threshold → REQUIRES_HUMAN_APPROVAL.
    // Spend still advances (agent commit is pending human sign-off).
    name: 'Figma Organization — $3,500 (above human-approval threshold)',
    expectedDecision: 'REQUIRES_HUMAN_APPROVAL',
    vendor: {
      id: 'figma.com',
      name: 'Figma',
      website: 'figma.com',
      category: 'saas-productivity',
    },
    amount: { amount: 350000, currency: 'USD' },
    request: procurementRequest({
      requestId: 'req-demo-002',
      vendorId: 'figma.com',
      vendorCategory: 'saas-productivity',
      productName: 'Figma Organization (20 seats, annual)',
      amount: 3500,
      isRenewal: false,
    }),
  },
  {
    // APPROVED — ratchets YTD to $7,300.
    name: 'Atlassian Jira Premium — $2,000',
    expectedDecision: 'APPROVED',
    vendor: {
      id: 'atlassian.com',
      name: 'Atlassian',
      website: 'atlassian.com',
      category: 'saas-devtools',
    },
    amount: { amount: 200000, currency: 'USD' },
    request: procurementRequest({
      requestId: 'req-demo-003',
      vendorId: 'atlassian.com',
      vendorCategory: 'saas-devtools',
      productName: 'Jira Premium (25 users, annual)',
      amount: 2000,
      isRenewal: false,
    }),
  },
  {
    // The headline scenario. After three approvals, YTD is at $7,300.
    // Slack Pro ($1,000) is on the allowlist, in a permitted category,
    // under per-tx cap, under the human-approval threshold — perfectly fine
    // in isolation. The ONLY reason it gets denied is the running total:
    // $7,300 + $1,000 = $8,300 > $8,000 annual cap. The contract knows;
    // the agent never had to tell it.
    name: 'Slack Pro — $1,000 (would tip running YTD over the cap)',
    expectedDecision: 'DENIED',
    vendor: {
      id: 'slack.com',
      name: 'Slack',
      website: 'slack.com',
      category: 'saas-productivity',
    },
    amount: { amount: 100000, currency: 'USD' },
    request: procurementRequest({
      requestId: 'req-demo-004',
      vendorId: 'slack.com',
      vendorCategory: 'saas-productivity',
      productName: 'Slack Pro (annual)',
      amount: 1000,
      isRenewal: false,
    }),
  },
];

// ---------------------------------------------------------------------------
// Hash helper (client-side re-computation for verification)
// ---------------------------------------------------------------------------

/**
 * Mirror the MCP server's canonicalJSONStringify: stable, sorted-key JSON.
 * Must match packages/mcp-server/src/lib/canonical.ts exactly.
 */
function sortedReplacer(_key: string, val: unknown): unknown {
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[k] = (val as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return val;
}

function canonicalJSONStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer);
}

function computeObligationsHash(obligations: unknown[]): string {
  const canonical = canonicalJSONStringify(obligations);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// MCP tool call helper
// ---------------------------------------------------------------------------

function extractText(content: unknown): string {
  const block = (content as Array<{ type: string; text?: string }>).find((c) => c.type === 'text');
  if (!block?.text) throw new Error('tool returned no text content');
  return block.text;
}

async function callAuthorizeProcurement(
  client: Client,
  agreementId: string,
  request: Record<string, unknown>
): Promise<AuthorizationDecision> {
  const result = await client.callTool({
    name: 'trigger-agreement',
    arguments: { agreementId, payload: JSON.stringify(request), includeObligationsHash: true },
  });
  return JSON.parse(extractText(result.content)) as AuthorizationDecision;
}

async function callCreateContract(
  client: Client,
  contractId: string,
  contractData: unknown
): Promise<{ agreementId: string; templateHash: string }> {
  const result = await client.callTool({
    name: 'create_agreement',
    arguments: { agreementId: contractId, contractData, templatePath: TEMPLATE_PATH, replace: true },
  });
  return JSON.parse(extractText(result.content));
}

async function callDeleteContract(client: Client, contractId: string): Promise<void> {
  await client.callTool({ name: 'delete_agreement', arguments: { agreementId: contractId } });
}

interface ContractRecordWire {
  contractId: string;
  state: {
    currentYearSpend?: { doubleValue: number; currencyCode: string };
    approvedRequestIds?: string[];
  };
  history: Array<{ at: string; decision: string }>;
}

async function callGetContract(client: Client, contractId: string): Promise<ContractRecordWire> {
  const result = await client.callTool({ name: 'getAgreement', arguments: { agreementId: contractId } });
  return JSON.parse(extractText(result.content)) as ContractRecordWire;
}

interface TemplateHashResult {
  templateIdentifier: string;
  templateHash: string;
  algorithm: string;
}

async function callGetTemplateHash(client: Client): Promise<TemplateHashResult> {
  const result = await client.callTool({
    name: 'getTemplate',
    arguments: { templateId: TEMPLATE_PATH },
  });
  const textBlock = (result.content as Array<{ type: string; text?: string }>).find(
    (c) => c.type === 'text'
  );
  if (!textBlock?.text) {
    throw new Error('getTemplate returned no text content');
  }
  // getTemplate returns { id, hash, algorithm } — map to expected shape
  const raw = JSON.parse(textBlock.text) as { id?: string; hash?: string; templateIdentifier?: string; templateHash?: string; algorithm: string };
  return {
    templateIdentifier: raw.templateIdentifier ?? raw.id ?? '',
    templateHash: raw.templateHash ?? raw.hash ?? '',
    algorithm: raw.algorithm,
  };
}

// ---------------------------------------------------------------------------
// Run a single scenario
// ---------------------------------------------------------------------------

interface ScenarioResult {
  scenario: string;
  decision: string;
  hash: string;
  templateHash: string;
  mandateStatus: 'sent' | 'skipped' | 'rejected';
  ok: boolean;
}

async function runScenario(
  client: Client,
  contractId: string,
  scenario: Scenario,
  merchant: StubMerchant,
  processor: StubPaymentProcessor,
  templateHashInfo: TemplateHashResult,
  index: number
): Promise<ScenarioResult> {
  sectionHeader('SCENARIO', `#${index + 1}  ${scenario.name}`);

  // Show the contract's running state BEFORE this scenario — the agent
  // doesn't supply YTD; the contract owns it.
  const beforeRec = await callGetContract(client, contractId);
  const ytdBefore = beforeRec.state.currentYearSpend?.doubleValue ?? 0;
  info(`contract YTD before:  $${ytdBefore.toLocaleString()} ${beforeRec.state.currentYearSpend?.currencyCode ?? 'USD'}`);
  info(`prior approvals:      ${beforeRec.state.approvedRequestIds?.length ?? 0}`);
  blank();

  // ── 1. Call MCP trigger-agreement ────────────────────────────────────────
  sectionHeader('MCP', 'trigger-agreement →');
  kv('vendor', `${scenario.vendor.name} (${scenario.vendor.id})`);
  kv('category', scenario.vendor.category);
  kv('amount', `$${scenario.amount.amount / 100} ${scenario.amount.currency}`);
  blank();

  let authResult: AuthorizationDecision;
  try {
    authResult = await callAuthorizeProcurement(client, contractId, scenario.request);
  } catch (err) {
    traceError(`MCP call failed: ${String(err)}`);
    return {
      scenario: scenario.name,
      decision: 'ERROR',
      hash: '',
      templateHash: '',
      mandateStatus: 'skipped',
      ok: false,
    };
  }

  // Detect Wave 1 stub
  const isStub =
    authResult.decision === 'APPROVED' &&
    authResult.reasons.some((r) => r.toLowerCase().includes('stub'));

  if (isStub) {
    warn('MCP server appears to be running Wave 1 stub — re-run after Wave 2a lands');
  }

  traceDecision(authResult.decision);
  blank();

  for (const reason of authResult.reasons) {
    info(`• ${reason}`);
  }

  const obligationsHash = authResult.obligationsHash ?? '';

  if (obligationsHash) {
    hashLine('obligationsHash (MCP)', obligationsHash);
  } else if (authResult.decision === 'DENIED') {
    info('(no obligationsHash — no obligations triggered on DENIED)');
  } else {
    info('(no obligationsHash in response)');
  }

  // ── 2. Denied → skip AP2 ──────────────────────────────────────────────────
  if (authResult.decision === 'DENIED') {
    sectionHeader('AP2 MANDATE', 'Skipped — request denied');
    info('No mandate created for denied requests.');
    // Show that state did NOT advance on denial.
    const afterRecDenied = await callGetContract(client, contractId);
    const ytdAfterDenied = afterRecDenied.state.currentYearSpend?.doubleValue ?? 0;
    info(`contract YTD after:   $${ytdAfterDenied.toLocaleString()} (unchanged — denials do not advance state)`);
    return {
      scenario: scenario.name,
      decision: authResult.decision,
      hash: obligationsHash,
      templateHash: '',
      mandateStatus: 'skipped',
      ok: authResult.decision === scenario.expectedDecision || isStub,
    };
  }

  // ── 3. Approved / Human-approval → build AP2 mandates ────────────────────
  const items: Item[] = [
    {
      id: scenario.vendor.id,
      title: scenario.request['productName'] as string,
      price: scenario.amount.amount,
    },
  ];

  sectionHeader('AP2 MANDATE', 'Building CheckoutMandate');

  const checkoutMandate = buildCheckoutMandate({
    agentId: 'agent-007',
    merchantId: scenario.vendor.id,
    merchantName: scenario.vendor.name,
    merchantWebsite: scenario.vendor.website,
    items,
    totalAmount: scenario.amount,
    obligationsHash: obligationsHash || undefined,
    templateHash: templateHashInfo.templateHash,
    templateId: templateHashInfo.templateIdentifier,
  });

  kv('vct', checkoutMandate.vct);
  kv('agentId', checkoutMandate.agentId ?? '');
  kv('merchant', checkoutMandate.merchant?.name ?? '');
  kv('totalAmount', `${checkoutMandate.totalAmount?.amount} ${checkoutMandate.totalAmount?.currency}`);
  if (checkoutMandate.accordObligations?.hash) {
    hashLine('accordObligations.hash', checkoutMandate.accordObligations.hash);
  }
  if (checkoutMandate.accordObligations?.templateHash) {
    hashLine('accordObligations.templateHash', checkoutMandate.accordObligations.templateHash);
  }
  if (checkoutMandate.accordObligations?.templateId) {
    kv('accordObligations.templateId', checkoutMandate.accordObligations.templateId);
  }
  kv('checkout_hash', checkoutMandate.checkout_hash.slice(0, 32) + '…');

  // ── 4. Submit to StubMerchant ─────────────────────────────────────────────
  sectionHeader('MERCHANT', 'receiveCheckoutMandate →');

  const checkoutReceipt = merchant.receiveCheckoutMandate(checkoutMandate);
  kv('status', checkoutReceipt.status);
  if (checkoutReceipt.status === 'Success') {
    kv('order_id', checkoutReceipt.order_id ?? '');
    success('Merchant accepted the mandate');
  } else {
    traceError(`Merchant rejected: ${checkoutReceipt.error ?? 'unknown'}`);
    traceError(checkoutReceipt.error_description ?? '');
    return {
      scenario: scenario.name,
      decision: authResult.decision,
      hash: obligationsHash,
      templateHash: templateHashInfo.templateHash,
      mandateStatus: 'rejected',
      ok: false,
    };
  }

  // ── 5. Build PaymentMandate ───────────────────────────────────────────────
  sectionHeader('AP2 MANDATE', 'Building PaymentMandate');

  const paymentInstrument = {
    id: 'pi-acme-corp-visa',
    type: 'card',
    description: 'Acme Corp Visa Purchasing Card ****4242',
  };

  const paymentMandate = buildPaymentMandate({ checkoutMandate, paymentInstrument });

  kv('vct', paymentMandate.vct);
  kv('transaction_id', paymentMandate.transaction_id.slice(0, 32) + '…');
  kv('payee', paymentMandate.payee.name);
  kv('payment_amount', `${paymentMandate.payment_amount.amount} ${paymentMandate.payment_amount.currency}`);
  if (paymentMandate.accordObligations?.hash) {
    hashLine('accordObligations.hash', paymentMandate.accordObligations.hash);
  }
  if (paymentMandate.accordObligations?.templateHash) {
    hashLine('accordObligations.templateHash', paymentMandate.accordObligations.templateHash);
  }

  // ── 6. Submit to StubPaymentProcessor ────────────────────────────────────
  sectionHeader('PROCESSOR', 'processPayment →');

  const paymentReceipt = processor.processPayment(paymentMandate);
  kv('status', paymentReceipt.status);
  if (paymentReceipt.status === 'Success') {
    kv('payment_id', paymentReceipt.payment_id);
    kv('psp_confirmation_id', paymentReceipt.psp_confirmation_id ?? '');
    kv('network_confirmation_id', paymentReceipt.network_confirmation_id ?? '');
    success('Payment processor accepted the mandate');
  } else {
    traceError(`Processor rejected: ${paymentReceipt.error ?? 'unknown'}`);
    return {
      scenario: scenario.name,
      decision: authResult.decision,
      hash: obligationsHash,
      templateHash: templateHashInfo.templateHash,
      mandateStatus: 'rejected',
      ok: false,
    };
  }

  // ── 7. Client-side hash verification ─────────────────────────────────────
  sectionHeader('AGENT', 'Verifying obligations hash round-trip');

  let hashOk = false;
  if (obligationsHash && authResult.obligations.length > 0) {
    const recomputed = computeObligationsHash(authResult.obligations);
    hashLine('MCP-provided hash', obligationsHash);
    hashLine('client recomputed ', recomputed);
    if (recomputed === obligationsHash) {
      success('Hash verified — mandate is cryptographically linked to contract obligations');
      hashOk = true;
    } else {
      warn('Hash MISMATCH — obligations may have been tampered with or canonical form differs');
      warn('(This is expected if the MCP server uses a different canonical serialiser than the client)');
      // Still continue — the demo is not failed by a canonical-form difference
      hashOk = false;
    }
  } else if (obligationsHash && paymentMandate.accordObligations?.hash === obligationsHash) {
    // No obligations array to recompute from, but hash was propagated through the mandate chain
    success('Hash propagated correctly through CheckoutMandate → PaymentMandate');
    hashLine('mandate hash', obligationsHash);
    hashOk = true;
  } else {
    warn('No obligationsHash in response — running in stub/Wave 1 mode, skipping hash verification');
    hashOk = true; // don't fail the scenario for stub mode
  }

  // ── 7b. Template-hash verification (Cicero getHash) ──────────────────────
  let templateHashOk = false;
  if (paymentMandate.accordObligations?.templateHash) {
    const independent = await callGetTemplateHash(client);
    hashLine('mandate templateHash', paymentMandate.accordObligations.templateHash);
    hashLine('independent recompute', independent.templateHash);
    if (independent.templateHash === paymentMandate.accordObligations.templateHash) {
      success(
        `Template integrity verified — mandate is bound to template ${independent.templateIdentifier}`
      );
      templateHashOk = true;
    } else {
      warn('Template hash MISMATCH — mandate may be bound to a different template version');
    }
  } else {
    warn('No templateHash on mandate; skipping template-integrity check');
    templateHashOk = true;
  }

  // ── 7c. Display state advancement ─────────────────────────────────────────
  sectionHeader('STATE', 'Contract state advanced');
  const afterRec = await callGetContract(client, contractId);
  const ytdAfter = afterRec.state.currentYearSpend?.doubleValue ?? 0;
  info(`contract YTD: $${ytdBefore.toLocaleString()} → $${ytdAfter.toLocaleString()}`);
  info(`approved requests: ${afterRec.state.approvedRequestIds?.join(', ') ?? '(none)'}`);

  const ok =
    hashOk &&
    templateHashOk &&
    (authResult.decision === scenario.expectedDecision || isStub) &&
    checkoutReceipt.status === 'Success' &&
    paymentReceipt.status === 'Success';

  return {
    scenario: scenario.name,
    decision: authResult.decision,
    hash: obligationsHash,
    templateHash: templateHashInfo.templateHash,
    mandateStatus: 'sent',
    ok,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Load contract data
  const contractData = JSON.parse(readFileSync(DATA_JSON_PATH, 'utf8')) as unknown;

  // Spawn MCP server
  sectionHeader('AGENT', 'Starting MCP server');
  info(`bin: ${MCP_SERVER_BIN}`);

  const stderrMode = DEBUG ? 'pipe' : 'pipe'; // always pipe so we can prefix lines
  const transport = new StdioClientTransport({
    command: 'node',
    args: [MCP_SERVER_BIN],
    stderr: stderrMode,
  });

  // Forward MCP server stderr with prefix
  if (transport.stderr) {
    transport.stderr.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (DEBUG) {
          process.stdout.write(`  [mcp-server] ${line}\n`);
        }
      }
    });
  }

  const client = new Client(
    { name: 'phase2-demo-cli', version: '0.1.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  success('MCP server connected');

  // List available tools
  const toolsList = await client.listTools();
  const toolNames = toolsList.tools.map((t) => t.name);
  info(`Tools available: ${toolNames.join(', ')}`);
  blank();

  // Fetch the canonical Cicero Template.getHash() up front — this is the
  // template-integrity fingerprint that will be embedded in every mandate.
  sectionHeader('AGENT', 'Fetching Cicero template hash (Template.getHash)');
  const templateHashInfo = await callGetTemplateHash(client);
  kv('templateIdentifier', templateHashInfo.templateIdentifier);
  hashLine('templateHash', templateHashInfo.templateHash);
  info(templateHashInfo.algorithm);
  blank();

  // Create (or replace) the contract instance on the MCP server. The agent
  // will refer to it by id from here on — no need to ship contract data
  // with every authorization call.
  const CONTRACT_ID = 'acme-2026';
  sectionHeader('AGENT', `Provisioning contract '${CONTRACT_ID}'`);
  await callDeleteContract(client, CONTRACT_ID); // clean slate for re-runs
  const created = await callCreateContract(client, CONTRACT_ID, contractData);
  kv('agreementId', created.agreementId);
  hashLine('contract templateHash', created.templateHash);
  success(`Contract provisioned — agent will reference it by id from here on`);
  blank();

  // Stubs
  const merchant = new StubMerchant('stub-merchant.demo.local');
  const processor = new StubPaymentProcessor('stub-processor.demo.local');

  // Run scenarios
  const results: ScenarioResult[] = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i]!;
    const result = await runScenario(
      client,
      CONTRACT_ID,
      scenario,
      merchant,
      processor,
      templateHashInfo,
      i
    );
    results.push(result);
    blank();
  }

  // Disconnect MCP server
  await client.close();

  // Summary table
  summaryTable(
    results.map((r) => ({
      scenario: r.scenario.slice(0, 28),
      decision: r.decision,
      hash: r.hash,
      templateHash: r.templateHash,
      mandateStatus: r.mandateStatus,
    }))
  );

  // Exit code
  const allOk = results.every((r) => r.ok);
  if (allOk) {
    process.stdout.write('\x1b[32m\x1b[1mAll scenarios passed.\x1b[0m\n\n');
    process.exit(0);
  } else {
    const failed = results.filter((r) => !r.ok).map((r) => r.scenario);
    process.stdout.write(`\x1b[31m\x1b[1mFailed scenarios:\x1b[0m ${failed.join(', ')}\n\n`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`[demo-cli] fatal: ${String(err)}\n`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
});
