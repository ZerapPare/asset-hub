import { listMyCollections, type MyCollection } from "@/lib/collections/queries";

export async function listCollections(userId: string): Promise<MyCollection[]> {
  return listMyCollections(userId);
}
