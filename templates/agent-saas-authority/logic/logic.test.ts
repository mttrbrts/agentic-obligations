import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `TemplateLogic` is provided as a global by ./test-setup.ts (loaded by
// vitest.config.ts setupFiles). The real class is injected at runtime by
// @accordproject/template-engine.
import AgentSaaSAuthorityLogic from './logic.js';
import {
  IAgentSaaSAuthorityContract,
  IAgentAuthorityState,
  IProcurementRequest,
  AuthorizationOutcome,
} from './generated/org.accordproject.demo.agentauthority@0.1.0.js';
import { CurrencyCode } from './generated/org.accordproject.money@0.3.0.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const data = JSON.parse(
  readFileSync(join(__dirname, '..', 'data.json'), 'utf8')
) as IAgentSaaSAuthorityContract;

const MONEY_CLASS = 'org.accordproject.money@0.3.0.MonetaryAmount';
const NOW = new Date('2026-05-17T12:00:00Z');

function makeRequest(overrides: Partial<IProcurementRequest> = {}): IProcurementRequest {
  return {
    $class: 'org.accordproject.demo.agentauthority@0.1.0.ProcurementRequest',
    $timestamp: new Date(),
    requestId: 'r-1',
    vendorId: 'workspace.google.com',
    vendorCategory: 'saas-devtools',
    productName: 'GitHub Enterprise',
    subscriptionTermMonths: 12,
    amount: { $class: MONEY_CLASS, doubleValue: 1800, currencyCode: CurrencyCode.USD },
    isRenewal: true,
    ...overrides,
  };
}

async function freshState(): Promise<IAgentAuthorityState> {
  const logic = new AgentSaaSAuthorityLogic();
  const init = await logic.init(data);
  return init.state;
}

async function trigger(
  state: IAgentAuthorityState,
  req: IProcurementRequest,
  now: Date = NOW
) {
  const logic = new AgentSaaSAuthorityLogic();
  return logic.trigger(data, req, state, { now });
}

describe('AgentSaaSAuthorityLogic — init', () => {
  it('seeds zero spend and an empty approved list', async () => {
    const s = await freshState();
    expect(s.currentYearSpend.doubleValue).toBe(0);
    expect(s.currentYearSpend.currencyCode).toBe(data.maximumAnnualSpend.currencyCode);
    expect(s.approvedRequestIds).toEqual([]);
    expect(new Date(s.spendYearStartedAt).toISOString()).toBe(new Date(data.effectiveDate).toISOString());
  });
});

describe('AgentSaaSAuthorityLogic — single triggers', () => {
  it('APPROVED on the happy path with 3 obligations (renewal), state advances', async () => {
    const s = await freshState();
    const r = await trigger(s, makeRequest());
    expect(r.result.decision).toBe(AuthorizationOutcome.APPROVED);
    expect(r.result.obligations).toHaveLength(3);
    expect(r.state.currentYearSpend.doubleValue).toBe(1800);
    expect(r.state.approvedRequestIds).toEqual(['r-1']);
  });

  it('REQUIRES_HUMAN_APPROVAL above threshold but under per-tx cap; state still advances', async () => {
    const s = await freshState();
    const r = await trigger(
      s,
      makeRequest({
        amount: { $class: MONEY_CLASS, doubleValue: 3500, currencyCode: CurrencyCode.USD },
        isRenewal: false,
        vendorId: 'figma.com',
        vendorCategory: 'saas-productivity',
      })
    );
    expect(r.result.decision).toBe(AuthorizationOutcome.REQUIRES_HUMAN_APPROVAL);
    expect(r.result.reasons).toContain('amount above human-approval threshold');
    expect(r.state.currentYearSpend.doubleValue).toBe(3500);
    expect(r.state.approvedRequestIds).toEqual(['r-1']);
  });

  it('DENIED: exceeds per-transaction cap; state unchanged', async () => {
    const s = await freshState();
    const r = await trigger(
      s,
      makeRequest({ amount: { $class: MONEY_CLASS, doubleValue: 9000, currencyCode: CurrencyCode.USD } })
    );
    expect(r.result.decision).toBe(AuthorizationOutcome.DENIED);
    expect(r.result.reasons).toContain('exceeds per-transaction cap');
    expect(r.state.currentYearSpend.doubleValue).toBe(0);
  });

  it('DENIED: outside effective window (before); state unchanged', async () => {
    const s = await freshState();
    const r = await trigger(s, makeRequest(), new Date('2020-01-01T00:00:00Z'));
    expect(r.result.decision).toBe(AuthorizationOutcome.DENIED);
    expect(r.result.reasons).toContain('outside contract effective window');
  });

  it('DENIED: vendor category not permitted', async () => {
    const s = await freshState();
    const r = await trigger(s, makeRequest({ vendorCategory: 'snacks' }));
    expect(r.result.decision).toBe(AuthorizationOutcome.DENIED);
    expect(r.result.reasons).toContain('vendor category not permitted');
  });

  it('DENIED: vendor not on allow list', async () => {
    const s = await freshState();
    const r = await trigger(s, makeRequest({ vendorId: 'random-vendor.example' }));
    expect(r.result.decision).toBe(AuthorizationOutcome.DENIED);
    expect(r.result.reasons).toContain('vendor not on allow list');
  });

  it('DENIED: currency mismatch', async () => {
    const s = await freshState();
    const r = await trigger(
      s,
      makeRequest({ amount: { $class: MONEY_CLASS, doubleValue: 1000, currencyCode: CurrencyCode.EUR } })
    );
    expect(r.result.decision).toBe(AuthorizationOutcome.DENIED);
    expect(r.result.reasons).toEqual(['currency mismatch']);
  });
});

