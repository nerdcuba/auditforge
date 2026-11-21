// Niveles de coste → modelo de Claude. El enrutado fino por subtarea se añade encima.
export const LEVELS = ["economico", "equilibrado", "maximo"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_MODEL: Record<Level, string> = {
  economico: "claude-haiku-5-5",
  equilibrado: "claude-sonnet-5-5",
  maximo: "claude-opus-5-5",
};

export const LEVEL_LABEL: Record<Level, string> = {
  economico: "Económico",
  equilibrado: "Equilibrado",
  maximo: "Máximo",
};

export const LEVEL_HINT: Record<Level, string> = {
  economico: "Rápido y barato, para revisiones frecuentes.",
  equilibrado: "El punto medio, para la mayoría de auditorías.",
  maximo: "Máxima profundidad, para lo complejo.",
};

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}
