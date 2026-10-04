"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FolderPlusIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { collectionRequest } from "./api";
import { CollectionForm } from "./collection-form";

// popup สร้าง Collection เปิดด้วย ?create=1
export function CreateCollectionDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("create") === "1";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  function close() {
    const params = new URLSearchParams(searchParams);
    params.delete("create");
    setName("");
    setDescription("");
    setError(undefined);
    router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  async function create() {
    if (!name.trim()) return setError("กรุณาตั้งชื่อ Collection");
    setPending(true);
    setError(undefined);
    try {
      const { id } = await collectionRequest<{ id: string }>("", "POST", { name, description });
      setName("");
      setDescription("");
      router.push(`/collections/${id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setPending(false);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="สร้าง Collection"
      subtitle="รวมไฟล์ที่เกี่ยวข้องไว้ด้วยกัน ไฟล์หนึ่งอยู่ได้หลาย Collection"
      footer={
        <>
          <button type="button" onClick={close} className="h-11 rounded-xl border border-line bg-surface px-5 font-semibold hover:border-ink-subtle">
            ยกเลิก
          </button>
          <button type="button" onClick={create} disabled={pending} className="flex h-11 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
            <FolderPlusIcon className="size-5" />
            {pending ? "กำลังสร้าง…" : "สร้าง Collection"}
          </button>
        </>
      }
    >
      <CollectionForm name={name} description={description} onName={setName} onDescription={setDescription} error={error} />
    </Modal>
  );
}
