const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/js/invoice-core.js");

const validInvoice = () => ({
  number: "REK-2026-001",
  issueDate: "2026-09-28",
  dueDate: "2026-10-12",
  buyerReference: "LIGUMS-1",
  note: "Paldies par sadarbību.",
  exemptionReason: "",
  supplier: {
    name: "SIA Pārdevējs",
    regNo: "40103512178",
    address: "Rīga, Latvija",
    vatNo: "LV40103512178"
  },
  customer: {
    name: "SIA Pircējs",
    regNo: "40103632832",
    address: "Valka, Latvija",
    vatNo: "LV40103632832"
  },
  payment: { iban: "LV64UNLA0050018532131", bic: "UNLALV2X" },
  lines: [
    { description: "Pakalpojums", quantity: "2", unit: "H87", unitPrice: "12.50", taxCategory: "S", vatRate: "21" }
  ]
});

test("aprēķina rindas summu centos bez peldošā komata kļūdas", () => {
  assert.equal(core.centsFromLine("3", "0.10"), 30n);
  assert.equal(core.centsFromLine("1.5", "12.34"), 1851n);
  assert.equal(core.centsFromLine("2", "10.00", "1.50", "0.25"), 1875n);
});

test("aprēķina pamatsummu, PVN un kopsummu", () => {
  const result = core.calculateInvoice(validInvoice().lines);
  assert.equal(result.subtotalCents, 2500n);
  assert.equal(result.taxCents, 525n);
  assert.equal(result.totalCents, 3025n);
});

test("grupē dažādas PVN likmes", () => {
  const lines = [
    { quantity: "1", unitPrice: "100", taxCategory: "S", vatRate: "21" },
    { quantity: "1", unitPrice: "50", taxCategory: "S", vatRate: "12" },
    { quantity: "2", unitPrice: "10", taxCategory: "Z", vatRate: "0" }
  ];
  const result = core.calculateInvoice(lines);
  assert.equal(result.taxGroups.length, 3);
  assert.equal(result.subtotalCents, 17000n);
  assert.equal(result.taxCents, 2700n);
  assert.equal(result.totalCents, 19700n);
});

test("atbrīvotam darījumam neaprēķina PVN", () => {
  const result = core.calculateInvoice([
    { quantity: "1", unitPrice: "99.99", taxCategory: "E", vatRate: "0" }
  ]);
  assert.equal(result.taxCents, 0n);
});

test("apgrieztajai maksāšanai neaprēķina PVN", () => {
  const result = core.calculateInvoice([
    { quantity: "10.292", unitPrice: "327", taxCategory: "AE", vatRate: "21" }
  ]);
  assert.equal(result.subtotalCents, 336548n);
  assert.equal(result.taxCents, 0n);
  assert.equal(result.totalCents, 336548n);
});

test("pārbauda Latvijas IBAN kontrolsummu", () => {
  assert.equal(core.isValidIban("LV64 UNLA 0050 0185 3213 1"), true);
  assert.equal(core.isValidIban("LV00UNLA0050018532131"), false);
});

test("derīgam rēķinam nav lokālās validācijas kļūdu", () => {
  assert.deepEqual(core.validateInvoice(validInvoice()), []);
});

test("atrod obligātos laukus un nepareizu datumu", () => {
  const invoice = validInvoice();
  invoice.number = "";
  invoice.dueDate = "2026-09-01";
  const errors = core.validateInvoice(invoice);
  assert.ok(errors.some((error) => error.field === "invoice-number"));
  assert.ok(errors.some((error) => error.field === "due-date"));
});

test("atbrīvotam darījumam pieprasa pamatojumu", () => {
  const invoice = validInvoice();
  invoice.lines[0].taxCategory = "E";
  invoice.lines[0].vatRate = "0";
  assert.ok(core.validateInvoice(invoice).some((error) => error.field === "exemption-reason"));
});

test("darījumam ārpus PVN tvēruma pieprasa pamatojumu", () => {
  const invoice = validInvoice();
  invoice.lines[0].taxCategory = "O";
  invoice.lines[0].vatRate = "0";
  assert.ok(core.validateInvoice(invoice).some((error) => error.field === "exemption-reason"));
});

test("apgrieztajai maksāšanai pieprasa pamatojumu", () => {
  const invoice = validInvoice();
  invoice.lines[0].taxCategory = "AE";
  assert.ok(core.validateInvoice(invoice).some((error) => error.field === "exemption-reason"));
});

test("ģenerē UBL 2.1 rēķina pamatstruktūru", () => {
  const xml = core.buildUbl(validInvoice());
  assert.match(xml, /<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"/);
  assert.match(xml, /<cbc:InvoiceTypeCode>380<\/cbc:InvoiceTypeCode>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">30\.25<\/cbc:PayableAmount>/);
  assert.match(xml, /<cbc:ID>REK-2026-001<\/cbc:ID>/);
});

test("XML ģenerēšanā aizsargā teksta rakstzīmes", () => {
  const invoice = validInvoice();
  invoice.supplier.name = "A & B <SIA>";
  const xml = core.buildUbl(invoice);
  assert.match(xml, /A &amp; B &lt;SIA&gt;/);
  assert.doesNotMatch(xml, /A & B <SIA>/);
});

test("XML saglabā pozīcijas atlaidi un piemaksu", () => {
  const invoice = validInvoice();
  invoice.lines[0].discount = "2.00";
  invoice.lines[0].charge = "1.00";
  const xml = core.buildUbl(invoice);
  assert.match(xml, /<cbc:ChargeIndicator>false<\/cbc:ChargeIndicator>/);
  assert.match(xml, /<cbc:ChargeIndicator>true<\/cbc:ChargeIndicator>/);
  assert.match(xml, /<cbc:PayableAmount currencyID="EUR">29\.04<\/cbc:PayableAmount>/);
});
