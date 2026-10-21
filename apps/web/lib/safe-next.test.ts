import { describe, expect, it } from "vitest";
import { loginPathFor, pathAfterLogin, safeNextPath } from "./safe-next";

// R3-D1: the report email links to a page behind login. A visitor without a session is sent to /login and,
// once logged in, comes back to the page the link named.
const LINK = "/parent/00000000-0000-4000-8000-0000000000c1?session=3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";

describe("login redirect round trip", () => {
  it("sends an unauthenticated visit to /login carrying the page, and returns to it after login", () => {
    const login = loginPathFor(LINK);
    expect(login.startsWith("/login?next=")).toBe(true);
    expect(pathAfterLogin(new URL(login, "https://site.example.test").search)).toBe(LINK);
  });

  it("falls back to the parent page when there is no next, or when it is not a path on this site", () => {
    expect(pathAfterLogin("")).toBe("/parent");
    for (const bad of ["//evil.test", `/${String.fromCharCode(92)}evil.test`, "https://evil.test/parent", "parent", "/login", "/login?next=/parent"]) {
      expect(pathAfterLogin(`?next=${encodeURIComponent(bad)}`)).toBe("/parent");
    }
  });

  it("does not loop: asking for the login page itself gives the plain login path", () => {
    expect(loginPathFor("/login?next=%2Fparent")).toBe("/login");
  });
});

describe("safeNextPath", () => {
  it("keeps a path on this site and refuses the rest", () => {
    expect(safeNextPath("/parent/x?a=b")).toBe("/parent/x?a=b");
    expect(safeNextPath("//evil.test")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

// R6-1: browsers drop tab, CR and LF when they parse a URL, so "/\t/evil.example" resolves to another site. The
// helper refuses control characters and backslashes anywhere, then parses the value and returns the parsed
// path, query and hash, never the raw string (OWASP, Unvalidated Redirects and Forwards).
const BS = String.fromCharCode(92);
const HOSTILE: string[] = [
  "/\t/evil.example",
  "/\n/evil.example",
  "/\r/evil.example",
  "/\r\n/evil.example",
  `/\t${BS}evil.example`,
  "/\t\t/evil.example",
  `/${BS}evil.example`,
  `/a${BS}b`,
  `${BS}/evil.example`,
  "//evil.example",
  "///evil.example",
  "/\u0000/evil.example",
  "/\u007f/evil.example",
  "/\u001f/evil.example",
  "javascript:alert(1)",
  "https://evil.example",
  "http://evil.example/parent",
  "evil.example",
  "",
];
// Values that look like a "//host" only after the URL parser normalises dots.
const DOT_TRICKS = ["/.//evil.example", "/a/..//evil.example", "/././/evil.example"];

describe("R6-1 safeNextPath refuses every way to leave this site", () => {
  it.each(HOSTILE)("raw %j gives /", (v) => {
    expect(safeNextPath(v)).toBe("/");
  });
  it.each(HOSTILE.filter((v) => v.includes("/")))("the same value percent-encoded in ?next= (%j) is refused by pathAfterLogin", (v) => {
    expect(pathAfterLogin(`?next=${encodeURIComponent(v)}`)).toBe("/parent");
  });
  it("refuses the encoded forms that decode to a tab, a line feed or a backslash", () => {
    for (const q of ["/%09/evil.example", "/%0A/evil.example", "/%0D%0A/evil.example", "/%09%5Cevil.example", "/%5Cevil.example"]) {
      expect(pathAfterLogin(`?next=${q}`)).toBe("/parent");
    }
  });
  it("keeps a still-encoded slash as a harmless local path (it is not decoded again)", () => {
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    expect(new URL(safeNextPath("/%2F%2Fevil.example"), "https://site.example.test").origin).toBe("https://site.example.test");
  });
  it.each(DOT_TRICKS)("never returns a result that starts with // (%s)", (v) => {
    const r = safeNextPath(v);
    expect(r.startsWith("//")).toBe(false);
    expect(new URL(r, "https://site.example.test").origin).toBe("https://site.example.test");
  });
  it("whatever it returns resolves to this site", () => {
    for (const v of [...HOSTILE, ...DOT_TRICKS, "/ok", "/x?y=1#z"]) {
      expect(new URL(safeNextPath(v), "https://site.example.test").origin).toBe("https://site.example.test");
    }
  });
  it("keeps valid paths with their query and hash", () => {
    expect(safeNextPath("/parent")).toBe("/parent");
    expect(safeNextPath("/parent/abc?session=1&x=y#top")).toBe("/parent/abc?session=1&x=y#top");
    expect(safeNextPath("/children/1?tab=results")).toBe("/children/1?tab=results");
  });
  it("does not follow a login loop", () => {
    expect(pathAfterLogin(`?next=${encodeURIComponent("/login?next=/login")}`)).toBe("/parent");
    expect(pathAfterLogin(`?next=${encodeURIComponent("/login")}`)).toBe("/parent");
    expect(loginPathFor("/login?next=/login")).toBe("/login");
  });
});

// R6-8
describe("R6-8 loginPathFor encodes the page it carries", () => {
  it("keeps & # ? = and non-ASCII inside the single next parameter", () => {
    const page = "/parent/abc?session=1&x=y z#top&é";
    const login = loginPathFor(page);
    const url = new URL(login, "https://site.example.test");
    expect([...url.searchParams.keys()]).toEqual(["next"]);
    expect(url.hash).toBe("");
    expect(url.searchParams.get("next")).toBe(safeNextPath(page));
    expect(login).toBe(`/login?next=${encodeURIComponent(safeNextPath(page))}`);
    expect(login).not.toContain("&x=");
  });
});

// R7-2: the same-origin check itself, by name.
describe("R7-2 same-origin check", () => {
  it("refuses a protocol-relative URL and an absolute URL on another site", () => {
    expect(safeNextPath("//evil.com/x")).toBe("/");
    expect(safeNextPath("https://evil.com/x")).toBe("/");
  });
  it("keeps a path on this site as it is (control)", () => {
    expect(safeNextPath("/parent/abc?x=1#h")).toBe("/parent/abc?x=1#h");
  });
});
