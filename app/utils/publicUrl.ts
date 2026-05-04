import type { NextRequest } from 'next/server';

/** Hostnames that must never be used in user-facing links (bind-all / unspecified). */
export function isUnusableLinkHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === '0.0.0.0' || h === '[::]' || h === '::';
}

/**
 * Public origin (scheme + host + port) for links in emails and redirects.
 * When the app listens on 0.0.0.0, `request.url` still shows that host; prefer Host / forwarded headers.
 */
export function publicOriginFromRequest(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return 'http://localhost:3000';
  }

  if (!isUnusableLinkHost(url.hostname)) {
    return url.origin;
  }

  const host = request.headers.get('host');
  if (host) {
    return `${url.protocol}//${host}`;
  }

  if (url.port) {
    return `${url.protocol}//127.0.0.1:${url.port}`;
  }
  return 'http://localhost:3000';
}
