import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { OpenDartDocumentClient } from "@/jobs/collector/open-dart-document-client";

const receiptNumber = "20260909000001";

describe("OpenDartDocumentClient", () => {
  it("extracts the main filing and attachments as safe plain text", async () => {
    const archive = zipSync({
      [`${receiptNumber}.xml`]: strToU8('<?xml version="1.0" encoding="UTF-8"?><DOCUMENT-NAME>주요사항보고서</DOCUMENT-NAME><P>계약 금액 &amp; 기간</P><script>unsafe()</script>'),
      "attachment.xml": strToU8("<TITLE>감사보고서</TITLE><P>첨부 내용</P>"),
      "images/logo.png": new Uint8Array([1, 2, 3]),
      "../unsafe.xml": strToU8("<TITLE>노출되면 안 됨</TITLE>"),
    });
    const fetcher = vi.fn(async () => new Response(archive.buffer as ArrayBuffer, {
      status: 200,
      headers: { "content-type": "application/zip" },
    }));
    const documents = await new OpenDartDocumentClient({ apiKey: "secret-key", fetcher }).fetchDocuments(receiptNumber);

    expect(documents).toHaveLength(2);
    expect(documents[0]).toMatchObject({ kind: "MAIN", title: "주요사항보고서", sequenceNumber: 1 });
    expect(documents[1]).toMatchObject({ kind: "ATTACHMENT", title: "감사보고서", sequenceNumber: 2 });
    expect(documents[0]?.contentText).toContain("계약 금액 & 기간");
    expect(documents[0]?.contentText).not.toContain("unsafe()");
    expect(documents.map((document) => document.fileName)).not.toContain("unsafe.xml");
  });

  it("treats the official file-not-found response as an empty document set", async () => {
    const fetcher = vi.fn(async () => new Response("<result><status>014</status><message>파일이 존재하지 않습니다.</message></result>"));
    await expect(new OpenDartDocumentClient({ apiKey: "secret-key", fetcher }).fetchDocuments(receiptNumber)).resolves.toEqual([]);
  });

  it("falls back to the legacy Korean encoding used by older DART documents", async () => {
    const prefix = strToU8('<?xml version="1.0" encoding="utf-8"?><DOCUMENT-NAME>');
    const korean = new Uint8Array([0xbb, 0xe7, 0xbe, 0xf7, 0xba, 0xb8, 0xb0, 0xed, 0xbc, 0xad]);
    const suffix = strToU8("</DOCUMENT-NAME>");
    const value = new Uint8Array(prefix.length + korean.length + suffix.length);
    value.set(prefix, 0);
    value.set(korean, prefix.length);
    value.set(suffix, prefix.length + korean.length);
    const archive = zipSync({ "legacy.xml": value });
    const fetcher = vi.fn(async () => new Response(archive.buffer as ArrayBuffer));

    const documents = await new OpenDartDocumentClient({ apiKey: "secret-key", fetcher }).fetchDocuments(receiptNumber);
    expect(documents[0]?.title).toBe("사업보고서");
  });

  it("rejects archives larger than the configured compressed-size limit", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      headers: { "content-length": "100" },
    }));
    await expect(new OpenDartDocumentClient({ apiKey: "secret-key", fetcher, maxArchiveBytes: 10 }).fetchDocuments(receiptNumber))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
