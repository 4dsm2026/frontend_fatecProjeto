import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachmentImageUrl, downloadTicketAttachment, listTicketAttachments, uploadTicketAttachment } from "../utils/ticket-attachments";
import type { TicketAttachment } from "../utils/ticket-attachments";
import type { HalResource } from "../utils/hal";
import { json, stubApi } from "./helpers-api";

const attachment: TicketAttachment = {
  id: "file-1", nomeArquivo: "comprovante.pdf", mimeType: "application/pdf",
  tamanhoBytes: 4, enviadoEm: "2026-11-02T12:00:00Z",
  _links: { content: { href: "/files/custom-content", method: "GET" } },
};
const ticket: HalResource = { _links: {
  attachments: { href: "/files/custom-list", method: "GET" },
  upload: { href: "/files/custom-upload", method: "POST" },
} };

beforeEach(() => localStorage.clear());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("anexos dos chamados pelo contrato HAL", () => {
  it("segue attachments e next para carregar todas as páginas", async () => {
    const api = stubApi({
      "GET /files/custom-list": () => json({ _embedded: { attachments: [attachment] }, _links: {
        next: { href: "/files/second-page", method: "GET" },
      } }),
      "GET /files/second-page": () => json({ _embedded: { attachments: [{ ...attachment, id: "file-2" }] } }),
    });
    expect((await listTicketAttachments(ticket)).map((a) => a.id)).toEqual(["file-1", "file-2"]);
    expect(api.keys()).toEqual(["GET /files/custom-list", "GET /files/second-page"]);
  });

  it("não apresenta a lista como completa quando uma página falha", async () => {
    stubApi({
      "GET /files/custom-list": () => json({ _embedded: { attachments: [attachment] }, _links: {
        next: { href: "/files/second-page", method: "GET" },
      } }),
      "GET /files/second-page": () => json({ title: "Falha", status: 500, detail: "Banco indisponível" }, 500),
    });
    await expect(listTicketAttachments(ticket)).rejects.toThrow("Banco indisponível");
  });

  it("envia FormData pelo link upload sem definir o boundary manualmente", async () => {
    const file = new File(["test"], "comprovante.pdf", { type: "application/pdf" });
    const api = stubApi({ "POST /files/custom-upload": (init) => {
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get("file")).toBe(file);
      expect(new Headers(init.headers).has("Content-Type")).toBe(false);
      return json(attachment, 201);
    } });
    expect(await uploadTicketAttachment(ticket, file)).toEqual(attachment);
    expect(api.keys()).toEqual(["POST /files/custom-upload"]);
  });

  it("sem link de upload, não envia requisição nem inventa rota", async () => {
    const api = stubApi({});
    await expect(uploadTicketAttachment({}, new File(["x"], "x.txt"))).rejects.toThrow("upload");
    expect(api.keys()).toEqual([]);
    expect(await listTicketAttachments({})).toEqual([]);
  });

  it("baixa o conteúdo autenticado pelo link, preserva nome e libera o blob", async () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    localStorage.setItem("accessToken", "token-de-teste");
    const api = stubApi({ "GET /files/custom-content": () => new Response("test") });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("comprovante.pdf");
      expect(this.href).toBe("blob:test");
    });
    await downloadTicketAttachment(attachment);
    expect(api.calls[0].auth).toBe("Bearer token-de-teste");
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });

  it("não tenta baixar nem pré-visualizar quando content está ausente", async () => {
    const api = stubApi({});
    const expired = { ...attachment, _links: {} };
    expect(await attachmentImageUrl(expired)).toBeNull();
    await expect(downloadTicketAttachment(expired)).rejects.toThrow("content");
    expect(api.keys()).toEqual([]);
  });
});