describe('AgentSaaSAuthorityLogic — stateful sequences', () => {
  it('accumulates approved spend across multiple triggers', async () => {
    let s = await freshState();
    const r1 = await trigger(s, makeRequest({ requestId: 'r-a', amount: { $class: MONEY_CLASS, doubleValue: 1000, currencyCode: CurrencyCode.USD }, isRenewal: false }));
    expect(r1.result.decision).toBe(AuthorizationOutcome.APPROVED);
    s = r1.state;
    const r2 = await trigger(s, makeRequest({ requestId: 'r-b', amount: { $class: MONEY_CLASS, doubleValue: 2000, currencyCode: CurrencyCode.USD }, isRenewal: false }));
    expect(r2.result.decision).toBe(AuthorizationOutcome.APPROVED);
    s = r2.state;
    expect(s.currentYearSpend.doubleValue).toBe(3000);
    expect(s.approvedRequestIds).toEqual(['r-a', 'r-b']);
  });

  it('DENIED when the running YTD would cross the annual cap, even though each individual request would otherwise be fine', async () => {
    // data.maximumAnnualSpend = 8000, requiresHumanApprovalAbove = 2500.
    // Approve 3 × $2000 = $6000 (each under threshold ⇒ APPROVED). Then a
    // further $2500 request — perfectly fine in isolation — must be denied
    // by the running total alone (6000+2500=8500 > 8000).
    let s = await freshState();
    for (let i = 0; i < 3; i++) {
      const r = await trigger(
        s,
        makeRequest({
          requestId: `r-bulk-${i}`,
          amount: { $class: MONEY_CLASS, doubleValue: 2000, currencyCode: CurrencyCode.USD },
          isRenewal: false,
        })
      );
      expect(r.result.decision).toBe(AuthorizationOutcome.APPROVED);
      s = r.state;
    }
    expect(s.currentYearSpend.doubleValue).toBe(6000);

    const overflow = await trigger(
      s,
      makeRequest({
        requestId: 'r-overflow',
        amount: { $class: MONEY_CLASS, doubleValue: 2500, currencyCode: CurrencyCode.USD },
        isRenewal: false,
      })
    );
    expect(overflow.result.decision).toBe(AuthorizationOutcome.DENIED);
    expect(overflow.result.reasons).toContain('would exceed annual cap');
    expect(overflow.state.currentYearSpend.doubleValue).toBe(6000);
    expect(overflow.state.approvedRequestIds).not.toContain('r-overflow');
  });

  it('rolls the spend year over and resets currentYearSpend after 1 year', async () => {
    let s = await freshState();
    const r1 = await trigger(s, makeRequest({ requestId: 'pre', amount: { $class: MONEY_CLASS, doubleValue: 3000, currencyCode: CurrencyCode.USD }, isRenewal: false }), new Date('2026-06-01T00:00:00Z'));
    expect(r1.state.currentYearSpend.doubleValue).toBe(3000);

    // Trigger ~14 months later — year should roll
    const r2 = await trigger(r1.state, makeRequest({ requestId: 'post', amount: { $class: MONEY_CLASS, doubleValue: 1000, currencyCode: CurrencyCode.USD }, isRenewal: false }), new Date('2027-09-01T00:00:00Z'));
    expect(r2.result.decision).toBe(AuthorizationOutcome.APPROVED);
    expect(r2.state.currentYearSpend.doubleValue).toBe(1000); // reset, then add this request
    expect(r2.state.approvedRequestIds).toEqual(['post']);
  });
});
