import { beforeEach, describe, expect, it, vi } from "vitest";
import { canViewAsset, getCollectionPermission, hasCollectionRole, requireCollectionRole } from "@/lib/access";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ sql: query }));

const userId = "11111111-1111-1111-1111-111111111111";
const id = "22222222-2222-2222-2222-222222222222";

beforeEach(() => query.mockReset());

describe("collection permissions", () => {
  it.each([
    [null, "VIEWER", false],
    ["VIEWER", "VIEWER", true],
    ["VIEWER", "EDITOR", false],
    ["VIEWER", "OWNER", false],
    ["EDITOR", "VIEWER", true],
    ["EDITOR", "EDITOR", true],
    ["EDITOR", "OWNER", false],
    ["OWNER", "VIEWER", true],
    ["OWNER", "EDITOR", true],
    ["OWNER", "OWNER", true],
  ] as const)("%s requiring %s returns %s", (role, min, expected) => {
    expect(hasCollectionRole(role, min)).toBe(expected);
  });

  it("treats malformed IDs as missing without querying the database", async () => {
    expect(await getCollectionPermission(userId, "invalid")).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("hides collections from non-members with 404", async () => {
    query.mockResolvedValue([]);
    await expect(requireCollectionRole(userId, id, "VIEWER")).rejects.toMatchObject({ status: 404, code: "COLLECTION_NOT_FOUND" });
  });

  it("rejects viewers attempting an editor action with 403", async () => {
    query.mockResolvedValue([{ permission: "VIEWER" }]);
    await expect(requireCollectionRole(userId, id, "EDITOR")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("allows an editor action for an owner", async () => {
    query.mockResolvedValue([{ permission: "OWNER" }]);
    await expect(requireCollectionRole(userId, id, "EDITOR")).resolves.toBe("OWNER");
  });
});

describe("asset access", () => {
  it("rejects malformed asset IDs without querying the database", async () => {
    expect(await canViewAsset(userId, "invalid")).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
