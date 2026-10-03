const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

const isoDate = (value) => {
  const text = clean(value);
  let match = text.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (match) return validIsoDate(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
  match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (!match) return "";
  return validIsoDate(`${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`);
};

const validIsoDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
};

const labeledValue = (lines, labels, valuePattern) => {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(?:${labelPattern})\\s*(?:nr\\.?|numurs)?\\s*[:#-]?\\s*(${valuePattern})`, "iu");
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) return clean(match[1]);
  }
  return "";
};

export const detectImageType = (buffer) => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "image/gif";
  return "";
};

export const detectDocumentType = (buffer) => {
  const imageType = detectImageType(buffer);
  if (imageType) return imageType;
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return "";
};

export const parseDataUrl = (value, maxBytes = 8 * 1024 * 1024) => {
  const match = String(value || "").match(/^data:(image\/(?:png|jpeg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Atļauti PDF, PNG, JPEG, WEBP un GIF faili.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxBytes) throw new Error("Failam jābūt mazākam par 8 MB.");
  const detectedType = detectDocumentType(buffer);
  if (!detectedType || detectedType !== match[1]) throw new Error("Faila saturs neatbilst norādītajam PDF vai attēla formātam.");
  return { buffer, mimeType: detectedType };
};

export const extractInvoiceHints = (text) => {
  const normalized = String(text || "").replace(/\r/g, "");
  const lines = normalized.split("\n").map(clean).filter(Boolean);
  const datePattern = "(?:\\d{4}[.\\/-]\\d{1,2}[.\\/-]\\d{1,2}|\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]\\d{4})";
  const issueRaw = labeledValue(lines, ["izrakstīšanas datums", "rēķina datums", "datums", "date"], datePattern);
  const dueRaw = labeledValue(lines, ["apmaksāt līdz", "apmaksas termiņš", "samaksas termiņš", "due date"], datePattern);
  const invoiceNumber = labeledValue(lines, ["rēķins", "rēķina", "invoice"], "[A-Z0-9][A-Z0-9._\\/-]{1,34}");
  const buyerReference = labeledValue(lines, ["pircēja atsauce", "atsauce", "pasūtījums", "reference"], "[^|;]{2,80}");
  const iban = lines
    .map((line) => line.toUpperCase().replace(/\s/g, ""))
    .map((line) => line.match(/LV\d{2}[A-Z]{4}[A-Z0-9]{13}/)?.[0] || "")
    .find(Boolean) || "";
  const vatNumbers = [...new Set((normalized.toUpperCase().match(/\bLV\d{11}\b/g) || []))];
  const registrationNumbers = [...new Set((normalized.match(/\b\d{11}\b/g) || []).filter((number) => !vatNumbers.some((vat) => vat.endsWith(number))))];

  return {
    number: invoiceNumber,
    buyerReference,
    issueDate: isoDate(issueRaw),
    dueDate: isoDate(dueRaw),
    supplier: { vatNo: vatNumbers[0] || "", regNo: vatNumbers[0]?.slice(2) || registrationNumbers[0] || "" },
    customer: { vatNo: vatNumbers[1] || "", regNo: vatNumbers[1]?.slice(2) || registrationNumbers[1] || "" },
    payment: { iban },
    lines: []
  };
};
