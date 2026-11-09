import { beforeEach, describe, expect, it, vi } from "vitest";
import { addAssets, addMember, changeMemberPermission, deleteCollection, removeMember, updateCollection } from "@/lib/collections/mutations";
import { HttpError } from "@/lib/http";

const mocks = vi.hoisted(() => ({ role: vi.fn(), tx: vi.fn(), begin: vi.fn() }));
vi.mock("@/lib/access", () => ({ requireCollectionRole: mocks.role, visibleAssetsWhere: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: { begin: mocks.begin } }));

const userId = "11111111-1111-1111-1111-111111111111";
const assetId = "22222222-2222-2222-2222-222222222222";
const collectionId = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  mocks.role.mockReset().mockResolvedValue("OWNER");
  mocks.tx.mockReset();
  mocks.begin.mockReset().mockImplementation((fn) => fn(mocks.tx));
});

describe("collection mutation authorization", () => {
  it.each([
    ["update", "EDITOR", () => updateCollection(userId, collectionId, { name: "Changed" })],
    ["add assets", "EDITOR", () => addAssets(userId, collectionId, [assetId])],
    ["delete", "OWNER", () => deleteCollection(userId, collectionId)],
    ["add member", "OWNER", () => addMember(userId, collectionId, { email: "member@kmitl.ac.th", permission: "VIEWER" })],
  ] as const)("blocks %s before changing data when permission is denied", async (_name, role, action) => {
    mocks.role.mockRejectedValue(new HttpError(403, "FORBIDDEN"));
    await expect(action()).rejects.toMatchObject({ status: 403 });
    expect(mocks.role).toHaveBeenCalledWith(userId, collectionId, role);
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("does not allow adding private files to a collection", async () => {
    mocks.tx.mockResolvedValue([{ asset_id: assetId, owner_id: userId, visibility: "PRIVATE" }]);
    await expect(addAssets(userId, collectionId, [assetId])).rejects.toMatchObject({ status: 409, code: "PRIVATE_ASSET" });
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });

  it("does not let a member reshare somebody else's TEAM file", async () => {
    mocks.tx.mockResolvedValue([{ asset_id: assetId, owner_id: "another-user", visibility: "TEAM" }]);
    await expect(addAssets(userId, collectionId, [assetId])).rejects.toMatchObject({ status: 403, code: "TEAM_ASSET" });
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });

  it("rejects a batch containing files the user cannot see", async () => {
    mocks.tx.mockResolvedValue([]);
    await expect(addAssets(userId, collectionId, [assetId])).rejects.toMatchObject({ status: 404, code: "ASSET_NOT_FOUND" });
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });

  it.each([{ ids: [] }, { ids: ["invalid"] }, { ids: Array(101).fill(assetId) }])("rejects invalid asset batches before a transaction", async ({ ids }) => {
    await expect(addAssets(userId, collectionId, ids)).rejects.toMatchObject({ status: 400, code: "INVALID_ASSETS" });
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("rejects assigning a second owner", async () => {
    await expect(addMember(userId, collectionId, { email: "other@kmitl.ac.th", permission: "OWNER" }))
      .rejects.toMatchObject({ status: 400, code: "INVALID_PERMISSION" });
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("does not allow demoting the collection owner", async () => {
    mocks.tx.mockResolvedValue([{ permission: "OWNER" }]);
    await expect(changeMemberPermission(userId, collectionId, userId, "VIEWER"))
      .rejects.toMatchObject({ status: 409, code: "OWNER_FIXED" });
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });

  it("does not allow the collection owner to leave", async () => {
    mocks.tx.mockResolvedValue([{ permission: "OWNER" }]);
    await expect(removeMember(userId, collectionId, userId)).rejects.toMatchObject({ status: 409, code: "OWNER_FIXED" });
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });
});
