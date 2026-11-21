"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Plus, X } from "lucide-react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  ASSET_TYPE_LABEL,
  ASSET_TYPE_PLACEHOLDER,
  ASSET_TYPES,
  expectedProof,
  METHOD_LABEL,
  METHODS_BY_TYPE,
  wellKnownUrl,
  type ActionState,
  type Asset,
  type AssetType,
  type OwnershipStatus,
  type VerificationMethod,
} from "@/lib/assets/types";
import { createAsset, deleteAsset, revokeAsset, setActiveMode, setAllowlisted, verifyAsset } from "./actions";

type DnsName = { full: string; relative: string };

const idle: ActionState = { status: "idle" };
const inputClass =
  "h-9 w-full rounded-control border border-line bg-bg px-2.5 text-[13px] text-fg placeholder:text-dim";
const primaryClass =
  "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-control bg-accent px-3 font-medium text-accent-ink hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "inline-flex h-8 cursor-pointer items-center justify-center rounded-control border border-line px-3 text-fg hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
const dangerClass =
  "inline-flex h-8 cursor-pointer items-center justify-center rounded-control border border-sev-critical/50 px-3 text-sev-critical hover:bg-sev-critical/10 disabled:cursor-not-allowed disabled:opacity-50";

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sev-critical" : "text-accent"}>
      {state.message}
    </p>
  );
}

