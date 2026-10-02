import type { CardComponent, GenUICtx } from './types';
import { GenFrame, GeneratingCard } from './Frame';
import { IntakeSummary, RequirementsCard, AdvisoryBanner } from './cards/intake';
import { DocumentTray, ExtractionPanel } from './cards/documents';
import { ChecksReport, ConflictResolver, Checkpoint } from './cards/checks';
import { FormDraft } from './cards/form';
import { FeeQuote, ApprovalGate } from './cards/money';
import { ApplicantHandoff, SubmissionReceipt, StatusTimeline, LaunchWatch, MessageDraft, CaseSummary } from './cards/delivery';
import { InfoCard, Checklist, ComparisonTable } from './cards/generic';

/*
  The component registry is the vocabulary the agent composes with.
  The agent never emits markup. It emits { component, props }, and this table decides what that means.
  Unknown names fall back to a plain card, so a bad model output cannot break the page.
*/
export const REGISTRY: Record<string, CardComponent> = {
  IntakeSummary,
  RequirementsCard,
  AdvisoryBanner,
  DocumentTray,
  ExtractionPanel,
  ChecksReport,
  ConflictResolver,
  Checkpoint,
  FormDraft,
  FeeQuote,
  ApprovalGate,
  ApplicantHandoff,
  SubmissionReceipt,
  StatusTimeline,
  LaunchWatch,
  MessageDraft,
  CaseSummary,
  InfoCard,
  Checklist,
  ComparisonTable,
};

export function Generated({ id, component, props, ready, ctx }: { id: string; component: string; props: Record<string, unknown>; ready: boolean; ctx: GenUICtx }) {
  if (!ready) return <GeneratingCard component={component} />;
  const C = REGISTRY[component];
  if (!C) {
    return (
      <GenFrame component={component} props={props}>
        <InfoCard id={id} ctx={ctx} props={{ title: 'Unknown component', tone: 'warn', bullets: [`The agent asked for "${component}", which is not in the registry.`] }} />
      </GenFrame>
    );
  }
  return (
    <GenFrame component={component} props={props}>
      <C id={id} props={props as never} ctx={ctx} />
    </GenFrame>
  );
}
