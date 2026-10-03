(function () {
  "use strict";

  const core = window.InvoiceCore;
  if (!core) return;

  const form = document.querySelector("#invoice-form");
  const lineItems = document.querySelector("#line-items");
  const lineTemplate = document.querySelector("#line-template");
  const summary = document.querySelector("#validation-summary");
  const summaryList = document.querySelector("#validation-list");
  const status = document.querySelector("#form-status");
  const xmlFile = document.querySelector("#xml-file");
  const ocrFile = document.querySelector("#ocr-file");
  const ocrButton = document.querySelector("#ocr-button");
  const ocrStatus = document.querySelector("#ocr-status");
  let lineCounter = 0;

  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
  const clean = (value) => String(value || "").trim();
  const localDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const taxParts = (value) => {
    const [taxCategory, vatRate] = String(value || "S|21").split("|");
    return { taxCategory, vatRate };
  };

  const lineData = (line) => {
    const tax = taxParts(line.querySelector('[data-field="tax"]').value);
    return {
      description: clean(line.querySelector('[data-field="description"]').value),
      quantity: clean(line.querySelector('[data-field="quantity"]').value),
      unit: line.querySelector('[data-field="unit"]').value,
      unitPrice: clean(line.querySelector('[data-field="unitPrice"]').value),
      discount: clean(line.querySelector('[data-field="discount"]').value),
      charge: clean(line.querySelector('[data-field="charge"]').value),
      ...tax
    };
  };

  const getInvoice = () => ({
    number: clean(byId("invoice-number").value),
    buyerReference: clean(byId("buyer-reference").value),
    issueDate: byId("issue-date").value,
    dueDate: byId("due-date").value,
    note: clean(byId("invoice-note").value),
    exemptionReason: clean(byId("exemption-reason").value),
    supplier: {
      name: clean(byId("supplier-name").value),
      regNo: clean(byId("supplier-reg").value),
      vatNo: clean(byId("supplier-vat").value),
      address: clean(byId("supplier-address").value)
    },
    customer: {
      name: clean(byId("customer-name").value),
      regNo: clean(byId("customer-reg").value),
      vatNo: clean(byId("customer-vat").value),
      address: clean(byId("customer-address").value)
    },
    payment: {
      iban: clean(byId("iban").value),
      bic: clean(byId("bic").value)
    },
    lines: [...lineItems.querySelectorAll("[data-line]")].map(lineData)
  });

  const renumberLines = () => {
    [...lineItems.querySelectorAll("[data-line]")].forEach((line, index) => {
      line.querySelector("[data-line-title]").textContent = `Pozīcija ${index + 1}`;
      const fieldNames = ["description", "quantity", "unit", "unitPrice", "discount", "charge", "tax"];
      fieldNames.forEach((name) => {
        const input = line.querySelector(`[data-field="${name}"]`);
        const label = line.querySelector(`[data-label="${name}"]`);
        const normalized = name === "unitPrice" ? "price" : name;
        input.id = `line-${index}-${normalized}`;
        label.htmlFor = input.id;
      });
    });
  };

  const addLine = (data = {}) => {
    const fragment = lineTemplate.content.cloneNode(true);
    const line = fragment.querySelector("[data-line]");
    line.dataset.key = String(lineCounter++);
    line.querySelector('[data-field="description"]').value = data.description || "";
    line.querySelector('[data-field="quantity"]').value = data.quantity || "1";
    const unit = line.querySelector('[data-field="unit"]');
    const unitValue = data.unit || "H87";
    if (![...unit.options].some((option) => option.value === unitValue)) {
      const option = document.createElement("option");
      option.value = unitValue;
      option.textContent = unitValue;
      unit.append(option);
    }
    unit.value = unitValue;
    line.querySelector('[data-field="unitPrice"]').value = data.unitPrice || "0.00";
    line.querySelector('[data-field="discount"]').value = data.discount || "0.00";
    line.querySelector('[data-field="charge"]').value = data.charge || "0.00";
    const tax = line.querySelector('[data-field="tax"]');
    const taxValue = `${data.taxCategory || "S"}|${data.vatRate ?? "21"}`;
    if (![...tax.options].some((option) => option.value === taxValue)) {
      const option = document.createElement("option");
      option.value = taxValue;
      option.textContent = `${data.vatRate ?? "0"}% (${data.taxCategory || "S"})`;
      tax.append(option);
    }
    tax.value = taxValue;

    line.querySelector("[data-remove-line]").addEventListener("click", () => {
      if (lineItems.querySelectorAll("[data-line]").length === 1) {
        status.textContent = "Rēķinā jāpaliek vismaz vienai pozīcijai.";
        return;
      }
      line.remove();
      renumberLines();
      refresh();
    });
    lineItems.append(fragment);
    renumberLines();
    refresh();
  };

  const updateExemption = (invoice) => {
    const needsReason = invoice.lines.some((line) => ["E", "O", "AE"].includes(line.taxCategory));
    const wrap = byId("exemption-wrap");
    const field = byId("exemption-reason");
    wrap.classList.toggle("d-none", !needsReason);
    field.required = needsReason;
    field.disabled = !needsReason;
  };

  const appendCell = (row, value, className = "") => {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
  };

  const renderPreview = (invoice) => {
    setText("preview-number", invoice.number || "—");
    setText("preview-issue-date", invoice.issueDate || "—");
    setText("preview-due-date", invoice.dueDate || "—");
    setText("preview-supplier-name", invoice.supplier.name || "Nav norādīts");
    setText("preview-customer-name", invoice.customer.name || "Nav norādīts");
    setText("preview-supplier-details", [invoice.supplier.regNo && `Reģ. Nr. ${invoice.supplier.regNo}`, invoice.supplier.vatNo && `PVN ${invoice.supplier.vatNo}`, invoice.supplier.address].filter(Boolean).join("\n") || "—");
    setText("preview-customer-details", [invoice.customer.regNo && `Reģ. Nr. ${invoice.customer.regNo}`, invoice.customer.vatNo && `PVN ${invoice.customer.vatNo}`, invoice.customer.address].filter(Boolean).join("\n") || "—");
    setText("preview-payment", [invoice.payment.iban, invoice.payment.bic].filter(Boolean).join(" · ") || "IBAN nav norādīts");
    setText("preview-note", invoice.note);
    setText("preview-reference", `Atsauce: ${invoice.buyerReference || "—"}`);

    const body = byId("preview-lines");
    body.replaceChildren();
    try {
      const totals = core.calculateInvoice(invoice.lines);
      totals.lines.forEach((line) => {
        const row = document.createElement("tr");
        appendCell(row, line.description || "Nenorādīta pozīcija");
        appendCell(row, `${line.quantity || "—"} ${line.unit || ""}`, "text-end");
        let price = "—";
        try { price = core.formatMoney(core.centsFromLine("1", line.unitPrice)); } catch { /* Atstāj tukšu priekšskatījumu nederīgai cenai. */ }
        appendCell(row, price, "text-end");
        appendCell(row, core.formatMoney(line.lineCents), "text-end");
        body.append(row);
      });
      setText("preview-subtotal", core.formatMoney(totals.subtotalCents));
      setText("preview-tax", core.formatMoney(totals.taxCents));
      setText("preview-total", core.formatMoney(totals.totalCents));
      [...lineItems.querySelectorAll("[data-line]")].forEach((line, index) => {
        setTextIn(line, "[data-line-total]", core.formatMoney(totals.lines[index].lineCents));
      });
    } catch {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "invoice-empty";
      cell.textContent = "Pabeidz pozīciju datus, lai redzētu summu.";
      row.append(cell);
      body.append(row);
      setText("preview-subtotal", "0,00 €");
      setText("preview-tax", "0,00 €");
      setText("preview-total", "0,00 €");
    }
  };

  const setTextIn = (parent, selector, value) => {
    const element = parent.querySelector(selector);
    if (element) element.textContent = value;
  };

  const refresh = () => {
    const invoice = getInvoice();
    updateExemption(invoice);
    renderPreview(invoice);
    byId("preview-state").textContent = core.validateInvoice(invoice).length ? "Melnraksts" : "Pamatpārbaude izturēta";
  };

  const clearValidation = () => {
    form.querySelectorAll(".is-invalid").forEach((field) => field.classList.remove("is-invalid"));
    summary.classList.add("d-none");
    summaryList.replaceChildren();
  };

  const showErrors = (errors) => {
    clearValidation();
    errors.forEach((error) => {
      const field = byId(error.field);
      if (field) field.classList.add("is-invalid");
      const item = document.createElement("li");
      if (field) {
        const link = document.createElement("a");
        link.href = `#${error.field}`;
        link.textContent = error.message;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          field.focus();
        });
        item.append(link);
      } else item.textContent = error.message;
      summaryList.append(item);
    });
    summary.classList.remove("d-none");
    summary.focus();
    status.textContent = `Atrastas ${errors.length} kļūdas.`;
  };

  const validate = () => {
    const invoice = getInvoice();
    const errors = core.validateInvoice(invoice);
    if (errors.length) {
      showErrors(errors);
      return null;
    }
    clearValidation();
    status.textContent = "Lokālā pamatpārbaude izturēta. Pirms iesniegšanas izmanto arī pilno PEPPOL validatoru.";
    return invoice;
  };

  const downloadXml = () => {
    const invoice = validate();
    if (!invoice) return;
    try {
      const xml = core.buildUbl(invoice);
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = invoice.number.replace(/[^a-zA-Z0-9._-]+/g, "-") || "e-rekins";
      link.href = url;
      link.download = `${safeName}.xml`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      status.textContent = "UBL XML fails sagatavots lejupielādei.";
    } catch (error) {
      status.textContent = `XML neizdevās izveidot: ${error.message}`;
    }
  };

  const directChild = (parent, localName) => parent ? [...parent.children].find((element) => element.localName === localName) || null : null;
  const directChildren = (parent, localName) => parent ? [...parent.children].filter((element) => element.localName === localName) : [];
  const nested = (parent, ...names) => names.reduce((current, name) => directChild(current, name), parent);
  const valueOf = (parent, ...names) => clean(nested(parent, ...names)?.textContent);

  const parseParty = (root, role) => {
    const party = nested(root, role, "Party");
    const taxScheme = nested(party, "PartyTaxScheme");
    const taxSchemeId = valueOf(taxScheme, "TaxScheme", "ID");
    return {
      name: valueOf(party, "PartyName", "Name") || valueOf(party, "PartyLegalEntity", "RegistrationName"),
      regNo: valueOf(party, "PartyLegalEntity", "CompanyID") || valueOf(party, "PartyIdentification", "ID"),
      vatNo: taxSchemeId === "VAT" ? valueOf(taxScheme, "CompanyID") : "",
      address: valueOf(party, "PostalAddress", "AddressLine", "Line")
    };
  };

  const parseUbl = (text) => {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("XML fails nav korekti noformēts.");
    const root = xml.documentElement;
    if (root.localName !== "Invoice") throw new Error("Fails nav UBL Invoice dokuments.");
    const customization = valueOf(root, "CustomizationID");
    if (!customization.includes("en16931")) throw new Error("XML nav atpazīta EN 16931 / PEPPOL struktūra.");
    const payment = directChild(root, "PaymentMeans");
    const lines = directChildren(root, "InvoiceLine").map((line) => {
      const quantity = directChild(line, "InvoicedQuantity");
      const adjustments = directChildren(line, "AllowanceCharge");
      const adjustmentAmount = (chargeIndicator) => adjustments
        .filter((adjustment) => valueOf(adjustment, "ChargeIndicator") === chargeIndicator)
        .reduce((sum, adjustment) => sum + Number(valueOf(adjustment, "Amount") || 0), 0);
      return {
        description: valueOf(line, "Item", "Name"),
        quantity: clean(quantity?.textContent) || "1",
        unit: quantity?.getAttribute("unitCode") || "H87",
        unitPrice: valueOf(line, "Price", "PriceAmount") || "0.00",
        discount: String(adjustmentAmount("false")),
        charge: String(adjustmentAmount("true")),
        taxCategory: valueOf(line, "Item", "ClassifiedTaxCategory", "ID") || "S",
        vatRate: valueOf(line, "Item", "ClassifiedTaxCategory", "Percent") || "0"
      };
    });
    return {
      number: valueOf(root, "ID"),
      issueDate: valueOf(root, "IssueDate"),
      dueDate: valueOf(root, "DueDate"),
      buyerReference: valueOf(root, "BuyerReference"),
      note: valueOf(root, "Note"),
      exemptionReason: valueOf(directChild(root, "TaxTotal"), "TaxSubtotal", "TaxCategory", "TaxExemptionReason"),
      supplier: parseParty(root, "AccountingSupplierParty"),
      customer: parseParty(root, "AccountingCustomerParty"),
      payment: {
        iban: valueOf(payment, "PayeeFinancialAccount", "ID"),
        bic: valueOf(payment, "PayeeFinancialAccount", "FinancialInstitutionBranch", "ID")
      },
      lines
    };
  };

  const setValue = (id, value) => { byId(id).value = value || ""; };
  const fillForm = (invoice) => {
    setValue("invoice-number", invoice.number);
    setValue("buyer-reference", invoice.buyerReference);
    setValue("issue-date", invoice.issueDate);
    setValue("due-date", invoice.dueDate);
    setValue("invoice-note", invoice.note);
    setValue("supplier-name", invoice.supplier?.name);
    setValue("supplier-reg", invoice.supplier?.regNo);
    setValue("supplier-vat", invoice.supplier?.vatNo);
    setValue("supplier-address", invoice.supplier?.address);
    setValue("customer-name", invoice.customer?.name);
    setValue("customer-reg", invoice.customer?.regNo);
    setValue("customer-vat", invoice.customer?.vatNo);
    setValue("customer-address", invoice.customer?.address);
    setValue("iban", invoice.payment?.iban);
    setValue("bic", invoice.payment?.bic);
    setValue("exemption-reason", invoice.exemptionReason);
    lineItems.replaceChildren();
    (invoice.lines?.length ? invoice.lines : [{}]).forEach(addLine);
    clearValidation();
    refresh();
  };

  const mergeNonEmpty = (current, imported) => ({
    ...current,
    ...Object.fromEntries(Object.entries(imported || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined)),
    supplier: { ...current.supplier, ...Object.fromEntries(Object.entries(imported?.supplier || {}).filter(([, value]) => value)) },
    customer: { ...current.customer, ...Object.fromEntries(Object.entries(imported?.customer || {}).filter(([, value]) => value)) },
    payment: { ...current.payment, ...Object.fromEntries(Object.entries(imported?.payment || {}).filter(([, value]) => value)) },
    lines: imported?.lines?.length ? imported.lines : current.lines
  });

  const fileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Dokumentu neizdevās atvērt.")));
    reader.readAsDataURL(file);
  });

  const showOcrStatus = (message, state = "") => {
    ocrStatus.textContent = message;
    ocrStatus.classList.remove("d-none", "is-error", "is-working");
    if (state) ocrStatus.classList.add(state);
  };

  const readInvoiceImage = async () => {
    const file = ocrFile.files?.[0];
    if (!file) {
      showOcrStatus("Vispirms izvēlies rēķina PDF vai attēlu.", "is-error");
      ocrFile.focus();
      return;
    }
    if (!/^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      showOcrStatus("Izvēlies PDF, PNG, JPEG, WEBP vai GIF failu, kas nav lielāks par 8 MB.", "is-error");
      return;
    }

    const documentKind = file.type === "application/pdf" ? "PDF" : "attēla";
    ocrButton.disabled = true;
    showOcrStatus(`Notiek ${documentKind} nolasīšana…`, "is-working");
    try {
      const response = await fetch("api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: await fileAsDataUrl(file) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "OCR apstrāde neizdevās.");
      fillForm(mergeNonEmpty(getInvoice(), result.invoice));
      byId("ocr-text").value = result.text || "";
      byId("ocr-result").classList.remove("d-none");
      const engine = result.engine === "openai" ? "Dokumentu redzes modelis" : "Lokālais OCR";
      showOcrStatus(`${engine} nolasīja dokumentu un aizpildīja atpazītos laukus. Pārbaudi tos pret oriģinālu.`);
      status.textContent = result.warning || "OCR dati ievietoti. Pārbaudi visus laukus.";
    } catch (error) {
      showOcrStatus(error.message, "is-error");
    } finally {
      ocrButton.disabled = false;
      ocrFile.value = "";
    }
  };

  const demoInvoice = () => ({
    number: "DEMO-2026-001",
    buyerReference: "PASUTIJUMS-42",
    issueDate: localDate(new Date()),
    dueDate: localDate(new Date(Date.now() + 14 * 86400000)),
    note: "Demonstrācijas rēķins — pirms izmantošanas aizstāj visus piemēra datus.",
    exemptionReason: "",
    supplier: { name: "SIA Parauga darbnīca", regNo: "40103512178", vatNo: "LV40103512178", address: "Parauga iela 1, Rīga, LV-1001" },
    customer: { name: "SIA Parauga klients", regNo: "40103632832", vatNo: "LV40103632832", address: "Klienta iela 2, Valka, LV-4701" },
    payment: { iban: "LV64UNLA0050018532131", bic: "UNLALV2X" },
    lines: [
      { description: "Konsultācijas pakalpojums", quantity: "2", unit: "HUR", unitPrice: "45.00", taxCategory: "S", vatRate: "21" },
      { description: "Dokumenta sagatavošana", quantity: "1", unit: "H87", unitPrice: "30.00", taxCategory: "S", vatRate: "21" }
    ]
  });

  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  byId("add-line").addEventListener("click", () => addLine());
  byId("validate-button").addEventListener("click", validate);
  byId("download-button").addEventListener("click", downloadXml);
  byId("print-button").addEventListener("click", () => { if (validate()) window.print(); });
  byId("demo-button").addEventListener("click", () => { fillForm(demoInvoice()); status.textContent = "Ievietoti demonstrācijas dati. Pirms izmantošanas tos aizstāj."; });
  ocrButton.addEventListener("click", readInvoiceImage);
  byId("reset-button").addEventListener("click", () => {
    if (!window.confirm("Vai dzēst visus pašlaik ievadītos datus?")) return;
    form.reset();
    const today = new Date();
    setValue("issue-date", localDate(today));
    setValue("due-date", localDate(new Date(today.getTime() + 14 * 86400000)));
    lineItems.replaceChildren();
    addLine();
    clearValidation();
    status.textContent = "Sākts jauns rēķins.";
  });

  xmlFile.addEventListener("change", async () => {
    const file = xmlFile.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      status.textContent = "XML fails ir lielāks par 5 MB.";
      return;
    }
    try {
      fillForm(parseUbl(await file.text()));
      status.textContent = `Fails “${file.name}” ielādēts. Pārbaudi importētos datus.`;
    } catch (error) {
      status.textContent = `Failu neizdevās ielādēt: ${error.message}`;
    } finally {
      xmlFile.value = "";
    }
  });

  const today = new Date();
  setValue("issue-date", localDate(today));
  setValue("due-date", localDate(new Date(today.getTime() + 14 * 86400000)));
  addLine();
}());
