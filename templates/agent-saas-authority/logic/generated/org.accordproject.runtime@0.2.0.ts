/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: org.accordproject.runtime@0.2.0

// imports

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IProcurementRequest
} from './org.accordproject.demo.agentauthority@0.1.0.js';

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IAuthorizationDecision
} from './org.accordproject.demo.agentauthority@0.1.0.js';

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IAgentAuthorityState
} from './org.accordproject.demo.agentauthority@0.1.0.js';
import {IContract} from './org.accordproject.contract@0.2.0.js';
import {ITransaction,IEvent,IParticipant,IAsset} from './concerto@1.0.0.js';

// interfaces
export interface IRequest extends ITransaction {
}

export type RequestUnion = IProcurementRequest;

export interface IResponse extends ITransaction {
}

export type ResponseUnion = IAuthorizationDecision;

export interface IObligation extends IEvent {
   $identifier: string;
   contract: IContract;
   promisor?: IParticipant;
   promisee?: IParticipant;
   deadline?: Date;
}

export interface IState extends IAsset {
}

export type StateUnion = IAgentAuthorityState;

