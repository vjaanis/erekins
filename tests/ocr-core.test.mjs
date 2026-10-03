import test from "node:test";
import assert from "node:assert/strict";
import { detectDocumentType, detectImageType, extractInvoiceHints, parseDataUrl } from "../server/ocr-core.mjs";

test("atpazīst PNG un noraida neatbalstītu saturu", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectImageType(png), "image/png");
  assert.equal(parseDataUrl(`data:image/png;base64,${png.toString("base64")}`).buffer.length, 8);
  assert.throws(() => parseDataUrl("data:image/png;base64,dGV4dHM="), /Faila saturs/);
});

test("atpazīst un validē PDF dokumentu", () => {
  const pdf = Buffer.from("%PDF-1.7\n%test");
  const result = parseDataUrl(`data:application/pdf;base64,${pdf.toString("base64")}`);
  assert.equal(detectDocumentType(pdf), "application/pdf");
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.buffer.equals(pdf), true);
  assert.throws(() => parseDataUrl(`data:image/png;base64,${pdf.toString("base64")}`), /Faila saturs/);
});

test("no OCR teksta iegūst droši atpazīstamos rēķina laukus", () => {
  const result = extractInvoiceHints(`RĒĶINS Nr. REK-2026/17
Rēķina datums: 28.09.2026
Apmaksāt līdz: 12.10.2026
Pircēja atsauce: LIGUMS-42
PVN maksātāja Nr. LV40103512178
Klients LV40103632832
IBAN LV64 UNLA 0050 0185 3213 1`);
  assert.equal(result.number, "REK-2026/17");
  assert.equal(result.issueDate, "2026-09-28");
  assert.equal(result.dueDate, "2026-10-12");
  assert.equal(result.buyerReference, "LIGUMS-42");
  assert.equal(result.supplier.regNo, "40103512178");
  assert.equal(result.customer.vatNo, "LV40103632832");
  assert.equal(result.payment.iban, "LV64UNLA0050018532131");
});

test("nederīgu OCR datumu neieliek rēķinā", () => {
  assert.equal(extractInvoiceHints("Datums: 48.08.2026").issueDate, "");
  assert.equal(extractInvoiceHints("Datums: 29.02.2025").issueDate, "");
});
