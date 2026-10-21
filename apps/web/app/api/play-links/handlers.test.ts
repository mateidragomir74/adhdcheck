import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPlayCode, isPlayCode, newPlayCode, PLAY_LINK_LIFETIME_MS } from "../../../lib/play-link";
import { PROCESSING_CONSENT_VERSION } from "../../../lib/processing-consent";
import { handleCreatePlayLink, handleResolvePlayLink, type PlayLinkStore } from "./handlers";

const PARENT = "00000000-0000-4000-8000-00000000000a";
const CHILD = "00000000-0000-4000-8000-0000000000ca";
const NOW = new Date("2026-10-20T10:00:00Z");

const OFF = { camera: false, microphone: false };

function fakeStore({ issued = true, childId = CHILD as string | null, consent = OFF, agreed = true } = {}) {
  const issue = vi.fn().mockResolvedValue(issued);
  const resolve = vi.fn().mockResolvedValue(childId ? { childId, consent } : null);
  const hasProcessingConsent = vi.fn().mockResolvedValue(agreed);
  return { store: { issue, resolve, hasProcessingConsent } satisfies PlayLinkStore, issue, resolve, hasProcessingConsent };
}

function create(body: unknown, store: PlayLinkStore, { parentId = PARENT as string | null, contentType = "application/json" } = {}) {
  const request = new Request("http://localhost/api/play-links", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
  return handleCreatePlayLink(request, { store, getParentId: async () => parentId, now: () => NOW });
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/play-links (FR-01, FR-32)", () => {
  it("creates a play link for the parent's child and stores only the code hash", async () => {
    const { store, issue } = fakeStore();
    const res = await create({ child_id: CHILD }, store);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(isPlayCode(body.code)).toBe(true);
    expect(body.expires_at).toBe(new Date(NOW.getTime() + PLAY_LINK_LIFETIME_MS).toISOString());
    expect(issue).toHaveBeenCalledWith({
      parentId: PARENT,
      childId: CHILD,
      codeHash: hashPlayCode(body.code),
      expiresAt: new Date(NOW.getTime() + PLAY_LINK_LIFETIME_MS),
      consent: OFF,
    });
  });

  it("FR-70: stores the parent's camera and microphone choices, off when not sent", async () => {
    const { store, issue } = fakeStore();
    await create({ child_id: CHILD, camera: false, microphone: true }, store);
    expect(issue.mock.calls[0][0].consent).toEqual({ camera: false, microphone: true });

    await create({ child_id: CHILD, camera: true }, store);
    expect(issue.mock.calls[1][0].consent).toEqual({ camera: true, microphone: false });
  });

  it("answers 401 when no parent is logged in", async () => {
    const { store, issue } = fakeStore();
    const res = await create({ child_id: CHILD }, store, { parentId: null });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "not_logged_in" });
    expect(issue).not.toHaveBeenCalled();
  });

  it("NFR-04: answers 403 and issues nothing before the parent has consented to the current text", async () => {
    const { store, issue, hasProcessingConsent } = fakeStore({ agreed: false });
    const res = await create({ child_id: CHILD }, store);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "consent_required" });
    expect(hasProcessingConsent).toHaveBeenCalledWith(PARENT, PROCESSING_CONSENT_VERSION);
    expect(issue).not.toHaveBeenCalled();
  });

  it("NFR-04: answers 503 and issues nothing when the consent cannot be checked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, issue, hasProcessingConsent } = fakeStore();
    hasProcessingConsent.mockRejectedValue(new Error("connection refused"));
    const res = await create({ child_id: CHILD }, store);

    expect(res.status).toBe(503);
    expect(issue).not.toHaveBeenCalled();
  });

  it("answers 404 for a child that is not the parent's", async () => {
    const { store } = fakeStore({ issued: false });
    const res = await create({ child_id: CHILD }, store);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown_child" });
  });

  it.each([[{}], [{ child_id: "not-a-uuid" }], [{ child_id: CHILD, extra: 1 }], [{ child_id: CHILD, camera: "yes" }], [{ child_id: CHILD, microphone: 1 }], [{ child_id: CHILD, camera: null }]])("answers 400 for body %j", async (body) => {
    const { store, issue } = fakeStore();
    const res = await create(body, store);

    expect(res.status).toBe(400);
    expect(issue).not.toHaveBeenCalled();
  });

  it("refuses a body that is not sent as JSON (blocks cross-site form posts)", async () => {
    const { store, issue } = fakeStore();
    const res = await create({ child_id: CHILD }, store, { contentType: "text/plain" });

    expect(res.status).toBe(415);
    expect(issue).not.toHaveBeenCalled();
  });

  it("answers 503 when the store fails, without logging the code", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, issue } = fakeStore();
    issue.mockRejectedValue(new Error("connection refused"));
    const res = await create({ child_id: CHILD }, store);

    expect(res.status).toBe(503);
    expect(JSON.stringify(error.mock.calls)).not.toContain(CHILD);
  });
});

describe("GET /api/play-links/[code] (FR-01)", () => {
  it("answers the child_id and the parent's camera and microphone choices (FR-70), looked up by hash", async () => {
    const { store, resolve } = fakeStore({ consent: { camera: true, microphone: false } });
    const { code, codeHash } = newPlayCode();
    const res = await handleResolvePlayLink(code, { store });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ child_id: CHILD, consent: { camera: true, microphone: false } });
    expect(resolve).toHaveBeenCalledWith(codeHash);
  });

  it("answers 404 for an unknown, expired or used play link", async () => {
    const { store } = fakeStore({ childId: null });
    const res = await handleResolvePlayLink(newPlayCode().code, { store });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "invalid_play_link" });
  });

  it("answers 404 for a malformed code without asking the store", async () => {
    const { store, resolve } = fakeStore();
    const res = await handleResolvePlayLink("not-a-code", { store });

    expect(res.status).toBe(404);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("is never cached", async () => {
    const { store } = fakeStore();
    const res = await handleResolvePlayLink(newPlayCode().code, { store });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 500, not a storage error, when the stored link breaks the contract", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const store: PlayLinkStore = {
      issue: vi.fn(),
      resolve: vi.fn().mockResolvedValue({ childId: "", consent: OFF }),
      hasProcessingConsent: vi.fn(),
    };
    const res = await handleResolvePlayLink(newPlayCode().code, { store });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "invalid_answer" });
    expect(JSON.stringify(error.mock.calls)).toContain("invalid_answer");
  });
});
