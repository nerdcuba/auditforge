export const FINDING_STATUSES = ["open", "triaged", "fixed", "accepted", "false_positive"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Abierto",
  triaged: "En revisión",
  fixed: "Corregido",
  accepted: "Aceptado",
  false_positive: "Falso positivo",
};
