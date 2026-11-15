/** Validate browser-origin requests against the public host, even after a proxy rewrite. */
export function isSameRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = (
    request.headers.get("host") ?? request.headers.get("x-forwarded-host") ?? ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!origin || !host) return false;

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.host.toLowerCase() !== host) return false;
    const forwardedProtocol = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim()
      .toLowerCase();
    return !forwardedProtocol || parsedOrigin.protocol === `${forwardedProtocol}:`;
  } catch {
    return false;
  }
}
