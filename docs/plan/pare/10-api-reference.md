# 10 — API Reference (คนที่ 1)

ทุก endpoint ยกเว้นกลุ่ม auth ต้องผ่าน `requireUser()`

## Auth — [02](02-auth.md)
| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/api/auth/google` | วิธีที่ 1: redirect ไป Google (รับ `returnTo`) |
| GET | `/api/auth/google/callback` | บันทึกหรืออัปเดต user แล้วออก session |
| POST | `/api/auth/login` | วิธีที่ 2: อีเมล + รหัสผ่าน (ต้องตั้งรหัสไว้แล้ว) |
| POST | `/api/auth/logout` | |
| GET | `/api/me` | มี `hasPassword`, `recentGoogleAuth` |
| PUT | `/api/me/password` | ตั้ง / เปลี่ยนรหัสผ่าน (ใช้รหัสเดิม หรือ Google login ภายใน 10 นาที) |

## Assets — [03](03-upload.md), [04](04-library-download.md), [05](05-edit-delete.md)
| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/assets/upload-url` | user |
| POST | `/api/assets/:id/complete` | owner |
| GET | `/api/assets` | filter/sort ดู [08](08-filter-sort.md) |
| GET | `/api/assets/:id` | canView |
| GET | `/api/assets/:id/download` | canView |
| PATCH | `/api/assets/:id` | owner |
| DELETE | `/api/assets/:id` | owner |

## Tags — [06](06-tags.md)
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/api/tags?q=` | user |
| POST | `/api/assets/:id/tags` | owner |
| DELETE | `/api/assets/:id/tags/:tagId` | owner |

## Collections — [07](07-collections.md)
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/api/collections` | user |
| POST | `/api/collections` | user |
| GET | `/api/collections/:id` | VIEWER+ |
| PATCH | `/api/collections/:id` | EDITOR+ |
| DELETE | `/api/collections/:id` | OWNER |
| GET | `/api/collections/:id/assets` | VIEWER+ |
| POST | `/api/collections/:id/assets` | EDITOR+ |
| DELETE | `/api/collections/:id/assets/:assetId` | EDITOR+ |
| GET | `/api/collections/:id/members` | VIEWER+ |
| POST | `/api/collections/:id/members` | OWNER |
| PATCH | `/api/collections/:id/members/:userId` | OWNER |
| DELETE | `/api/collections/:id/members/:userId` | OWNER / ตัวเอง |

## รูปแบบ Error
```json
{ "error": { "code": "ASSET_NOT_FOUND", "message": "..." } }
```
- 400 ข้อมูลไม่ถูกต้อง
- 401 ยังไม่ login
- 403 เป็นสมาชิกแต่สิทธิ์ไม่พอ
- 404 ไม่พบ หรือไม่มีสิทธิ์เห็น
- 409 สถานะไม่ถูกต้อง เช่นเรียก complete ซ้ำ
