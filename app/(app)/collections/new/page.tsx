import { redirect } from "next/navigation";

// ลิงก์ /collections/new เดิม → เปิด popup สร้าง
export default function NewCollectionPage() {
  redirect("/collections?create=1");
}