function Submit({ className, children, pendingText, disabled }: {
  className: string;
  children: ReactNode;
  pendingText: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

function Modal({ open, onOpenChange, trigger, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-panel border border-line bg-surface">
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-dim">{description}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Cerrar" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-control text-dim hover:bg-surface-2 hover:text-fg">
              <X size={14} aria-hidden />
            </Dialog.Close>
          </header>
          <div className="p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AddAssetDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AssetType>("domain");
  // Campos controlados: React vacía los formularios tras la acción, también si devuelve error.
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [state, action] = useActionState(createAsset, idle);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Añadir activo"
      description="Solo activos tuyos. Después tendrás que verificar la propiedad."
      trigger={
        <button type="button" className={primaryClass}>
          <Plus size={14} aria-hidden /> Añadir activo
        </button>
      }
    >
      <form action={action} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="asset-label" className="block text-xs text-dim">Nombre</label>
          <input id="asset-label" name="label" value={label} onChange={(event) => setLabel(event.target.value)} required maxLength={120} placeholder="Web principal" className={inputClass} />
        </div>
        <div className="space-y-1">
          <label htmlFor="asset-type" className="block text-xs text-dim">Tipo</label>
          <select id="asset-type" name="type" value={type} onChange={(event) => setType(event.target.value as AssetType)} className={inputClass}>
            {ASSET_TYPES.map((option) => <option key={option} value={option}>{ASSET_TYPE_LABEL[option]}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="asset-value" className="block text-xs text-dim">Objetivo</label>
          <input id="asset-value" name="value" value={value} onChange={(event) => setValue(event.target.value)} required maxLength={2048} placeholder={ASSET_TYPE_PLACEHOLDER[type]} spellCheck={false} className={`${inputClass} font-mono`} />
        </div>
        <div className="space-y-1">
          <label htmlFor="asset-notes" className="block text-xs text-dim">Notas de alcance (opcional)</label>
          <textarea id="asset-notes" name="scope_notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={2} className="w-full rounded-control border border-line bg-bg px-2.5 py-2 text-[13px] text-fg" />
        </div>
        <Feedback state={state} />
        <div className="flex justify-end">
          <Submit className={primaryClass} pendingText="Añadiendo…">Añadir activo</Submit>
        </div>
      </form>
    </Modal>
  );
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <p className="mb-1 text-xs text-dim">{label}</p>
      <div className="flex min-w-0 items-center gap-1 rounded-control border border-line bg-bg pl-2.5">
        <code className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-xs whitespace-nowrap">{value}</code>
        <button type="button" onClick={copy} aria-label={`Copiar ${label}`} title="Copiar" className="grid size-8 shrink-0 cursor-pointer place-items-center text-dim hover:text-fg">
          {copied ? <Check size={14} className="text-accent" aria-hidden /> : <Copy size={14} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function ProofInstructions({ asset, method, dnsName }: {
  asset: Asset;
  method: VerificationMethod;
  dnsName: DnsName | null;
}) {
  const proof = expectedProof(asset.verification_token);
  if (method === "dns_txt") {
    if (!dnsName) return <p className="text-sev-critical">No se pudo determinar la zona DNS de este dominio.</p>;
    return (
      <div className="space-y-3">
        <p className="text-dim">
          Crea este registro TXT nuevo en tu proveedor de DNS. No modifica ni sustituye los registros de tu web.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyValue label="Nombre" value={dnsName.relative} />
          <CopyValue label="Tipo" value="TXT" />
        </div>
        <CopyValue label="Valor" value={proof} />
        <p className="text-xs text-dim">
          Nombre completo: <span className="font-mono break-all">{dnsName.full}</span>
        </p>
      </div>
    );
  }
  if (method === "repo_file") {
    return (
      <div className="space-y-3">
        <p className="text-dim">Añade este fichero en la raíz de la rama principal. El repo debe ser público en GitHub o GitLab.</p>
        <CopyValue label="Fichero" value="auditforge-verify.txt" />
        <CopyValue label="Contenido" value={proof} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-dim">Publica este fichero de texto. Debe responder 200, sin redirecciones.</p>
      <CopyValue label="URL" value={wellKnownUrl(asset) ?? ""} />
      <CopyValue label="Contenido" value={proof} />
    </div>
  );
}

export function VerificationPanel({ asset, status, dnsName }: {
  asset: Asset;
  status: OwnershipStatus;
  dnsName: DnsName | null;
}) {
  const methods = METHODS_BY_TYPE[asset.type];
  const [method, setMethod] = useState<VerificationMethod>(
    asset.verification_method && methods.includes(asset.verification_method) ? asset.verification_method : methods[0]!,
  );
  const [verifyState, verifyAction] = useActionState(verifyAsset, idle);
  const [revokeState, revokeAction] = useActionState(revokeAsset, idle);

  return (
    <div className="space-y-4 p-3">
      {methods.length > 1 && (
        <div role="radiogroup" aria-label="Método de verificación" className="inline-flex rounded-control border border-line p-0.5">
          {methods.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={method === option}
              onClick={() => setMethod(option)}
              className={`h-7 cursor-pointer rounded-[4px] px-3 text-xs ${method === option ? "bg-surface-2 text-fg" : "text-dim hover:text-fg"}`}
            >
              {METHOD_LABEL[option]}
            </button>
          ))}
        </div>
      )}
      <ProofInstructions asset={asset} method={method} dnsName={dnsName} />
      <Feedback state={verifyState} />
      <Feedback state={revokeState} />
      <div className="flex flex-wrap gap-2">
        <form action={verifyAction}>
          <input type="hidden" name="id" value={asset.id} />
          <input type="hidden" name="method" value={method} />
          <Submit className={primaryClass} pendingText="Comprobando…">
            {status === "pending" ? "Verificar propiedad" : "Renovar verificación"}
          </Submit>
        </form>
        {status !== "pending" && (
          <form action={revokeAction}>
            <input type="hidden" name="id" value={asset.id} />
            <Submit className={secondaryClass} pendingText="Revocando…">Revocar</Submit>
          </form>
        )}
      </div>
    </div>
  );
}

function ConfirmValueField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <label htmlFor="confirm-value" className="block text-xs text-dim">Escribe el objetivo para confirmar</label>
      <input id="confirm-value" name="confirm" value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" spellCheck={false} className={`${inputClass} font-mono`} />
    </div>
  );
}

function ActiveModeControl({ asset, canEnable }: { asset: Asset; canEnable: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action] = useActionState(setActiveMode, idle);

  useEffect(() => {
    if (state.status === "ok") {
      setOpen(false);
      setConfirm("");
    }
  }, [state]);

  if (asset.active_mode_enabled) {
    return (
      <form action={action} className="space-y-2">
        <input type="hidden" name="id" value={asset.id} />
        <input type="hidden" name="enabled" value="false" />
        <Submit className={secondaryClass} pendingText="Guardando…">Deshabilitar</Submit>
        <p className="text-xs text-dim">
          Activo preparado para modo active. La ejecución de pruebas intrusivas llegará cuando el worker aislado esté desplegado.
        </p>
        <Feedback state={state} />
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Habilitar modo active"
        description="Permite pruebas que interactúan con la aplicación y pueden alterar datos o afectar al servicio."
        trigger={<button type="button" disabled={!canEnable} className={secondaryClass}>Habilitar</button>}
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={asset.id} />
          <input type="hidden" name="enabled" value="true" />
          <p className="text-dim">Úsalo primero en staging. Cada escaneo active pedirá además su propia confirmación.</p>
          <p className="text-dim">
            Habilitarlo <strong className="text-fg">prepara</strong> el activo. La ejecución de pruebas active llegará cuando el worker aislado esté desplegado; hasta entonces las auditorías son recon y passive.
          </p>
          <p className="rounded-control border border-line bg-bg px-2.5 py-2 font-mono text-xs break-all">{asset.value}</p>
          <ConfirmValueField value={confirm} onChange={setConfirm} />
          <Feedback state={state} />
          <div className="flex justify-end">
            <Submit className={dangerClass} disabled={confirm.trim() !== asset.value} pendingText="Habilitando…">
              Habilitar modo active
            </Submit>
          </div>
        </form>
      </Modal>
      {!open && <Feedback state={state} />}
    </div>
  );
}

function GateRow({ id, name, detail, passed, children }: {
  id: string;
  name: string;
  detail: string;
  passed: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 gap-y-2 p-3">
      <span className="pt-px font-mono text-xs text-dim">{id}</span>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{name}</p>
          <span className={`font-mono text-[11px] ${passed ? "text-accent" : "text-dim"}`}>{passed ? "ABIERTA" : "CERRADA"}</span>
        </div>
        <p className="mt-0.5 text-dim">{detail}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

export function GateControls({ asset, status }: { asset: Asset; status: OwnershipStatus }) {
  const [state, action] = useActionState(setAllowlisted, idle);
  const verified = status === "verified";
  const allowlisted = verified && asset.allowlisted;

  return (
    <ol className="divide-y divide-line">
      <GateRow
        id="01"
        name="Propiedad"
        passed={verified}
        detail={status === "expired" ? "La verificación caducó. Renuévala." : verified ? "Verificada y vigente." : "Pendiente de verificar."}
      />
      <GateRow
        id="02"
        name="Allowlist"
        passed={allowlisted}
        detail={allowlisted ? "Autorizado para escaneos." : "Autoriza el activo tras verificarlo."}
      >
        <form action={action} className="space-y-2">
          <input type="hidden" name="id" value={asset.id} />
          <input type="hidden" name="enabled" value={String(!asset.allowlisted)} />
          <Submit className={secondaryClass} disabled={!verified && !asset.allowlisted} pendingText="Guardando…">
            {asset.allowlisted ? "Quitar de la allowlist" : "Autorizar"}
          </Submit>
          <Feedback state={state} />
        </form>
      </GateRow>
      <GateRow
        id="03"
        name="Modo active"
        passed={allowlisted && asset.active_mode_enabled}
        detail={asset.active_mode_enabled ? "Habilitado. La ejecución active llegará con el worker aislado." : "Recon y passive disponibles al pasar las puertas 01 y 02."}
      >
        <ActiveModeControl asset={asset} canEnable={allowlisted} />
      </GateRow>
    </ol>
  );
}

export function DeleteAssetControl({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action] = useActionState(deleteAsset, idle);

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Eliminar activo"
      description="También se borran sus escaneos y hallazgos. No se puede deshacer."
      trigger={<button type="button" className={dangerClass}>Eliminar activo</button>}
    >
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={asset.id} />
        <p className="rounded-control border border-line bg-bg px-2.5 py-2 font-mono text-xs break-all">{asset.value}</p>
        <ConfirmValueField value={confirm} onChange={setConfirm} />
        <Feedback state={state} />
        <div className="flex justify-end">
          <Submit className={dangerClass} disabled={confirm.trim() !== asset.value} pendingText="Eliminando…">
            Eliminar definitivamente
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
