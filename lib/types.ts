export type FileType = "DOCUMENT" | "IMAGE" | "VIDEO";
export type ProcessingStatus = "PROCESSING" | "READY" | "FAILED";

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

export type StorageSummary = { used: number; documents: number; images: number; quota: number };

export type Summary = {
  totalAssets: number;
  documents: number;
  images: number;
  videos: number;
  collections: Collection[];
  tags: number;
  storage: StorageSummary;
};

