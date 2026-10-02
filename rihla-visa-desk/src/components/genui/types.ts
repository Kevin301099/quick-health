import type { ComponentType } from 'react';

/** What a generated card may do to the world. In a read-only stage every call is a no-op. */
export interface GenUICtx {
  caseId: string;
  readonly: boolean;
  resolve: (interruptId: string, outcome: unknown, by?: 'human' | 'client') => void;
  audit: (action: string, detail?: string) => void;
  editField: (traveller: string, label: string, from: string, to: string) => void;
  setServiceFee: (n: number) => void;
}

export interface Resolved {
  by: 'human' | 'agent' | 'client';
  outcome: unknown;
  reason?: string;
  at: number;
}

export interface CardProps<P = Record<string, unknown>> {
  id: string;
  props: P & { interruptId?: string; autoReason?: string; resolved?: Resolved };
  ctx: GenUICtx;
}

export type CardComponent = ComponentType<CardProps<any>>;

export const NOOP_CTX: GenUICtx = {
  caseId: 'stage',
  readonly: true,
  resolve: () => undefined,
  audit: () => undefined,
  editField: () => undefined,
  setServiceFee: () => undefined,
};
