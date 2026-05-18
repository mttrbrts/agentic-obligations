import { ModelManager, ClassDeclaration } from '@accordproject/concerto-core';
import { Template } from '@accordproject/cicero-core';

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */

// we duplicate these interfaces here to avoid imports into the runtime
interface IConcept {
    $class: string;
 }

interface ITransaction extends IConcept {
    $timestamp: Date;
 }

interface IEvent extends IConcept {
   $timestamp: Date;
}

interface IState {
    $identifier: string;
}

interface EngineResponse<S extends IState> {
    state?: S;
    events?: Array<IEvent>
}

interface IRequest extends ITransaction {
}

interface IResponse extends ITransaction {
}

interface IAsset extends IConcept {
   $identifier: string;
}

interface IContract extends IAsset {
   contractId: string;
}

interface IClause extends IAsset {
   clauseId: string;
}

interface TriggerResponse$1<S extends IState = IState> extends EngineResponse<S> {
    result: IResponse;
}

interface InitResponse$1<S extends IState> extends EngineResponse<S> {}

type TemplateData$1 = IContract|IClause;

declare abstract class TemplateLogic<T extends TemplateData$1, S extends IState = IState> {
    abstract trigger(data: T, request: IRequest, state:S) : Promise<TriggerResponse$1<S>>;
    init(data: T) : Promise<InitResponse$1<S>|undefined>;
}

type TemplateData = Record<string, unknown>;

/**
 * BEWARE - this type is duplicated in TypeScriptCompilationContext
 * for use by code generation
 */
type GenerationOptions = {
    now?: string;
    locale?: string;
    disableJavaScriptEvaluation?: boolean;
    childProcessJavaScriptEvaluation?: boolean;
    timeout?: number;
};

/**
 * A template engine: merges the markup and logic of a template with
 * JSON data to produce JSON data.
 */
declare class TemplateMarkInterpreter {
    modelManager: ModelManager;
    templateClass: ClassDeclaration;
    clauseLibrary: object;
    constructor(modelManager: ModelManager, clauseLibrary: object, templateConceptFqn?: string);
    /**
     * Checks that a TemplateMark JSON document is valid with respect to the
     * TemplateMark model, as well as the template model.
     *
     * Checks:
     * 1. Variable names are valid properties in the template model
     * 2. Optional properties have guards
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON that has been typed checked and has type metadata added
     * @throws {Error} if the templateMark document is invalid
     */
    checkTypes(templateMark: object): object;
    /**
     * Compiles the code nodes containing TS to code nodes containing JS.
     * @param {*} templateMark the TemplateMark JSON object
     * @returns {*} TemplateMark JSON with JS nodes
     * @throws {Error} if the templateMark document is invalid
     */
    compileTypeScriptToJavaScript(templateMark: object): Promise<object>;
    validateCiceroMark(ciceroMark: object): object;
    generate(templateMark: object, data: TemplateData, options?: GenerationOptions): Promise<any>;
}

/**
 * The result of a JIT compilation pass.
 * Mirrors the CompilerResult type introduced in PR #50.
 */
type CompilerResult = {
    /** The bundled ESM source code, present on success. */
    code?: string;
    /** Non-empty on failure. */
    errors: string[];
};

type State = object;
type Response = object;
type Event = object;
type TriggerResponse = {
    result: Response;
    state: State;
    events: Event[];
};
type InitResponse = {
    state: State;
};
/**
 * A template archive processor: can draft content using the
 * templatemark for the archive and trigger the logic of the archive.
 *
 * ## Logic execution modes (follows PR #50 design)
 *
 * The processor dispatches on the `runtime` field declared in the template's
 * `package.json` under `accordproject.runtime`:
 *
 * - `"typescript"` — the archive ships raw `.ts` source files.  The processor
 *   JIT-compiles them to JavaScript on every call via `TemplateLogicBundler`
 *   (webpack over an in-memory filesystem).  Type-checking is skipped for
 *   speed; compilation errors are surfaced as runtime exceptions.
 *
 * - `"es6"` — the archive ships a pre-built `logic/logic.js`.  The processor
 *   reads and evaluates it directly, with no recompilation overhead.  Use
 *   `transpileLogicToJavaScript(outputDirectory)` to produce this artifact
 *   from a TypeScript archive.
 */
declare class TemplateArchiveProcessor {
    template: Template;
    /**
     * Creates a template archive processor
     * @param {Template} template - the template to be used by the processor
     */
    constructor(template: Template);
    /**
     * Drafts a template by merging it with data
     * @param {any} data the data to merge with the template
     * @param {string} format the output format
     * @param {any} options merge options
     * @param {[string]} currentTime the current value for 'now'
     * @returns {Promise} the drafted content
     */
    draft(data: any, format: string, options: any, currentTime?: string): Promise<any>;
    /**
     * Trigger the logic of a template
     * @param {object} data - the contract/clause data
     * @param {object} request - the request to send to the template logic
     * @param {object} state - the current state of the template
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @returns {Promise} the response and any events
     */
    trigger(data: any, request: any, state?: any, currentTime?: string, utcOffset?: number): Promise<TriggerResponse>;
    /**
     * Init the logic of a template
     * @param {object} data - the contract/clause data
     * @param {[string]} currentTime - the current time, defaults to now
     * @param {[number]} utcOffset - the UTC offset, defaults to zero
     * @returns {Promise} the initial state
     */
    init(data: any, currentTime?: string, utcOffset?: number): Promise<InitResponse>;
    /**
     * Transpile the TypeScript template logic to a pre-built JavaScript bundle
     * (static / offline compilation — Mode 1 from PR #50).
     *
     * If `outputDirectory` is provided the bundle is written to
     * `<outputDirectory>/logic/logic.js` and the template's `package.json` is
     * updated to `runtime: "es6"` so that subsequent calls to `trigger()` /
     * `init()` skip recompilation entirely.
     *
     * @param outputDirectory  optional directory to write the compiled artifact
     * @returns the compiler result containing the bundled code and any errors
     */
    transpileLogicToJavaScript(outputDirectory?: string): Promise<CompilerResult>;
    /**
     * Resolve the ready-to-eval JavaScript source for the template logic,
     * dispatching on the archive's declared runtime mode.
     */
    private _getLogicCode;
}

declare function ensureDirSync(path: string): void;
declare function removeSync(path: string): void;
declare function writeFunctionToString(templateClass: ClassDeclaration, functionName: string, returnType: string, code: string): string;
declare function nameUserCode(templateMarkDom: any): any;
declare function getTemplateClassDeclaration(modelManager: ModelManager, templateConceptFqn?: string): ClassDeclaration;

export { TemplateArchiveProcessor, TemplateLogic, TemplateMarkInterpreter, ensureDirSync, getTemplateClassDeclaration, nameUserCode, removeSync, writeFunctionToString };
