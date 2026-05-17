/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concerto@1.0.0

// imports

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IParty,
	IAgentIdentity,
	IAgentSaaSAuthorityContract,
	IProcurementObligation,
	AuthorizationOutcome
} from './org.accordproject.demo.agentauthority@0.1.0.js';
import type {
	IDigitalMonetaryAmount,
	DigitalCurrencyCode,
	IMonetaryAmount,
	CurrencyCode,
	ICurrencyConversion
} from './org.accordproject.money@0.3.0.js';

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IContract,
	IClause
} from './org.accordproject.contract@0.2.0.js';
import type {
	IState
} from './org.accordproject.runtime@0.2.0.js';

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IRequest,
	IResponse
} from './org.accordproject.runtime@0.2.0.js';

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IObligation
} from './org.accordproject.runtime@0.2.0.js';

// interfaces
export interface IConcept {
   $class: string;
}

export type ConceptUnion = IParty | 
IAgentIdentity | 
IAgentSaaSAuthorityContract | 
IProcurementObligation | 
IDigitalMonetaryAmount | 
IMonetaryAmount | 
ICurrencyConversion;

export interface IAsset extends IConcept {
   $identifier: string;
}

export type AssetUnion = IContract | 
IClause | 
IState;

export interface IParticipant extends IConcept {
   $identifier: string;
}

export interface ITransaction extends IConcept {
   $timestamp: Date;
}

export type TransactionUnion = IRequest | 
IResponse;

export interface IEvent extends IConcept {
   $timestamp: Date;
}

export type EventUnion = IObligation;

