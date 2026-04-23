/** @type {Set<string>} Paths removed from the site; return 404 (avoids SPA fallback serving index.html). */
const REMOVED_PATHS = new Set([
  "/guides/registry-deed-howto",
  "/guides/registry-deed-howto.html",
]);

function normalizePathname(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isRemovedPath(pathname) {
  return REMOVED_PATHS.has(normalizePathname(pathname));
}

const GONE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>페이지를 찾을 수 없습니다 | Mortgage Loan Lab</title>
</head>
<body>
  <p>요청하신 페이지는 더 이상 제공되지 않습니다.</p>
  <p><a href="/">홈</a> · <a href="/guides/">가이드</a></p>
</body>
</html>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  const canonicalHost = "mortgage-loan.uk";
  const aliasHosts = new Set([
    "mortgage-loan-5oz.pages.dev",
    "www.mortgage-loan.uk",
  ]);

  if (aliasHosts.has(host)) {
    url.hostname = canonicalHost;
    url.port = "";
    return Response.redirect(url.toString(), 301);
  }

  if (isRemovedPath(url.pathname)) {
    return new Response(GONE_HTML, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return context.next();
}
