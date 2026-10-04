import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function CollectionNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState>
        ไม่พบ Collection นี้ หรือคุณไม่ได้เป็นสมาชิก —{" "}
        <Link href="/collections" className="font-semibold text-brand hover:text-brand-hover">
          กลับไป Collection ทั้งหมด
        </Link>
      </EmptyState>
    </div>
  );
}
