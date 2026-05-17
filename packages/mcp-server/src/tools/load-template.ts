import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadModelFromTemplate } from '../lib/model-loader.js';

interface TemplateMetadata {
  name: string;
  version: string;
  modelNamespace: string;
  concepts: string[];
  hasGrammar: boolean;
  requestType: string | null;
  responseType: string | null;
}

/**
 * Wave 2: loads template metadata using @accordproject/concerto-core ModelManager
 * for real concept introspection. Falls back to regex-based extraction for name/version.
 */
export function registerLoadTemplate(server: McpServer): void {
  server.tool(
    'load_template',
    'Loads a Cicero template directory and returns its metadata: name, version, model namespace, qualified concept names, grammar presence, and request/response types.',
    {
      templatePath: z
        .string()
        .describe('Absolute path to a Cicero template directory'),
    },
    async ({ templatePath }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      process.stderr.write(`[getTemplate] loading template from ${templatePath}\n`);

      // Read package.json for name and version
      let name = 'unknown';
      let version = '0.0.0';
      try {
        const pkgRaw = await readFile(join(templatePath, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
        if (typeof pkg['name'] === 'string') name = pkg['name'];
        if (typeof pkg['version'] === 'string') version = pkg['version'];
      } catch {
        process.stderr.write(`[getTemplate] warning: could not read package.json\n`);
      }

      // Load model via ModelManager for real introspection
      let modelNamespace = '';
      const concepts: string[] = [];
      let requestType: string | null = null;
      let responseType: string | null = null;

      try {
        const { modelManager } = await loadModelFromTemplate(templatePath);

        // Find the primary namespace from model.cto (last added model file)
        // Use Introspector for concept discovery
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelFiles = modelManager.getModelFiles() as any[];

        // The last model file is the template's own model
        for (const mf of modelFiles) {
          const ns: string = mf.getNamespace();
          // Skip the built-in concerto system namespace and external stubs
          if (
            ns.startsWith('concerto') ||
            ns.startsWith('org.accordproject.money') ||
            ns.startsWith('org.accordproject.contract') ||
            ns.startsWith('org.accordproject.runtime')
          ) {
            continue;
          }
          modelNamespace = ns;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const declarations = mf.getAllDeclarations() as any[];
          for (const decl of declarations) {
            const qualifiedName: string = decl.getFullyQualifiedName();
            concepts.push(qualifiedName);

            // Detect request/response by supertype
            try {
              const superType: string | null =
                typeof decl.getSuperType === 'function' ? decl.getSuperType() : null;
              if (superType === 'org.accordproject.runtime@0.2.0.Request') {
                requestType = qualifiedName;
              } else if (superType === 'org.accordproject.runtime@0.2.0.Response') {
                responseType = qualifiedName;
              }
            } catch {
              // getSuperType may throw if no super — ignore
            }
          }
        }
      } catch (err: unknown) {
        process.stderr.write(
          `[getTemplate] warning: ModelManager introspection failed: ${err instanceof Error ? err.message : String(err)}\n`
        );
        // Fall back to simple regex extraction
        try {
          const modelDir = join(templatePath, 'model');
          const files = await readdir(modelDir);
          for (const ctoFile of files.filter((f) => f.endsWith('.cto'))) {
            const ctoContent = await readFile(join(modelDir, ctoFile), 'utf8');
            const nsMatch = ctoContent.match(/^namespace\s+([^\s{]+)/m);
            if (nsMatch && !modelNamespace) modelNamespace = nsMatch[1];
            const conceptMatches = ctoContent.matchAll(
              /^(?:concept|asset|participant|transaction|event)\s+(\w+)/gm
            );
            for (const m of conceptMatches) concepts.push(m[1]);
          }
        } catch {
          process.stderr.write(`[getTemplate] warning: could not read model directory\n`);
        }
      }

      // Check for grammar file
      let hasGrammar = false;
      try {
        const textFiles = await readdir(join(templatePath, 'text'));
        hasGrammar = textFiles.some(
          (f) => f === 'grammar.tem.md' || f === 'template.tem.md'
        );
      } catch {
        // text/ dir might not exist
      }

      const metadata: TemplateMetadata = {
        name,
        version,
        modelNamespace,
        concepts,
        hasGrammar,
        requestType,
        responseType,
      };

      process.stderr.write(
        `[getTemplate] loaded ${concepts.length} concepts, requestType=${requestType ?? 'none'}, responseType=${responseType ?? 'none'}\n`
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(metadata, null, 2) }],
      };
    }
  );
}
