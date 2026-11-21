"use client";

import { setFindingStatus } from "./actions";
import { FINDING_STATUSES, STATUS_LABEL, type FindingStatus } from "./constants";

export function StatusSelect({ id, status }: { id: string; status: FindingStatus }) {
  return (
    <form action={setFindingStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Estado del hallazgo"
        className="h-8 cursor-pointer rounded-control border border-line bg-surface px-2 text-xs text-fg"
      >
        {FINDING_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </select>
    </form>
  );
}
