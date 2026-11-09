import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "@/lib/processing/handler";
import { parseProcessingMessage } from "@/lib/processing/queue";

const { processAsset } = vi.hoisted(() => ({ processAsset: vi.fn() }));
vi.mock("@/lib/processing/worker", () => ({ processAsset }));

const message = {
  version: 1,
  assetId: "11111111-1111-1111-1111-111111111111",
  s3Key: "assets/test/original.pdf",
  bucket: "test-bucket",
  mimeType: "application/pdf",
  fileType: "DOCUMENT",
  fileSize: 100,
};

function record(messageId: string, body = JSON.stringify(message), attempt = "1") {
  return { messageId, body, attributes: { ApproximateReceiveCount: attempt } };
}

beforeEach(() => {
  processAsset.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("processing message validation", () => {
  it("accepts the upload queue contract", () => {
    expect(parseProcessingMessage(JSON.stringify(message))).toEqual(message);
  });

  it.each(["{broken", "null", "[]", JSON.stringify({ ...message, version: 2 }),
    JSON.stringify({ ...message, assetId: "invalid" }), JSON.stringify({ ...message, fileType: "VIDEO" }),
    JSON.stringify({ ...message, fileSize: "100" })])("drops invalid message %s", (body) => {
    expect(parseProcessingMessage(body)).toBeNull();
  });
});

describe("SQS processing handler", () => {
  it("drops malformed messages without starting processing or retrying", async () => {
    expect(await handler({ Records: [record("bad", "{broken")] })).toEqual({ batchItemFailures: [] });
    expect(processAsset).not.toHaveBeenCalled();
  });

  it.each(["READY", "SKIPPED"])("acknowledges %s results", async (result) => {
    processAsset.mockResolvedValue(result);
    expect(await handler({ Records: [record("ok")] })).toEqual({ batchItemFailures: [] });
    expect(processAsset).toHaveBeenCalledWith(message, { finalAttempt: false });
  });

  it("returns only failed messages for retry and continues the batch", async () => {
    processAsset.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce("READY");
    expect(await handler({ Records: [record("failed"), record("ok")] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "failed" }],
    });
    expect(processAsset).toHaveBeenCalledTimes(2);
  });

  it("marks the last attempt for the worker and still returns failure for DLQ handling", async () => {
    processAsset.mockRejectedValue(new Error("bad file"));
    expect(await handler({ Records: [record("last", JSON.stringify(message), "3")] })).toEqual({
      batchItemFailures: [{ itemIdentifier: "last" }],
    });
    expect(processAsset).toHaveBeenCalledWith(message, { finalAttempt: true });
  });
});
