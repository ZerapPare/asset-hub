// Enum และ row type ที่ตรงกับ db/migrations/0001_schema.sql
// แก้ schema เมื่อไร ต้องแก้ไฟล์นี้ให้ตรงด้วย

export const VISIBILITIES = ["ORGANIZATION", "TEAM", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const FILE_TYPES = ["DOCUMENT", "IMAGE"] as const;
export type DbFileType = (typeof FILE_TYPES)[number];

export const PROCESSING_STATUSES = ["UPLOADING", "PROCESSING", "READY", "FAILED"] as const;
export type DbProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const COLLECTION_PERMISSIONS = ["OWNER", "EDITOR", "VIEWER"] as const;
export type CollectionPermission = (typeof COLLECTION_PERMISSIONS)[number];

export const PROCESS_TYPES = ["TEXT_EXTRACTION", "TEXT_EMBEDDING", "IMAGE_EMBEDDING"] as const;
export type ProcessType = (typeof PROCESS_TYPES)[number];

export const WORKFLOW_STATUSES = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "UPLOAD", "UPDATE", "DELETE", "DOWNLOAD", "CHANGE_VISIBILITY",
  "CREATE_COLLECTION", "UPDATE_COLLECTION", "DELETE_COLLECTION",
  "ADD_TO_COLLECTION", "REMOVE_FROM_COLLECTION",
  "ADD_MEMBER", "REMOVE_MEMBER", "CHANGE_MEMBER_PERMISSION",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Row ตามชื่อคอลัมน์ใน DB (snake_case) — BIGINT มาเป็น string
export type UserRow = {
  user_id: string;
  avatar_url: string | null;
  display_name: string;
  email: string;
  google_sub: string;
  password_hash: string | null;
  password_set_at: Date | null;
  verified_at: Date | null;
  status: UserStatus;
  token_version: number;
  created_at: Date;
  updated_at: Date;
};

export type AssetRow = {
  asset_id: string;
  owner_id: string;
  visibility: Visibility;
  original_name: string;
  display_name: string;
  description: string | null;
  file_type: DbFileType;
  file_extension: string;
  file_size: string;
  mime_type: string;
  image_width: number | null;
  image_height: number | null;
  s3_key: string;
  thumbnail_key: string | null;
  processing_status: DbProcessingStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type CollectionRow = {
  collection_id: string;
  created_by: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};
