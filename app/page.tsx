import { redirect } from "next/navigation";

// TODO: เปลี่ยนเป็นหน้า Library
export default function Home() {
  redirect("/login");
}
