import { NextResponse } from "next/server";

// A handful of API routes caught an unhandled exception (most commonly a
// database error) and let Next.js's default error page leak through as the
// response body. That body isn't valid JSON, so a client doing
// `await res.json()` throws instead of reading an error message - and if
// that throw isn't caught either, whatever was waiting on the response
// (e.g. a submit button's loading state) just hangs forever with no
// feedback. This gives every route the same one-line way to avoid that:
// log the real error server-side, but always hand the client clean JSON.
export function dbErrorResponse(error: unknown) {
  console.error("Database error in API route:", error);
  return NextResponse.json(
    { error: "Something went wrong on our end. Please try again." },
    { status: 500 }
  );
}
