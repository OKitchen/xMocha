import type { Theme } from "../domain/types";

export type EvaluationScenario = {
  id: string;
  dilemma: string;
  theme: Theme;
  maxTurns: number;
};

export const evaluationScenarios: EvaluationScenario[] = [
  {
    id: "startup-offer",
    dilemma: "Should I leave my stable role for a startup opportunity with more upside but less certainty?",
    theme: "sci-fi",
    maxTurns: 3,
  },
  {
    id: "internal-promotion",
    dilemma: "Should I stay for an internal promotion path or move externally for faster growth?",
    theme: "adventure",
    maxTurns: 3,
  },
  {
    id: "relocation",
    dilemma: "Should I relocate to another city for a new role or keep building leverage where I am now?",
    theme: "dream",
    maxTurns: 3,
  },
];
