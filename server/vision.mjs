const MODEL = process.env.OPENAI_VISION_MODEL || "gpt-6-astra";

export const invoiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["number", "buyerReference", "issueDate", "dueDate", "paymentTermsDays", "note", "exemptionReason", "supplier", "customer", "payment", "lines", "rawText", "warnings"],
  properties: {
    number: { type: "string" },
    buyerReference: { type: "string" },
    issueDate: { type: "string" },
    dueDate: { type: "string" },
    paymentTermsDays: { type: "string" },
    note: { type: "string" },
    exemptionReason: { type: "string" },
    supplier: { $ref: "#/$defs/party" },
    customer: { $ref: "#/$defs/party" },
    payment: {
      type: "object",
      additionalProperties: false,
      required: ["iban", "bic"],
      properties: { iban: { type: "string" }, bic: { type: "string" } }
    },
    lines: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unit", "unitPrice", "discount", "charge", "taxCategory", "vatRate"],
        properties: {
          description: { type: "string" },
          quantity: { type: "string" },
          unit: { type: "string", enum: ["H87", "HUR", "DAY", "T3", "MTQ"] },
          unitPrice: { type: "string" },
          discount: { type: "string" },
          charge: { type: "string" },
          taxCategory: { type: "string", enum: ["S", "Z", "E", "O", "AE"] },
          vatRate: { type: "string" }
        }
      }
    },
    rawText: { type: "string" },
    warnings: { type: "array", maxItems: 20, items: { type: "string" } }
  },
  $defs: {
    party: {
      type: "object",
      additionalProperties: false,
      required: ["name", "regNo", "vatNo", "address"],
      properties: {
        name: { type: "string" },
        regNo: { type: "string" },
        vatNo: { type: "string" },
        address: { type: "string" }
      }
    }
  }
};

const prompt = `Nolasi rēķinu vai pavadzīmi no attēla un atgriez datus dotajā shēmā.
Dokuments var būt latviešu valodā, saturēt tabulas, zīmogus un rokraksta labojumus.

Noteikumi:
- Nekad neizdomā trūkstošus datus; neskaidram laukam atgriez tukšu virkni un pievieno brīdinājumu.
- Datumus atgriez tikai derīgā YYYY-MM-DD formātā. Ja rokraksta labojums nepārprotami aizstāj drukāto vērtību, izmanto laboto; ja nav skaidrs, atstāj tukšu.
- Atšķir pārdevēju/piegādātāju no pircēja/saņēmēja pēc dokumenta etiķetēm.
- RegNo ir reģistrācijas numurs bez LV prefiksa; vatNo ir PVN numurs ar prefiksu.
- Naudas un daudzuma vērtībām lieto punktu kā decimālatdalītāju, bez valūtas zīmes un tūkstošu atdalītājiem.
- Vienības: gabals=H87, stunda=HUR, diena=DAY, tūkstotis gabalu=T3, kubikmetrs/m³=MTQ.
- PVN kategorijas: standarta=S, nulles likme=Z, atbrīvots=E, ārpus PVN tvēruma=O, apgrieztā maksāšana=AE.
- Apgrieztajai maksāšanai lieto AE, dokumentā norādīto nominālo PVN likmi (ja redzama) un exemptionReason apraksti "Nodokļa apgrieztā maksāšana".
- Katru preču tabulas kopsavilkuma pozīciju atgriez vienu reizi. Ja vairākas partijas veido vienu preci ar vienādu cenu, drīksti tās apvienot kopējā daudzumā.
- unitPrice ir vienības cena bez PVN, nevis rindas kopsumma.
- paymentTermsDays satur tikai dienu skaitu, ja dokumentā tas skaidri norādīts.
- dueDate aizpildi, ja tas ir drukāts vai to var nepārprotami aprēķināt no derīga issueDate un paymentTermsDays.
- rawText ir salasāmo dokumenta tekstu strukturēta transkripcija; neiekļauj nesaprotamu simbolu virknes.
- Parakstus un personas rokrakstu neuzmini.`;

const validDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
};

