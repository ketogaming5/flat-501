import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
