// Where a visitor goes after logging in or confirming an email. This one helper is used wherever a next or
// redirect target is read, on the server and in the browser. Only a path on this site is ever followed.
//
// Why not a prefix check: browsers drop tab, CR and LF when they parse a URL, so "/<TAB>/host" is read as
// "//host", another site. The rule (OWASP, Unvalidated Redirects and Forwards): refuse any control character and
// any backslash, parse the value against a fixed base, require the same origin, and return the parsed path,
// query and hash, never the raw string.

const BASE = "http://x";
const BACKSLASH = 0x5c;

function hasForbiddenChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === BACKSLASH) return true;
  }
  return false;
}

export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || hasForbiddenChar(next)) return "/";
  let parsed: URL;
  try {
    parsed = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (parsed.origin !== BASE) return "/";
  const path = parsed.pathname + parsed.search + parsed.hash;
  // "/a/..//host" normalises to "//host", which a browser reads as another site.
  return path.startsWith("//") ? "/" : path;
}

function isLogin(path: string): boolean {
  return path === "/login" || path.startsWith("/login?") || path.startsWith("/login/") || path.startsWith("/login#");
}

// current: pathname plus query of the page that needs a login.
export function loginPathFor(current: string): string {
  const next = safeNextPath(current);
  if (next === "/" || isLogin(next)) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

// search: the query string of the login page.
export function pathAfterLogin(search: string): string {
  const next = safeNextPath(new URLSearchParams(search).get("next"));
  return next === "/" || isLogin(next) ? "/parent" : next;
}
