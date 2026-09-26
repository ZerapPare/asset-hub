import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/icons";
import type { ProcessingStatus } from "@/lib/types";

export const statusMeta = {
  READY: { label: "Ready", Icon: CheckIcon, text: "text-success", soft: "bg-success-soft" },
  PROCESSING: { label: "Processing", Icon: SpinnerIcon, text: "text-info", soft: "bg-info-soft" },
  FAILED: { label: "Failed", Icon: AlertIcon, text: "text-danger", soft: "bg-danger-soft" },
} satisfies Record<ProcessingStatus, unknown>;

// solid = พื้นขาว ใช้วางบนรูป
export function StatusBadge({ status, solid = false }: { status: ProcessingStatus; solid?: boolean }) {
  const { label, Icon, text, soft } = statusMeta[status];
  const bg = solid ? "bg-surface shadow-sm" : soft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${text} ${bg}`}>
      <Icon className={`size-3.5 ${status === "PROCESSING" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
