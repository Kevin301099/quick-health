import type { Level, Risk } from './types';

/*
  Autonomy policy. One function decides whether the agent may settle something itself.
    L1 Guided      the agent asks before every consequential step
    L2 Supervised  the agent settles low-risk items, asks for medium and high
    L3 Autopilot   the agent settles low and medium items, still asks for high
  Applicant-only steps are never settled by the agent at any level.
*/
export function allowAuto(level: Level, risk: Risk): boolean {
  if (risk === 'high') return false;
  if (level === 1) return false;
  if (level === 2) return risk === 'low';
  return true;
}

export const LEVELS: { level: Level; name: string; line: string }[] = [
  { level: 1, name: 'Guided', line: 'Asks before each step' },
  { level: 2, name: 'Supervised', line: 'Settles low-risk items, asks for the rest' },
  { level: 3, name: 'Autopilot', line: 'Runs end to end, stops for high-risk and applicant-only steps' },
];
