import { EmptyState, PageHeader, Panel } from "@/components/ui";

export function PendingSection({ title, empty, detail, phase }: {
  title: string;
  empty: string;
  detail: string;
  phase: string;
}) {
  return (
    <>
      <PageHeader title={title} meta={phase} />
      <div className="p-4">
        <Panel title={title}>
          <EmptyState title={empty} detail={detail} />
        </Panel>
      </div>
    </>
  );
}
