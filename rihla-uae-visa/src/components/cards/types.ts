import type { ComponentType } from 'react';

export interface Resolved {
  by: 'you' | 'portal' | 'agent';
  outcome: unknown;
  at: number;
}

export interface CardProps<P = Record<string, unknown>> {
  id: string;
  props: P & { actionId?: string; resolved?: Resolved };
  /** Resolve the pending action this card belongs to. No-op for read-only cards. */
  act: (outcome: unknown) => void;
  readonly: boolean;
}

export type CardComponent = ComponentType<CardProps<any>>;
