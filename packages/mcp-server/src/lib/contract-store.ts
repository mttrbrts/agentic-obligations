/**
 * One-JSON-file-per-contract persistence for the demo MCP server.
 *
 * Each contract lives at `.state/<contractId>.json` under the mcp-server
 * package directory. The store is intentionally simple — it's a stand-in
 * for whatever real backend (SQLite, Postgres, KV) a production AP runtime
 * would use. Records are loaded on demand and rewritten in full on update.
 */
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATE_DIR = join(__dirname, '..', '..', '.state');

export interface HistoryEntry {
  at: string;
  request: unknown;
  decision: string;
  obligationsHash?: string;
}

export interface ContractRecord {
  contractId: string;
  templatePath: string;
  templateIdentifier: string;
  templateHash: string;
  contractData: unknown;
  state: unknown;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

function recordPath(contractId: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(contractId)) {
    throw new Error(`Invalid contractId '${contractId}': use [A-Za-z0-9_.-]+ only`);
  }
  return join(STATE_DIR, `${contractId}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
}

export async function loadContract(contractId: string): Promise<ContractRecord | null> {
  try {
    const text = await readFile(recordPath(contractId), 'utf8');
    return JSON.parse(text) as ContractRecord;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveContract(rec: ContractRecord): Promise<void> {
  await ensureDir();
  // Ensure parent dir exists (in case the path mentions a sub-dir)
  await mkdir(dirname(recordPath(rec.contractId)), { recursive: true });
  await writeFile(recordPath(rec.contractId), JSON.stringify(rec, null, 2), 'utf8');
}

export async function deleteContract(contractId: string): Promise<boolean> {
  try {
    await unlink(recordPath(contractId));
    return true;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw err;
  }
}

export async function listContracts(): Promise<
  Array<{ contractId: string; templateIdentifier: string; createdAt: string }>
> {
  await ensureDir();
  const files = await readdir(STATE_DIR);
  const out: Array<{ contractId: string; templateIdentifier: string; createdAt: string }> = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const text = await readFile(join(STATE_DIR, f), 'utf8');
      const rec = JSON.parse(text) as ContractRecord;
      out.push({
        contractId: rec.contractId,
        templateIdentifier: rec.templateIdentifier,
        createdAt: rec.createdAt,
      });
    } catch {
      // Skip unreadable / malformed files silently.
    }
  }
  return out;
}

export function getStateDir(): string {
  return STATE_DIR;
}
