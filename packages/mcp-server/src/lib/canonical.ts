/**
 * Pure helper: stable JSON stringify with sorted keys at every level.
 */
export function canonicalJSONStringify(value: unknown): string {
  return JSON.stringify(value, sortedReplacer);
}

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
