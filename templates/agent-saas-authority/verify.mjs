/**
 * verify.mjs — standalone verification script for agent-saas-authority template.
 *
 * Proves:
 *   1. model/model.cto loads into ModelManager without errors
 *   2. text/grammar.tem.md parses against the model (TemplateMark DOM)
 *   3. data.json drafts through the template to produce a markdown document
 *   4. The output is written to text/sample.md
 *   5. request.json validates against the Concerto model (schema check)
 *
 * Run: node verify.mjs   (from the template directory)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NM = join(__dirname, 'node_modules');

// ─── helpers ─────────────────────────────────────────────────────────────────

function pass(msg) { console.log(`  ✓  ${msg}`); }
function fail(msg, err) { console.error(`  ✗  ${msg}`); console.error(err?.message ?? err); process.exit(1); }

// ─── resolve AP packages from local node_modules ──────────────────────────────

const { ModelManager, Factory, Serializer } = await import(`${NM}/@accordproject/concerto-core/index.js`);
const { TemplateMarkInterpreter } = await import(`${NM}/@accordproject/template-engine/dist/index.js`);
const { TemplateMarkTransformer } = await import(`${NM}/@accordproject/markdown-template/index.js`);
const { transform } = await import(`${NM}/@accordproject/markdown-transform/index.js`);

// ─── Embedded external model stubs ───────────────────────────────────────────
// cicero-core ships cached copies of external AP models; we load them
// from the installed package.

const CICERO_EXTERNAL = join(NM, '@accordproject/cicero-core/src/external');

const readExternal = async (filename) => {
    try {
        return await readFile(join(CICERO_EXTERNAL, filename), 'utf-8');
    } catch {
        // cicero-core may bundle differently — return null and we'll inline
        return null;
    }
};

// Inline fallback model text when cicero-core doesn't expose src/external
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

// ─── 1. Load model ────────────────────────────────────────────────────────────

console.log('\n[1] Loading Concerto model …');

let modelManager;

try {
    const modelText = await readFile(join(__dirname, 'model/model.cto'), 'utf-8');

    const moneyText = (await readExternal('@models.accordproject.org.money@0.3.0.cto')) ?? MONEY_MODEL;
    const contractText = (await readExternal('@models.accordproject.org.accordproject.contract@0.2.0.cto')) ?? CONTRACT_MODEL;
    const runtimeText = (await readExternal('@models.accordproject.org.accordproject.runtime@0.2.0.cto')) ?? RUNTIME_MODEL;

    modelManager = new ModelManager({ strict: true });
    modelManager.addCTOModel(contractText, 'contract@0.2.0.cto');
    modelManager.addCTOModel(runtimeText, 'runtime@0.2.0.cto');
    modelManager.addCTOModel(moneyText, 'money@0.3.0.cto');
    modelManager.addCTOModel(modelText, 'model.cto');

    pass('model/model.cto loaded into ModelManager');
} catch (err) {
    fail('Failed to load model', err);
}

// ─── 2. Parse grammar ────────────────────────────────────────────────────────

console.log('\n[2] Parsing text/grammar.tem.md …');

let templateMarkDom;

try {
    const grammarText = await readFile(join(__dirname, 'text/grammar.tem.md'), 'utf-8');
    const transformer = new TemplateMarkTransformer();
    templateMarkDom = transformer.fromMarkdownTemplate(
        { content: grammarText },
        modelManager,
        'contract',
        { verbose: false }
    );
    pass('grammar.tem.md parsed to TemplateMark DOM successfully');
} catch (err) {
    fail('Failed to parse grammar.tem.md', err);
}

// ─── 3. Draft data.json through the template ─────────────────────────────────

console.log('\n[3] Drafting data.json → markdown …');

let draftedMarkdown;

try {
    const dataRaw = await readFile(join(__dirname, 'data.json'), 'utf-8');
    const data = JSON.parse(dataRaw);

    const engine = new TemplateMarkInterpreter(modelManager, {});
    const now = new Date().toISOString();
    const ciceroMark = await engine.generate(templateMarkDom, data, { now });
    draftedMarkdown = await transform(ciceroMark.toJSON(), 'ciceromark', ['ciceromark_unquoted', 'markdown'], null, {});

    pass(`Drafted ${draftedMarkdown.length} characters of markdown`);
} catch (err) {
    fail('Failed to draft template', err);
}

// ─── 4. Write text/sample.md ─────────────────────────────────────────────────

console.log('\n[4] Writing text/sample.md …');

try {
    await writeFile(join(__dirname, 'text/sample.md'), draftedMarkdown, 'utf-8');
    pass('text/sample.md written');
} catch (err) {
    fail('Failed to write sample.md', err);
}

// ─── 5. Validate request.json against model ───────────────────────────────────

console.log('\n[5] Validating request.json against Concerto model …');

try {
    const requestRaw = await readFile(join(__dirname, 'request.json'), 'utf-8');
    const requestData = JSON.parse(requestRaw);

    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);
    serializer.fromJSON(requestData);
    pass('request.json is a valid ProcurementRequest instance');
} catch (err) {
    fail('request.json failed validation', err);
}

// ─── Done ────────────────────────────────────────────────────────────────────

console.log('\n  All checks passed. Template is ready.\n');
