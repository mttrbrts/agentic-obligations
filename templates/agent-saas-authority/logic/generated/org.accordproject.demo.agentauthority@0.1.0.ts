/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: org.accordproject.demo.agentauthority@0.1.0

// imports
import {IMonetaryAmount} from './org.accordproject.money@0.3.0.js';
import {IRequest,IState,IResponse} from './org.accordproject.runtime@0.2.0.js';
import {IConcept} from './concerto@1.0.0.js';

// interfaces
export interface IParty extends IConcept {
   name: string;
   jurisdiction: string;
}

export interface IAgentIdentity extends IConcept {
   agentId: string;
   framework: string;
   publicKeyFingerprint: string;
}

export interface IAgentSaaSAuthorityContract extends IConcept {
   principal: IParty;
   agent: IAgentIdentity;
   effectiveDate: Date;
   expiryDate: Date;
   maximumAnnualSpend: IMonetaryAmount;
   maximumPerTransaction: IMonetaryAmount;
   permittedVendorCategories: string[];
   permittedVendorAllowList: string[];
   requiresHumanApprovalAbove: IMonetaryAmount;
   governingLaw: string;
   noticeOfTerminationDays: number;
   auditRightsRetentionDays: number;
}

export interface IProcurementRequest extends IRequest {
   requestId: string;
   vendorId: string;
   vendorCategory: string;
   productName: string;
   subscriptionTermMonths: number;
   amount: IMonetaryAmount;
   isRenewal: boolean;
}

export interface IAgentAuthorityState extends IState {
   currentYearSpend: IMonetaryAmount;
   approvedRequestIds: string[];
   spendYearStartedAt: Date;
}

export interface IProcurementObligation extends IConcept {
   id: string;
   obligor: string;
   description: string;
   triggerCondition: string;
   deadlineDays?: number;
}

export enum AuthorizationOutcome {
   APPROVED = 'APPROVED',
   DENIED = 'DENIED',
   REQUIRES_HUMAN_APPROVAL = 'REQUIRES_HUMAN_APPROVAL',
}

export interface IAuthorizationDecision extends IResponse {
   requestId: string;
   decision: AuthorizationOutcome;
   reasons: string[];
   obligations: IProcurementObligation[];
}

