import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/lib/auth/password";
import { readJson } from "@/lib/http";
import { checkFile } from "@/lib/upload/rules";

describe("upload validation", () => {
  it.each([
    ["report.pdf", "application/pdf", "DOCUMENT", "pdf"],
    ["photo.JPG", "image/jpeg", "IMAGE", "jpg"],
    ["photo.jpeg", "image/jpeg", "IMAGE", "jpeg"],
    ["photo.png", "image/png", "IMAGE", "png"],
    ["photo.webp", "image/webp", "IMAGE", "webp"],
  ])("accepts supported file %s up to 20 MiB", (name, mime, fileType, extension) => {
    expect(checkFile(name, mime, 20 * 1024 * 1024)).toEqual({ ok: true, fileType, extension });
  });

  it.each([
    ["report.pdf", "application/pdf", 0],
    ["report.pdf", "application/pdf", -1],
    ["report.pdf", "application/pdf", 20 * 1024 * 1024 + 1],
    ["report.exe", "application/pdf", 100],
    ["report.pdf", "image/png", 100],
    ["report.svg", "image/svg+xml", 100],
    ["report", "application/pdf", 100],
  ])("rejects invalid upload %s (%s, %s bytes)", (name, mime, size) => {
    expect(checkFile(name, mime, size).ok).toBe(false);
  });
});

describe("password validation", () => {
  it.each([undefined, null, 12345678, "short"])("rejects %s", (value) => {
    expect(validateNewPassword(value)).not.toBeNull();
  });

  it("enforces bcrypt's 72-byte limit for Thai and ASCII passwords", () => {
    expect(validateNewPassword("a".repeat(72))).toBeNull();
    expect(validateNewPassword("a".repeat(73))).not.toBeNull();
    expect(validateNewPassword("ก".repeat(24))).toBeNull();
    expect(validateNewPassword("ก".repeat(25))).not.toBeNull();
  });
});

describe("JSON request validation", () => {
  it.each(["{broken", "null", "[]", "42", '"text"', ""])("handles invalid object body %s", async (body) => {
    expect(await readJson(new Request("http://localhost", { method: "POST", body }))).toEqual({});
  });

  it("preserves an object body for endpoint validation", async () => {
    const body = { name: "report", tags: ["research"] };
    expect(await readJson(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }))).toEqual(body);
  });
});
