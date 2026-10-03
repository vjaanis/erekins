(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InvoiceCore = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCALE = 1000000n;
  const CUSTOMIZATION_ID = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0";
  const PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

  const roundDivide = (numerator, denominator) => {
    if (denominator === 0n) throw new Error("Dalīšana ar nulli nav atļauta.");
    const sign = numerator < 0n ? -1n : 1n;
    const absolute = numerator < 0n ? -numerator : numerator;
    return sign * ((absolute + denominator / 2n) / denominator);
  };

  const toScaled = (value) => {
    const normalized = String(value ?? "").trim().replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error("Vērtībai jābūt pozitīvam skaitlim.");
    const [whole, fraction = ""] = normalized.split(".");
    const padded = `${fraction}0000000`;
    let result = BigInt(whole) * SCALE + BigInt(padded.slice(0, 6));
    if (Number(padded[6]) >= 5) result += 1n;
    return result;
  };

  const centsFromMoney = (value) => roundDivide(toScaled(value || "0") * 100n, SCALE);

  const centsFromLine = (quantity, unitPrice, discount = "0", charge = "0") => {
    const quantityScaled = toScaled(quantity);
    const priceScaled = toScaled(unitPrice);
    return roundDivide(quantityScaled * priceScaled * 100n, SCALE * SCALE)
      - centsFromMoney(discount)
      + centsFromMoney(charge);
  };

  const centsFromTax = (taxableCents, rate) => {
    const rateScaled = toScaled(rate);
    return roundDivide(taxableCents * rateScaled, 100n * SCALE);
  };

  const decimalFromCents = (cents) => {
    const value = BigInt(cents);
    const sign = value < 0n ? "-" : "";
    const absolute = value < 0n ? -value : value;
    return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
  };

  const formatMoney = (cents, locale = "lv-LV") => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR"
  }).format(Number(cents) / 100);

  const taxKey = (line) => `${line.taxCategory || "S"}:${line.vatRate}`;

  const calculateInvoice = (lines) => {
    const groups = new Map();
    const calculatedLines = lines.map((line, index) => {
      const lineCents = centsFromLine(line.quantity, line.unitPrice, line.discount, line.charge);
      if (lineCents < 0n) throw new Error("Pozīcijas summa pēc atlaides nevar būt negatīva.");
      const key = taxKey(line);
      const current = groups.get(key) || {
        category: line.taxCategory || "S",
        rate: String(line.vatRate),
        taxableCents: 0n,
        taxCents: 0n
      };
      current.taxableCents += lineCents;
      groups.set(key, current);
      return { ...line, index, lineCents };
    });

    let subtotalCents = 0n;
    let taxCents = 0n;
    const taxGroups = [...groups.values()].map((group) => {
      group.taxCents = ["E", "O", "AE"].includes(group.category) ? 0n : centsFromTax(group.taxableCents, group.rate);
      subtotalCents += group.taxableCents;
      taxCents += group.taxCents;
      return group;
    });

    return {
      lines: calculatedLines,
      taxGroups,
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents
    };
  };

  const isValidIban = (value) => {
    const iban = String(value || "").replace(/\s+/g, "").toUpperCase();
    if (!/^LV\d{2}[A-Z0-9]{17}$/.test(iban)) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    const numeric = [...rearranged].map((char) => /\d/.test(char) ? char : String(char.charCodeAt(0) - 55)).join("");
    let remainder = 0;
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
    return remainder === 1;
  };

  const validateInvoice = (invoice) => {
    const errors = [];
    const required = (value, field, label) => {
      if (!String(value || "").trim()) errors.push({ field, message: `${label} ir obligāts lauks.` });
    };

    required(invoice.number, "invoice-number", "Rēķina numurs");
    required(invoice.issueDate, "issue-date", "Izrakstīšanas datums");
    required(invoice.dueDate, "due-date", "Apmaksas termiņš");
    required(invoice.buyerReference, "buyer-reference", "Pircēja atsauce");
    required(invoice.supplier?.name, "supplier-name", "Pārdevēja nosaukums");
    required(invoice.supplier?.regNo, "supplier-reg", "Pārdevēja reģistrācijas numurs");
    required(invoice.supplier?.address, "supplier-address", "Pārdevēja adrese");
    required(invoice.customer?.name, "customer-name", "Pircēja nosaukums");
    required(invoice.customer?.regNo, "customer-reg", "Pircēja reģistrācijas numurs");
    required(invoice.customer?.address, "customer-address", "Pircēja adrese");
    required(invoice.payment?.iban, "iban", "IBAN");

    if (invoice.issueDate && invoice.dueDate && invoice.dueDate < invoice.issueDate) {
      errors.push({ field: "due-date", message: "Apmaksas termiņš nevar būt pirms izrakstīšanas datuma." });
    }
    for (const party of [[invoice.supplier, "supplier"], [invoice.customer, "customer"]]) {
      if (party[0]?.regNo && !/^\d{11}$/.test(party[0].regNo)) {
        errors.push({ field: `${party[1]}-reg`, message: "Latvijas reģistrācijas numuram jābūt 11 cipariem." });
      }
    }
    if (invoice.payment?.iban && !isValidIban(invoice.payment.iban)) {
      errors.push({ field: "iban", message: "Ievadi derīgu Latvijas IBAN numuru." });
    }
    if (!Array.isArray(invoice.lines) || invoice.lines.length === 0) {
      errors.push({ field: "lines", message: "Pievieno vismaz vienu rēķina pozīciju." });
    } else {
      invoice.lines.forEach((line, index) => {
        if (!String(line.description || "").trim()) errors.push({ field: `line-${index}-description`, message: `${index + 1}. pozīcijai trūkst nosaukuma.` });
        try {
          if (toScaled(line.quantity) <= 0n) throw new Error();
        } catch {
          errors.push({ field: `line-${index}-quantity`, message: `${index + 1}. pozīcijas daudzumam jābūt lielākam par nulli.` });
        }
        try {
          toScaled(line.unitPrice);
        } catch {
          errors.push({ field: `line-${index}-price`, message: `${index + 1}. pozīcijas cenai jābūt derīgam skaitlim.` });
        }
        for (const adjustment of [["discount", "atlaidei"], ["charge", "piemaksai"]]) {
          try {
            toScaled(line[adjustment[0]] || "0");
          } catch {
            errors.push({ field: `line-${index}-${adjustment[0]}`, message: `${index + 1}. pozīcijas ${adjustment[1]} jābūt derīgam skaitlim.` });
          }
        }
        try {
          if (centsFromLine(line.quantity, line.unitPrice, line.discount, line.charge) < 0n) {
            errors.push({ field: `line-${index}-discount`, message: `${index + 1}. pozīcijas atlaide nevar pārsniegt rindas summu ar piemaksu.` });
          }
        } catch {
          // Atsevišķās lauku kļūdas jau ir pievienotas.
        }
        if (["E", "O", "AE"].includes(line.taxCategory) && !String(invoice.exemptionReason || "").trim()) {
          errors.push({ field: "exemption-reason", message: "Atbrīvotam darījumam norādi PVN atbrīvojuma pamatojumu." });
        }
      });
    }
    return errors;
  };

  const xmlEscape = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

  const partyXml = (role, party) => {
    const vat = party.vatNo ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${xmlEscape(party.vatNo.toUpperCase())}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>` : "";
    return `
  <cac:${role}>
    <cac:Party>
      <cbc:EndpointID schemeID="0218">${xmlEscape(party.regNo)}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID schemeID="0218">${xmlEscape(party.regNo)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${xmlEscape(party.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cac:AddressLine><cbc:Line>${xmlEscape(party.address)}</cbc:Line></cac:AddressLine>
        <cac:Country><cbc:IdentificationCode>LV</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${vat}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(party.name)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0218">${xmlEscape(party.regNo)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:${role}>`;
  };

  const buildUbl = (invoice) => {
    const errors = validateInvoice(invoice);
    if (errors.length) throw new Error(errors.map((error) => error.message).join(" "));
    const totals = calculateInvoice(invoice.lines);
    const currency = "EUR";
    const taxSubtotals = totals.taxGroups.map((group) => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${decimalFromCents(group.taxableCents)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${decimalFromCents(group.taxCents)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${xmlEscape(group.category)}</cbc:ID>
        <cbc:Percent>${xmlEscape(group.rate)}</cbc:Percent>${["E", "O", "AE"].includes(group.category) ? `
        <cbc:TaxExemptionReason>${xmlEscape(invoice.exemptionReason)}</cbc:TaxExemptionReason>` : ""}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`).join("");

    const lines = totals.lines.map((line, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${xmlEscape(line.unit || "H87")}">${xmlEscape(line.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${decimalFromCents(line.lineCents)}</cbc:LineExtensionAmount>${centsFromMoney(line.discount || "0") > 0n ? `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>Atlaide</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="${currency}">${decimalFromCents(centsFromMoney(line.discount))}</cbc:Amount>
    </cac:AllowanceCharge>` : ""}${centsFromMoney(line.charge || "0") > 0n ? `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>Piemaksa</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="${currency}">${decimalFromCents(centsFromMoney(line.charge))}</cbc:Amount>
    </cac:AllowanceCharge>` : ""}
    <cac:Item>
      <cbc:Name>${xmlEscape(line.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${xmlEscape(line.taxCategory || "S")}</cbc:ID>
        <cbc:Percent>${xmlEscape(line.vatRate)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${xmlEscape(line.unitPrice)}</cbc:PriceAmount>
      <cbc:BaseQuantity>1</cbc:BaseQuantity>
    </cac:Price>
  </cac:InvoiceLine>`).join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${xmlEscape(invoice.number)}</cbc:ID>
  <cbc:IssueDate>${xmlEscape(invoice.issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${xmlEscape(invoice.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${invoice.note ? `
  <cbc:Note>${xmlEscape(invoice.note)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xmlEscape(invoice.buyerReference)}</cbc:BuyerReference>${partyXml("AccountingSupplierParty", invoice.supplier)}${partyXml("AccountingCustomerParty", invoice.customer)}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>${xmlEscape(invoice.number)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${xmlEscape(invoice.payment.iban.replace(/\s+/g, "").toUpperCase())}</cbc:ID>${invoice.payment.bic ? `
      <cac:FinancialInstitutionBranch><cbc:ID>${xmlEscape(invoice.payment.bic.toUpperCase())}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${decimalFromCents(totals.taxCents)}</cbc:TaxAmount>${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${decimalFromCents(totals.subtotalCents)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${decimalFromCents(totals.subtotalCents)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${decimalFromCents(totals.totalCents)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${currency}">${decimalFromCents(totals.totalCents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
  };

  return {
    CUSTOMIZATION_ID,
    PROFILE_ID,
    buildUbl,
    calculateInvoice,
    centsFromLine,
    decimalFromCents,
    formatMoney,
    isValidIban,
    validateInvoice
  };
}));
