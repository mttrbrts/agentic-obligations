// Provide a minimal TemplateLogic global so logic.ts can `extends TemplateLogic<...>`.
// In production the template-engine runtime injects the real class; under vitest
// we just need *something* that allows the class to be defined at module-load time.
declare global {
  // eslint-disable-next-line no-var
  var TemplateLogic: any;
}
(globalThis as any).TemplateLogic = class TemplateLogic<TData, TState = undefined> {
  async trigger(_data: TData, _request: any, _state?: TState): Promise<any> {
    throw new Error('TemplateLogic base.trigger() should not be called');
  }
};
