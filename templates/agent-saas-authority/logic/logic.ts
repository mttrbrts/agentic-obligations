// TemplateLogic, IState, IRequest, IResponse, EngineResponse etc. are injected
// by the Accord Project template-engine runtime at bundle/trigger time
// (see @accordproject/template-engine/src/runtime/declarations.ts).
import {
  IAgentSaaSAuthorityContract,
  IProcurementRequest,
  IAuthorizationDecision,
  IProcurementObligation,
  IAgentAuthorityState,
  AuthorizationOutcome,
} from './generated/org.accordproject.demo.agentauthority@0.1.0.js';
import { IMonetaryAmount } from './generated/org.accordproject.money@0.3.0.js';

const NS = 'org.accordproject.demo.agentauthority@0.1.0';
const STATE_FQN = `${NS}.AgentAuthorityState`;
const DECISION_FQN = `${NS}.AuthorizationDecision`;
const OBLIGATION_FQN = `${NS}.ProcurementObligation`;
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

function sameCurrency(a: IMonetaryAmount, b: IMonetaryAmount): boolean {
  return a.currencyCode === b.currencyCode;
}

/**
 * Roll the spend year forward if the configured year has elapsed since
 * spendYearStartedAt. Returns the (possibly rolled) state.
 */
function maybeRollYear(state: IAgentAuthorityState, now: Date): IAgentAuthorityState {
  const startedAt = new Date(state.spendYearStartedAt);
  if (now.getTime() - startedAt.getTime() < MS_PER_YEAR) return state;
  return {
    ...state,
    currentYearSpend: {
      ...state.currentYearSpend,
      doubleValue: 0,
    },
    approvedRequestIds: [],
    spendYearStartedAt: now,
  };
}

// @ts-ignore TemplateLogic is injected by the template-engine runtime
export class AgentSaaSAuthorityLogic extends TemplateLogic<IAgentSaaSAuthorityContract> {
  /**
   * Seed the initial state for a new contract instance.
   * The contract starts with zero current-year spend and an empty approved list.
   */
  async init(
    data: IAgentSaaSAuthorityContract
  ): Promise<{ state: IAgentAuthorityState }> {
    const state: IAgentAuthorityState = {
      $class: STATE_FQN,
      $identifier: `state-${(data as { contractId?: string }).contractId ?? 'default'}`,
      currentYearSpend: {
        $class: data.maximumAnnualSpend.$class,
        doubleValue: 0,
        currencyCode: data.maximumAnnualSpend.currencyCode,
      },
      approvedRequestIds: [],
      spendYearStartedAt: new Date(data.effectiveDate),
    };
    return { state };
  }

  async trigger(
    data: IAgentSaaSAuthorityContract,
    request: IProcurementRequest,
    state: IAgentAuthorityState,
    options?: { now?: Date }
  ): Promise<{ result: IAuthorizationDecision; state: IAgentAuthorityState; events: any[] }> {
    const now = options?.now ?? new Date();
    const rolledState = maybeRollYear(state, now);
    const reasons: string[] = [];

    const monetary: IMonetaryAmount[] = [
      data.maximumAnnualSpend,
      data.maximumPerTransaction,
      data.requiresHumanApprovalAbove,
      rolledState.currentYearSpend,
    ];
    for (const m of monetary) {
      if (!sameCurrency(request.amount, m)) {
        return wrap(request.requestId, AuthorizationOutcome.DENIED, ['currency mismatch'], [], rolledState);
      }
    }

    if (request.amount.doubleValue > data.maximumPerTransaction.doubleValue) {
      reasons.push('exceeds per-transaction cap');
    }

    const projectedYTD = rolledState.currentYearSpend.doubleValue + request.amount.doubleValue;
    if (projectedYTD > data.maximumAnnualSpend.doubleValue) {
      reasons.push('would exceed annual cap');
    }

    const effective = new Date(data.effectiveDate);
    const expiry = new Date(data.expiryDate);
    if (now < effective || now > expiry) {
      reasons.push('outside contract effective window');
    }

    if (!data.permittedVendorCategories.includes(request.vendorCategory)) {
      reasons.push('vendor category not permitted');
    }

    if (
      data.permittedVendorAllowList.length > 0 &&
      !data.permittedVendorAllowList.includes(request.vendorId)
    ) {
      reasons.push('vendor not on allow list');
    }

    if (reasons.length > 0) {
      return wrap(request.requestId, AuthorizationOutcome.DENIED, reasons, [], rolledState);
    }

    const requiresHuman =
      request.amount.doubleValue > data.requiresHumanApprovalAbove.doubleValue;
    const decision = requiresHuman
      ? AuthorizationOutcome.REQUIRES_HUMAN_APPROVAL
      : AuthorizationOutcome.APPROVED;
    const decisionReasons = requiresHuman ? ['amount above human-approval threshold'] : [];

    const obligations: IProcurementObligation[] = [
      {
        $class: OBLIGATION_FQN,
        id: `${request.requestId}-confirm`,
        obligor: data.agent.agentId,
        description: `deliver subscription confirmation within ${data.noticeOfTerminationDays} days`,
        triggerCondition: 'on procurement approval',
        deadlineDays: data.noticeOfTerminationDays,
      },
      {
        $class: OBLIGATION_FQN,
        id: `${request.requestId}-audit`,
        obligor: request.vendorId,
        description: `maintain audit records for ${data.auditRightsRetentionDays} days per contract audit rights`,
        triggerCondition: 'on procurement approval',
        deadlineDays: data.auditRightsRetentionDays,
      },
    ];

    if (request.isRenewal) {
      const renewalDeadlineDays =
        request.subscriptionTermMonths * 30 - data.noticeOfTerminationDays;
      obligations.push({
        $class: OBLIGATION_FQN,
        id: `${request.requestId}-renewal`,
        obligor: data.agent.agentId,
        description: `provide renewal notice within term deadline (${renewalDeadlineDays} days from subscription start)`,
        triggerCondition: 'on renewal procurement approval',
        deadlineDays: renewalDeadlineDays,
      });
    }

    // Approved (or human-approval) commits the spend to the running total.
    const newState: IAgentAuthorityState = {
      ...rolledState,
      currentYearSpend: {
        ...rolledState.currentYearSpend,
        doubleValue: projectedYTD,
      },
      approvedRequestIds: [...rolledState.approvedRequestIds, request.requestId],
    };

    return wrap(request.requestId, decision, decisionReasons, obligations, newState);
  }
}

function wrap(
  requestId: string,
  decision: AuthorizationOutcome,
  reasons: string[],
  obligations: IProcurementObligation[],
  state: IAgentAuthorityState
): { result: IAuthorizationDecision; state: IAgentAuthorityState; events: any[] } {
  const result: IAuthorizationDecision = {
    $class: DECISION_FQN,
    $timestamp: new Date(),
    requestId,
    decision,
    reasons,
    obligations,
  };
  return { result, state, events: [] };
}

export default AgentSaaSAuthorityLogic;
