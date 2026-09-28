import { redirect } from "next/navigation";

// ลิงก์ /upload เดิม → เปิดหน้าต่าง Upload บนหน้า Asset
export default function UploadPage() {
  redirect("/assets?upload=1");
}
