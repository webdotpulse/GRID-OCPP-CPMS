import { NextResponse, userAgent } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // We can't actually read localStorage here, so we'll just check for a token cookie if we were using one.
  // Since we rely on localStorage for the JWT (common in SPAs, but tricky in SSR), 
  // Next.js middleware won't have access to the localStorage token unless we set a cookie.
  // For now, we will let the client side handle the protection or we skip middleware 
  // and handle it in a private layout component.
  
  // A better approach in Next 13+ app router is to use cookies for the auth token.
  // But given standard REST APIs, let's keep it simple: no strict middleware blocking, 
  // we'll block unauthenticated users at the RootLayout / AppShell level.

  const { device } = userAgent(request);
  const url = request.nextUrl.clone();

  // Paths that should not be rewritten on mobile
  const bypassMobilePaths = [
    '/login',
    '/forgot-password',
    '/manifest.webmanifest',
    '/manifest.json',
    '/icon.svg',
    '/favicon.ico',
    '/sw.js',
    '/apple-icon',
    '/robots.txt',
    '/sitemap.xml',
  ];

  // Pass through API, Next internals, assets, and file requests with extensions
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/assets') ||
    url.pathname.includes('.') ||
    bypassMobilePaths.includes(url.pathname)
  ) {
    return NextResponse.next();
  }

  if (device.type === 'mobile') {
    if (!url.pathname.startsWith('/mobile')) {
      if (url.pathname === '/') {
        url.pathname = '/mobile/dashboard';
      } else {
        url.pathname = `/mobile${url.pathname}`;
      }
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.svg|manifest\\.webmanifest|manifest\\.json|sw\\.js|apple-icon|robots\\.txt|sitemap\\.xml|assets/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest|js|css|woff2?|map)$).*)',
  ],
};
