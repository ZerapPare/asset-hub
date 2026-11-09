import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDownloadUrl, getPreviewUrl, getThumbnailUrl } from "@/lib/assets/files";

const mocks = vi.hoisted(() => ({ query: vi.fn(), presign: vi.fn() }));
vi.mock("@/lib/access", () => ({ visibleAssetsWhere: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: Object.assign(mocks.query, { json: (value: unknown) => value }) }));
vi.mock("@/lib/s3", () => ({ presignGet: mocks.presign }));

const userId = "11111111-1111-1111-1111-111111111111";
const assetId = "22222222-2222-2222-2222-222222222222";
const file = {
  asset_id: assetId,
  display_name: "รายงาน",
  file_extension: "pdf",
  mime_type: "application/pdf",
  s3_key: "assets/test/original.pdf",
  thumbnail_key: null,
};

beforeEach(() => {
  mocks.query.mockReset();
  mocks.presign.mockReset().mockResolvedValue("https://storage.example/signed");
});

describe("asset file URLs", () => {
  it.each([getDownloadUrl, getPreviewUrl, getThumbnailUrl])("never signs a URL when the visibility query finds no file", async (getUrl) => {
    mocks.query.mockResolvedValue([]);
    await expect(getUrl(userId, assetId)).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });
    expect(mocks.presign).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it.each([getDownloadUrl, getPreviewUrl, getThumbnailUrl])("rejects malformed IDs before querying or signing", async (getUrl) => {
    await expect(getUrl(userId, "invalid")).rejects.toMatchObject({ status: 404 });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.presign).not.toHaveBeenCalled();
  });

  it("signs downloads with a Thai filename and records an audit event", async () => {
    mocks.query.mockResolvedValueOnce([file]).mockResolvedValueOnce([]);
    await expect(getDownloadUrl(userId, assetId)).resolves.toBe("https://storage.example/signed");
    expect(mocks.presign).toHaveBeenCalledWith(file.s3_key, { filename: "รายงาน.pdf", contentType: "application/pdf" });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[1]).toContain(userId);
    expect(mocks.query.mock.calls[1]).toContain(assetId);
  });

  it("does not duplicate the download extension", async () => {
    mocks.query.mockResolvedValueOnce([{ ...file, display_name: "Report.PDF" }]).mockResolvedValueOnce([]);
    await getDownloadUrl(userId, assetId);
    expect(mocks.presign).toHaveBeenCalledWith(file.s3_key, { filename: "Report.PDF", contentType: "application/pdf" });
  });

  it("does not create a signed URL for a missing thumbnail", async () => {
    mocks.query.mockResolvedValue([file]);
    await expect(getThumbnailUrl(userId, assetId)).rejects.toMatchObject({ status: 404, code: "THUMBNAIL_NOT_FOUND" });
    expect(mocks.presign).not.toHaveBeenCalled();
  });
});
