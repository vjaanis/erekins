import test from "node:test";
import assert from "node:assert/strict";
import { buildVisionRequest, extractInvoiceWithVision, normalizeVisionInvoice } from "../server/vision.mjs";

const extracted = () => ({
  number: "KZ/26/0498",
  buyerReference: "",
  issueDate: "2026-08-20",
  dueDate: "",
  paymentTermsDays: "14",
  note: "preču pārdošana",
  exemptionReason: "Nodokļa apgrieztā maksāšana",
  supplier: { name: "SIA ALNI AS", regNo: "42403009452", vatNo: "LV42403009452", address: "Rēzeknes novads" },
  customer: { name: "SIA ADORA", regNo: "40103237094", vatNo: "LV40103237094", address: "Rīga" },
  payment: { iban: "LV79 HABA 0001 4080 5099 6", bic: "HABALV22" },
  lines: [{ description: "Nežāvēts BA156", quantity: "10,292", unit: "MTQ", unitPrice: "327,00", discount: "", charge: "", taxCategory: "AE", vatRate: "21" }],
  rawText: "PAVADZĪME-RĒĶINS",
  warnings: ["Datums labots ar roku."]
});

test("normalizē dokumentu redzes modeļa rēķinu", () => {
  const result = normalizeVisionInvoice(extracted());
  assert.equal(result.invoice.dueDate, "2026-09-03");
  assert.equal(result.invoice.payment.iban, "LV79HABA0001408050996");
  assert.equal(result.invoice.lines[0].quantity, "10.292");
  assert.equal(result.invoice.lines[0].unit, "MTQ");
  assert.equal(result.invoice.lines[0].taxCategory, "AE");
});

test("atmet nederīgus datumus un nepilnīgas rindas", () => {
  const input = extracted();
  input.issueDate = "2026-08-48";
  input.dueDate = "2026-02-30";
  input.lines.push({ description: "Nepilnīga", quantity: "", unit: "H87", unitPrice: "" });
  const result = normalizeVisionInvoice(input);
  assert.equal(result.invoice.issueDate, "");
  assert.equal(result.invoice.dueDate, "");
  assert.equal(result.invoice.lines.length, 1);
});

test("veido Responses API attēla un stingras shēmas pieprasījumu", () => {
  const request = buildVisionRequest("data:image/jpeg;base64,AA==");
  assert.equal(request.store, false);
  assert.equal(request.input[0].content[1].type, "input_image");
  assert.equal(request.input[0].content[1].detail, "high");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
});

test("veido Responses API PDF faila pieprasījumu", () => {
  const fileData = "data:application/pdf;base64,JVBERi0=";
  const request = buildVisionRequest(fileData, "application/pdf");
  const file = request.input[0].content[1];
  assert.equal(file.type, "input_file");
  assert.equal(file.filename, "invoice.pdf");
  assert.equal(file.file_data, fileData);
  assert.equal(file.detail, "high");
});

test("parsē strukturētu Responses API atbildi", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(extracted()) }] }] })
  });
  const result = await extractInvoiceWithVision("data:image/jpeg;base64,AA==", { apiKey: "test-key", fetchImpl });
  assert.equal(result.invoice.number, "KZ/26/0498");
  assert.equal(result.invoice.lines[0].unitPrice, "327.00");
});

test("bez API atslēgas atgriež lokālā OCR signālu", async () => {
  assert.equal(await extractInvoiceWithVision("data:image/jpeg;base64,AA==", { apiKey: "" }), null);
});
