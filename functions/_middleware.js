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

  return context.next();
}
