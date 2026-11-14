import type { Lang } from "./i18n";
import type { CampaignPromise, PromiseStatus } from "../types";

export interface PromiseStatusMeta {
  label: string;
  shortLabel: string;
  icon: string;
  check: boolean;
  description: string;
  color: string;
  bg: string;
  border: string;
}

const PROMISE_STATUS_BY_LANG: Record<
  Lang,
  Record<PromiseStatus, PromiseStatusMeta>
> = {
  en: {
    fulfilled: {
      label: "Fulfilled",
      shortLabel: "Fulfilled",
      icon: "🏆",
      check: true,
      description: "A related bill became law.",
      color: "#1f7a45",
      bg: "#e8f6ee",
      border: "#1f7a4533",
    },
    underway: {
      label: "In progress",
      shortLabel: "In progress · evidence",
      icon: "◔",
      check: false,
      description:
        "A related bill was introduced or advanced. This is evidence of legislative work, not a final outcome.",
      color: "#9a6700",
      bg: "#fff6d8",
      border: "#9a670033",
    },
    pending: {
      label: "Pending",
      shortLabel: "Pending",
      icon: "•",
      check: false,
      description:
        "No clear evidence yet. The commitment may still be in process or awaiting action.",
      color: "#475467",
      bg: "#f2f4f7",
      border: "#47546733",
    },
    failed: {
      label: "Not fulfilled",
      shortLabel: "Not fulfilled",
      icon: "✕",
      check: false,
      description: "Verified evidence shows the commitment was not met.",
      color: "#b42318",
      bg: "#fdeceb",
      border: "#b4231833",
    },
  },
  es: {
    fulfilled: {
      label: "Cumplida",
      shortLabel: "Cumplida",
      icon: "🏆",
      check: true,
      description: "Un proyecto relacionado se convirtió en ley.",
      color: "#1f7a45",
      bg: "#e8f6ee",
      border: "#1f7a4533",
    },
    underway: {
      label: "En curso",
      shortLabel: "En curso · evidencia",
      icon: "◔",
      check: false,
      description:
        "Se presentó o avanzó un proyecto relacionado. Es evidencia de trabajo legislativo, no un resultado final.",
      color: "#9a6700",
      bg: "#fff6d8",
      border: "#9a670033",
    },
    pending: {
      label: "Pendiente",
      shortLabel: "Pendiente",
      icon: "•",
      check: false,
      description:
        "Sin evidencia clara aún. El compromiso puede seguir en proceso o a la espera de acción.",
      color: "#475467",
      bg: "#f2f4f7",
      border: "#47546733",
    },
    failed: {
      label: "No cumplida",
      shortLabel: "No cumplida",
      icon: "✕",
      check: false,
      description:
        "La evidencia verificada muestra que el compromiso no se cumplió.",
      color: "#b42318",
      bg: "#fdeceb",
      border: "#b4231833",
    },
  },
};

export const PROMISE_STATUS_META = PROMISE_STATUS_BY_LANG.en;

export function getPromiseStatusMeta(
  status: PromiseStatus,
  lang: Lang = "en",
): PromiseStatusMeta {
  return PROMISE_STATUS_BY_LANG[lang][status];
}

export const PROMISE_STATUS_ORDER: PromiseStatus[] = [
  "fulfilled",
  "underway",
  "pending",
  "failed",
];

export function hasEvidence(promise: CampaignPromise): boolean {
  return promise.evidence.length > 0;
}

export function promiseStatusLabel(
  promise: CampaignPromise,
  lang: Lang = "en",
): string {
  return PROMISE_STATUS_BY_LANG[lang][promise.status].label;
}

export function promiseEvidenceLabel(
  promise: CampaignPromise,
  lang: Lang = "en",
): string | null {
  if (!hasEvidence(promise)) return null;
  if (lang === "es") {
    if (promise.status === "fulfilled")
      return "Evidencia: proyecto convertido en ley";
    if (promise.status === "underway") return "Evidencia de trabajo";
    return "Evidencia disponible";
  }
  if (promise.status === "fulfilled")
    return "Evidence: related bill became law";
  if (promise.status === "underway") return "Evidence of work";
  return "Evidence available";
}

export function promiseStatusSummary(promises: CampaignPromise[]) {
  const counts: Record<PromiseStatus, number> = {
    fulfilled: 0,
    underway: 0,
    pending: 0,
    failed: 0,
  };
  for (const promise of promises) counts[promise.status] += 1;
  return counts;
}

export function formatPromiseCount(
  count: number,
  singular: string,
  plural?: string,
): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural ?? `${singular}s`}`;
}
