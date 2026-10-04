import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง" } }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  return (await request.json().catch(() => ({}))) as Partial<T>;
}

// แปลง error เป็น response
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}
