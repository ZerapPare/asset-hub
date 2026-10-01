import type { DbFileType, DbProcessingStatus } from "@/lib/schema";

export type FileType = DbFileType;
export type ProcessingStatus = Exclude<DbProcessingStatus, "UPLOADING">;

export type Person = { name: string; isMe?: boolean };

export type Asset = {
  id: string;
  name: string;
  fileType: FileType;
  extension: string;
  size: number;
  status: ProcessingStatus;
  owner: Person;
  createdAt: string;
};

export type Collection = {
  id: string;
  name: string;
  color: string;
  assetCount: number;
  updatedAt: string;
  previews: Asset[];
};

export type TagSummary = {
  id: string;
  name: string;
  documents: number;
  images: number;
  lastUsedAt: string | null;
};

export type StorageSummary = { used: number; documents: number; images: number; quota: number };

export type Summary = {
  totalAssets: number;
  documents: number;
  images: number;
  collections: Collection[];
  tags: number;
  storage: StorageSummary;
};

