import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEV_ORDER = ["critical", "high", "medium", "low", "info"];
const SEV_LABEL: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Info" };

type Scan = { id: string; mode: string; status: string; summary: string | null; ai_summary: string | null; created_at: string; assets: { value: string; label: string } | null };
type Finding = { title: string; severity: string; category: string | null; cwe: string | null; location: string | null; description: string | null; remediation: string | null };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new Response("not found", { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: scan } = await supabase
    .from("scans")
    .select("id, mode, status, summary, ai_summary, created_at, assets(value, label)")
    .eq("id", id)
    .maybeSingle<Scan>();
  if (!scan) return new Response("not found", { status: 404 });

  const { data: occ } = await supabase
    .from("finding_occurrences")
    .select("finding:findings(*)")
    .eq("scan_id", id)
    .returns<{ finding: Finding }[]>();
  const findings = (occ ?? []).map((r) => r.finding).filter(Boolean)
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  const date = new Date(scan.created_at).toISOString().slice(0, 16).replace("T", " ");
  const lines: string[] = [
    `# Informe de auditoría — ${scan.assets?.value ?? ""}`,
    "",
    `- **Activo:** ${scan.assets?.label ?? ""} (${scan.assets?.value ?? ""})`,
    `- **Modo:** ${scan.mode}`,
    `- **Fecha (UTC):** ${date}`,
    `- **Hallazgos:** ${findings.length}`,
    "",
  ];
  if (scan.ai_summary) lines.push("## Análisis con IA", "", scan.ai_summary, "");
  else if (scan.summary) lines.push(`_${scan.summary}_`, "");

  if (findings.length === 0) {
    lines.push("## Hallazgos", "", "Sin hallazgos en las comprobaciones pasivas.", "");
  } else {
    lines.push("## Hallazgos", "");
    for (const f of findings) {
      lines.push(`### [${SEV_LABEL[f.severity] ?? f.severity}] ${f.title}`);
      if (f.cwe || f.category) lines.push(`${[f.cwe, f.category].filter(Boolean).join(" · ")}`);
      if (f.location) lines.push(`\`${f.location}\``);
      lines.push("");
      if (f.description) lines.push(f.description, "");
      if (f.remediation) lines.push(`**Cómo arreglarlo:** ${f.remediation}`, "");
    }
  }
  lines.push("---", "", "Generado por AuditForge. Úsalo solo sobre activos propios o autorizados.");

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="auditforge-${scan.id.slice(0, 8)}.md"`,
    },
  });
}
