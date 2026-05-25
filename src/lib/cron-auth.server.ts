// Shared bearer-token authentication for /api/public/hooks/* cron endpoints.
// Callers (pg_cron or external schedulers) must send:
//   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
export function verifyCronAuth(request: Request): Response | null {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = header.slice("Bearer ".length).trim();
  if (token !== expected) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
