import type { CardComponent } from './types';
import { DocsRead, PhotoReport } from './docs';
import { ChecksReport, FieldsDiff, StatusTimeline, PermitReady, Checklist, InfoCard, FeeBreakdown } from './results';
import { ConfirmDetails, FixIssue, PhotoFix, PhotoReview, EnterCode, Declarations, SignOff, PayHandover, SponsorApproval } from './actions';
import { GenFrame, GeneratingCard } from './Frame';

/*
  The vocabulary the agent composes with. The agent never writes markup: it names a component and gives it data.
  Unknown names fall back to a plain card, so a bad output cannot break the page.
*/
export const REGISTRY: Record<string, CardComponent> = {
  DocsRead,
  PhotoReport,
  ChecksReport,
  FieldsDiff,
  StatusTimeline,
  PermitReady,
  Checklist,
  InfoCard,
  FeeBreakdown,
  ConfirmDetails,
  FixIssue,
  PhotoFix,
  PhotoReview,
  EnterCode,
  Declarations,
  SignOff,
  PayHandover,
  SponsorApproval,
};

export function Generated({
  id,
  component,
  props,
  ready,
  act,
  readonly,
  spec = true,
}: {
  id: string;
  component: string;
  props: Record<string, unknown>;
  ready: boolean;
  act: (outcome: unknown) => void;
  readonly: boolean;
  spec?: boolean;
}) {
  if (!ready) return <GeneratingCard component={component} />;
  const C = REGISTRY[component] ?? InfoCard;
  const p = REGISTRY[component] ? props : { title: 'Unknown component', bullets: [`The agent asked for "${component}", which is not in the registry.`] };
  return (
    <GenFrame component={component} props={props} spec={spec}>
      <C id={id} props={p as never} act={act} readonly={readonly} />
    </GenFrame>
  );
}