const text = (value, max = 2000) => String(value ?? "").trim().slice(0, max);
const decimal = (value, fallback = "") => /^\d+(?:\.\d+)?$/.test(text(value, 40).replace(",", ".")) ? text(value, 40).replace(",", ".") : fallback;

export const normalizeVisionInvoice = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Redzes modeļa atbilde nav objekts.");
  const issueDate = validDate(input.issueDate);
  let dueDate = validDate(input.dueDate);
  const paymentTermsDays = /^\d{1,3}$/.test(text(input.paymentTermsDays, 3)) ? Number(input.paymentTermsDays) : null;
  if (!dueDate && issueDate && paymentTermsDays !== null) {
    const date = new Date(`${issueDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + paymentTermsDays);
    dueDate = date.toISOString().slice(0, 10);
  }
  const party = (value = {}) => ({
    name: text(value.name, 200),
    regNo: text(value.regNo, 30).replace(/\s/g, ""),
    vatNo: text(value.vatNo, 30).replace(/\s/g, "").toUpperCase(),
    address: text(value.address, 500)
  });
  const allowedUnits = new Set(["H87", "HUR", "DAY", "T3", "MTQ"]);
  const allowedTaxes = new Set(["S", "Z", "E", "O", "AE"]);
  const lines = Array.isArray(input.lines) ? input.lines.slice(0, 100).map((line = {}) => ({
    description: text(line.description, 200),
    quantity: decimal(line.quantity),
    unit: allowedUnits.has(line.unit) ? line.unit : "H87",
    unitPrice: decimal(line.unitPrice),
    discount: decimal(line.discount, "0.00"),
    charge: decimal(line.charge, "0.00"),
    taxCategory: allowedTaxes.has(line.taxCategory) ? line.taxCategory : "S",
    vatRate: decimal(line.vatRate, "0")
  })).filter((line) => line.description && line.quantity && line.unitPrice) : [];

  return {
    invoice: {
      number: text(input.number, 35),
      buyerReference: text(input.buyerReference, 200),
      issueDate,
      dueDate,
      note: text(input.note),
      exemptionReason: text(input.exemptionReason, 500),
      supplier: party(input.supplier),
      customer: party(input.customer),
      payment: { iban: text(input.payment?.iban, 34).replace(/\s/g, "").toUpperCase(), bic: text(input.payment?.bic, 20).replace(/\s/g, "").toUpperCase() },
      lines
    },
    text: text(input.rawText, 20_000),
    warnings: Array.isArray(input.warnings) ? input.warnings.slice(0, 20).map((warning) => text(warning, 300)).filter(Boolean) : []
  };
};

export const buildVisionRequest = (fileData, mimeType = "image/jpeg") => ({
  model: MODEL,
  store: false,
  max_output_tokens: 6000,
  input: [{
    role: "user",
    content: [
      { type: "input_text", text: prompt },
      mimeType === "application/pdf"
        ? { type: "input_file", filename: "invoice.pdf", file_data: fileData, detail: "high" }
        : { type: "input_image", image_url: fileData, detail: "high" }
    ]
  }],
  text: {
    format: {
      type: "json_schema",
      name: "invoice_extraction",
      strict: true,
      schema: invoiceSchema
    }
  }
});

const outputText = (response) => response?.output
  ?.flatMap((item) => item.type === "message" ? item.content || [] : [])
  .find((item) => item.type === "output_text")?.text;

export const extractInvoiceWithVision = async (fileData, { mimeType = "image/jpeg", apiKey = process.env.OPENAI_API_KEY, fetchImpl = fetch } = {}) => {
  if (!apiKey) return null;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildVisionRequest(fileData, mimeType)),
    signal: AbortSignal.timeout(75_000)
  });
  if (!response.ok) throw new Error(`OpenAI API atbildēja ar HTTP ${response.status}.`);
  const payload = await response.json();
  const result = outputText(payload);
  if (!result) throw new Error("OpenAI API neatgrieza strukturētu rezultātu.");
  return normalizeVisionInvoice(JSON.parse(result));
};
