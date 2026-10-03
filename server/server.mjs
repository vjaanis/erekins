import http from "node:http";
import { spawn } from "node:child_process";
import { extractInvoiceHints, parseDataUrl } from "./ocr-core.mjs";
import { extractInvoiceWithVision } from "./vision.mjs";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3107);
const maxBody = 12 * 1024 * 1024;
const attempts = new Map();

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
};

const limited = (address) => {
  const now = Date.now();
  const recent = (attempts.get(address) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  attempts.set(address, recent);
  return recent.length > 8;
};

const readBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > maxBody) {
      reject(new Error("Fails ir pārāk liels."));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  request.on("error", reject);
});

const runTesseract = (buffer) => new Promise((resolve, reject) => {
  const process = spawn("/usr/bin/tesseract", ["stdin", "stdout", "-l", "lav+eng", "--psm", "6"], {
    stdio: ["pipe", "pipe", "pipe"]
  });
  const output = [];
  const errors = [];
  const timer = setTimeout(() => process.kill("SIGKILL"), 30_000);
  process.stdout.on("data", (chunk) => output.push(chunk));
  process.stderr.on("data", (chunk) => errors.push(chunk));
  process.on("error", reject);
  process.on("close", (code, signal) => {
    clearTimeout(timer);
    if (signal) return reject(new Error("Attēla nolasīšana pārsniedza laika limitu."));
    if (code !== 0) return reject(new Error("Attēlu neizdevās nolasīt."));
    resolve(Buffer.concat(output).toString("utf8").trim());
  });
  process.stdin.end(buffer);
});

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return sendJson(response, 200, { status: "ok", vision: process.env.OPENAI_API_KEY ? "openai" : "local" });
  if (request.method !== "POST" || request.url !== "/ocr") return sendJson(response, 404, { error: "Adrese nav atrasta." });
  const clientAddress = String(request.headers["x-real-ip"] || request.socket.remoteAddress || "unknown");
  if (limited(clientAddress)) return sendJson(response, 429, { error: "Pārāk daudz pieprasījumu. Mēģini vēlreiz pēc minūtes." });
  if (!String(request.headers["content-type"] || "").startsWith("application/json")) return sendJson(response, 415, { error: "Nepareizs pieprasījuma formāts." });

  try {
    const body = JSON.parse(await readBody(request));
    const fileData = body.file || body.image;
    const { buffer, mimeType } = parseDataUrl(fileData);
    try {
      const vision = await extractInvoiceWithVision(fileData, { mimeType });
      if (vision) return sendJson(response, 200, {
        ...vision,
        engine: "openai",
        warning: ["Redzes modeļa rezultāts var saturēt kļūdas. Pirms eksporta pārbaudi visus laukus.", ...vision.warnings].join(" ")
      });
    } catch (visionError) {
      console.error(`Dokumentu redzes modelis nav pieejams: ${visionError.message}`);
    }
    if (mimeType === "application/pdf") {
      return sendJson(response, 503, { error: "PDF nolasīšanai dokumentu redzes modelis pašlaik nav pieejams. Mēģini vēlreiz pēc brīža." });
    }
    const text = await runTesseract(buffer);
    if (!text) return sendJson(response, 422, { error: "Attēlā neizdevās atrast salasāmu tekstu." });
    sendJson(response, 200, {
      invoice: extractInvoiceHints(text),
      text: text.slice(0, 20_000),
      engine: "local",
      warning: process.env.OPENAI_API_KEY
        ? "Precīzā dokumentu nolasīšana nebija pieejama; izmantots lokālais OCR. Pārbaudi visus laukus."
        : "Izmantots lokālais OCR. Precīzākai nolasīšanai serverī jākonfigurē jauna OpenAI API atslēga."
    });
  } catch (error) {
    const clientError = error instanceof SyntaxError || /Atļauti|Failam|Faila saturs|pārāk liels/.test(error.message);
    sendJson(response, clientError ? 400 : 500, { error: clientError ? error.message : "OCR apstrāde neizdevās. Mēģini ar skaidrāku dokumentu." });
  }
});

server.listen(port, host, () => console.log(`E-rēķins OCR klausās ${host}:${port}`));
