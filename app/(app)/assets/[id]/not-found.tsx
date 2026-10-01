import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function AssetNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState>
        ไม่พบไฟล์นี้ หรือคุณไม่มีสิทธิ์ดู —{" "}
        <Link href="/assets" className="font-semibold text-brand hover:text-brand-hover">
          กลับไป Asset ทั้งหมด
        </Link>
      </EmptyState>
    </div>
  );
}
