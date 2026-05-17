/**
 * trace.ts — Pretty-printer for the demo CLI using ANSI escape codes.
 * No external dependencies.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';
const WHITE = '\x1b[37m';
const BG_DARK = '\x1b[40m';

export type SectionKind = 'AGENT' | 'MCP' | 'AP2 MANDATE' | 'MERCHANT' | 'PROCESSOR' | 'SUMMARY' | 'SCENARIO' | 'STATE';

const KIND_COLORS: Record<SectionKind, string> = {
  AGENT: CYAN,
  MCP: MAGENTA,
  'AP2 MANDATE': BLUE,
  MERCHANT: GREEN,
  PROCESSOR: YELLOW,
  SUMMARY: WHITE,
  SCENARIO: BOLD,
  STATE: CYAN,
};

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

export function sectionHeader(kind: SectionKind, title: string): void {
  const color = KIND_COLORS[kind] ?? WHITE;
  const label = `[ ${kind} ]`;
  const line = '─'.repeat(64);
  process.stdout.write(`\n${color}${BOLD}${line}${RESET}\n`);
  process.stdout.write(`${color}${BOLD}${BG_DARK}  ${label}  ${title}${RESET}\n`);
  process.stdout.write(`${color}${BOLD}${line}${RESET}\n`);
}

export function kv(key: string, value: string, indent = 2): void {
  const spaces = ' '.repeat(indent);
  process.stdout.write(`${spaces}${BOLD}${key}:${RESET} ${value}\n`);
}

export function info(msg: string, indent = 2): void {
  process.stdout.write(`${' '.repeat(indent)}${DIM}${msg}${RESET}\n`);
}

export function success(msg: string, indent = 2): void {
  process.stdout.write(`${' '.repeat(indent)}${GREEN}${BOLD}✓${RESET} ${msg}\n`);
}

export function warn(msg: string, indent = 2): void {
  process.stdout.write(`${' '.repeat(indent)}${YELLOW}${BOLD}⚠${RESET}  ${msg}\n`);
}

export function error(msg: string, indent = 2): void {
  process.stdout.write(`${' '.repeat(indent)}${RED}${BOLD}✗${RESET} ${msg}\n`);
}

export function decision(d: string): void {
  let color: string;
  let symbol: string;
  if (d === 'APPROVED') {
    color = GREEN;
    symbol = '✓';
  } else if (d === 'DENIED') {
    color = RED;
    symbol = '✗';
  } else {
    color = YELLOW;
    symbol = '⚑';
  }
  process.stdout.write(`\n  ${color}${BOLD}${symbol} DECISION: ${d}${RESET}\n`);
}

export function hashLine(label: string, hash: string): void {
  const short = hash ? hash.slice(0, 16) + '…' : '(none)';
  process.stdout.write(`  ${DIM}${label}:${RESET} ${CYAN}${short}${RESET}\n`);
}

export function blank(): void {
  process.stdout.write('\n');
}

export function summaryTable(
  rows: Array<{
    scenario: string;
    decision: string;
    hash: string;
    templateHash: string;
    mandateStatus: string;
  }>
): void {
  sectionHeader('SUMMARY', 'End-to-End Results');
  const W = [28, 26, 14, 14, 12];
  const header = [
    pad('Scenario', W[0]),
    pad('Decision', W[1]),
    pad('Oblig.Hash', W[2]),
    pad('Tmpl.Hash', W[3]),
    pad('Mandate', W[4]),
  ].join('  ');
  process.stdout.write(`\n  ${BOLD}${header}${RESET}\n`);
  process.stdout.write(`  ${'─'.repeat(W[0] + W[1] + W[2] + W[3] + W[4] + 8)}\n`);
  for (const r of rows) {
    let decColor = WHITE;
    if (r.decision === 'APPROVED') decColor = GREEN;
    else if (r.decision === 'DENIED') decColor = RED;
    else if (r.decision === 'REQUIRES_HUMAN_APPROVAL') decColor = YELLOW;

    let mColor = WHITE;
    if (r.mandateStatus === 'sent') mColor = GREEN;
    else if (r.mandateStatus === 'skipped') mColor = DIM;
    else if (r.mandateStatus === 'rejected') mColor = RED;

    const shortHash = r.hash ? r.hash.slice(0, 8) + '…' : '(none)';
    const shortTmpl = r.templateHash ? r.templateHash.slice(0, 8) + '…' : '(none)';
    const row = [
      pad(r.scenario, W[0]),
      `${decColor}${pad(r.decision, W[1])}${RESET}`,
      pad(shortHash, W[2]),
      pad(shortTmpl, W[3]),
      `${mColor}${pad(r.mandateStatus, W[4])}${RESET}`,
    ].join('  ');
    process.stdout.write(`  ${row}\n`);
  }
  process.stdout.write('\n');
}
