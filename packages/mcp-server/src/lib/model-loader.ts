/**
 * Offline model loader for Accord Project Concerto models.
 * Mirrors the approach in templates/agent-saas-authority/verify.mjs:
 * loads external model stubs inline rather than hitting the network.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

// Use createRequire so we resolve through Node's normal module resolution
// (which walks up parent node_modules, supporting both pnpm-local and
// npm-hoisted layouts) rather than hard-coding a relative path.
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConcertoCoreModule = any;
let _concertoCore: ConcertoCoreModule | null = null;

async function getConcertoCore(): Promise<ConcertoCoreModule> {
  if (_concertoCore) return _concertoCore;
  // concerto-core is CJS; require() gives us the exports object directly.
  _concertoCore = require('@accordproject/concerto-core');
  return _concertoCore;
}

function resolveCiceroCoreNm(): string | null {
  try {
    const pkgJsonPath = require.resolve('@accordproject/cicero-core/package.json');
    return dirname(pkgJsonPath);
  } catch {
    return null;
  }
}

// Inline fallback stubs (same as verify.mjs)
const MONEY_MODEL = `
concerto version "^3.0.0"
namespace org.accordproject.money@0.3.0
concept MonetaryAmount {
  o Double doubleValue
  o String currencyCode
}
`;

const CONTRACT_MODEL = `
concerto version "^3.0.0"
namespace org.accordproject.contract@0.2.0
abstract asset Contract identified by contractId {
  o String contractId
}
abstract asset Clause identified by clauseId {
  o String clauseId
}
`;

const RUNTIME_MODEL = `
concerto version "^3.0.0"
namespace org.accordproject.runtime@0.2.0
import org.accordproject.contract@0.2.0.Contract from https://models.accordproject.org/accordproject/contract@0.2.0.cto
transaction Request {
}
transaction Response {
}
`;

async function tryReadExternal(ciceroCoreNm: string | null, filename: string): Promise<string | null> {
  if (!ciceroCoreNm) return null;
  try {
    return await readFile(join(ciceroCoreNm, 'src', 'external', filename), 'utf-8');
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface LoadedModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelManager: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serializer: any;
}

/**
 * Loads the CTO model from `templatePath/model/model.cto` into a ModelManager,
 * with inline external model stubs so no network is required.
 */
export async function loadModelFromTemplate(templatePath: string): Promise<LoadedModel> {
  const { ModelManager, Factory, Serializer } = await getConcertoCore();

  const ciceroCoreNm = resolveCiceroCoreNm();
  const modelText = await readFile(join(templatePath, 'model', 'model.cto'), 'utf-8');

  const moneyText =
    (await tryReadExternal(ciceroCoreNm, '@models.accordproject.org.money@0.3.0.cto')) ??
    MONEY_MODEL;
  const contractText =
    (await tryReadExternal(ciceroCoreNm, '@models.accordproject.org.accordproject.contract@0.2.0.cto')) ??
    CONTRACT_MODEL;
  const runtimeText =
    (await tryReadExternal(ciceroCoreNm, '@models.accordproject.org.accordproject.runtime@0.2.0.cto')) ??
    RUNTIME_MODEL;

  const modelManager = new ModelManager({ strict: true });
  modelManager.addCTOModel(contractText, 'contract@0.2.0.cto');
  modelManager.addCTOModel(runtimeText, 'runtime@0.2.0.cto');
  modelManager.addCTOModel(moneyText, 'money@0.3.0.cto');
  modelManager.addCTOModel(modelText, 'model.cto');

  const factory = new Factory(modelManager);
  const serializer = new Serializer(factory, modelManager);

  return { modelManager, factory, serializer };
}
