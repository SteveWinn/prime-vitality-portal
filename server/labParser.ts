import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ParsedMarker {
  name: string;
  value: string;
  unit: string;
  flag: "High" | "Low" | "Critical" | null;
  refRange: string;
}

export interface ParsedLabReport {
  patientName?: string;
  dateCollected?: string;
  markers: ParsedMarker[];
}

// ─── EXTRACT TEXT ─────────────────────────────────────────────────────────────
function extractText(pdfBuffer: Buffer): string {
  const tmp = path.join(os.tmpdir(), `lab_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmp, pdfBuffer);
    // -layout preserves column spacing — critical for multi-column LabCorp reports
    const text = execSync(`pdftotext -layout "${tmp}" -`, { timeout: 15000 }).toString();
    return text;
  } catch {
    try {
      // fallback without -layout
      fs.writeFileSync(tmp, pdfBuffer);
      return execSync(`pdftotext "${tmp}" -`, { timeout: 15000 }).toString();
    } catch {
      return pdfBuffer.toString("latin1");
    }
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

// ─── MARKER DEFINITIONS ───────────────────────────────────────────────────────
// Each entry: label regex to match against each line, canonical name
const LABEL_MAP: Array<[RegExp, string]> = [
  [/^WBC\b/i,                             "WBC"],
  [/^RBC\b/i,                             "RBC"],
  [/^Hemoglobin\b/i,                      "Hemoglobin"],
  [/^Hematocrit\b/i,                      "Hematocrit"],
  [/^MCV\b/i,                             "MCV"],
  [/^MCH\b/i,                             "MCH"],
  [/^MCHC\b/i,                            "MCHC"],
  [/^RDW\b/i,                             "RDW"],
  [/^Platelets\b/i,                       "Platelets"],
  [/^Albumin\b/i,                         "Albumin"],
  [/^Testosterone\b/i,                    "Testosterone"],
  [/^Sex\s+Horm\s+Binding/i,              "SHBG"],
  [/^Serum\b/i,                             "SHBG"],  // "Serum 01" is the continuation of SHBG
  [/^Testost\.\s*Free\s*Calc/i,           "Free Testosterone"],
  [/^Testost\.,\s*Free,\s*Calc/i,         "Free Testosterone"],
  [/^Estradiol\b/i,                       "Estradiol"],
  [/^Prostate\s*Specific\s*Ag\b/i,        "PSA"],
  [/^Prostate-Specific\s*Ag\b/i,          "PSA"],
  [/^LH\b/i,                              "LH"],
  [/^FSH\b/i,                             "FSH"],
  [/^DHEA(-|\s*)Sulfate/i,               "DHEA-S"],
  [/^Cortisol\b/i,                        "Cortisol"],
  [/^Vitamin D/i,                         "Vitamin D"],
  [/^IGF-1\b/i,                           "IGF-1"],
  [/^TSH\b/i,                             "TSH"],
  [/^Ferritin\b/i,                        "Ferritin"],
  [/^Cholesterol,?\s*Total\b/i,           "Total Cholesterol"],
  [/^Triglycerides\b/i,                   "Triglycerides"],
  [/^HDL\s*Cholesterol/i,                "HDL"],
  [/^LDL\s*Chol/i,                       "LDL"],
];

const FLAG_WORDS = new Set(["high", "low", "critical", "abnormal", "h", "l"]);
const SKIP_LINES = new Set([
  "test", "current result and flag", "previous result and date",
  "units", "reference interval", "not estab.", "not estab",
]);

// ─── LAYOUT-AWARE PARSER ──────────────────────────────────────────────────────
// pdftotext -layout outputs columns separated by spaces.
// LabCorp rows look like:
//   "WBC 01                    6.6                8.5  01/07/2025   x10E3/uL   3.4-10.8"
// We parse each line looking for: label | value | [flag] | [prev] | [date] | unit | refrange

const NUM_RE = /^[\d.]+$/;
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const UNIT_RE = /^(ng\/dL|pg\/mL|nmol\/L|g\/dL|x10E\d+\/[a-zA-Z]+|%|mIU\/mL|IU\/L|ng\/mL|uIU\/mL|mmol\/L|mg\/dL|meq\/L|fL|pg|x10E3\/uL|x10E6\/uL|x10E9\/L|mU\/L|U\/L)$/i;
const REF_RE = /^[\d.]+-[\d.]+$/;
const LAB_CODE_RE = /^\d{2}$/;

function parseLayout(text: string): ParsedMarker[] {
  const found = new Map<string, ParsedMarker>();
  const rawLines = text.split("\n");

  // Pre-process: join wrapped rows where a label line has no value
  // e.g. "      RBC    01\n                    6.21  High..." → merged
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();
    if (!trimmed) { lines.push(line); continue; }
    // Check if this looks like a label-only line (label + maybe lab code, no numbers)
    const parts = line.split(/  +/).map(t => t.trim()).filter(Boolean);
    const hasNumericValue = parts.slice(1).some(t => NUM_RE.test(t) && !LAB_CODE_RE.test(t));
    if (!hasNumericValue && parts.length <= 2 && i + 1 < rawLines.length) {
      // Peek at next non-empty line
      const nextLine = rawLines[i + 1];
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed && NUM_RE.test(nextTrimmed.split(/\s+/)[0])) {
        // Merge: label line + value line
        lines.push(line.trimEnd() + "  " + nextLine.trim());
        i++; // skip next line
        continue;
      }
      // Also handle "Sex Horm Binding Glob," with continuation "Serum 01  18.3..."
      if (nextTrimmed && !NUM_RE.test(nextTrimmed.split(/\s+/)[0])) {
        // Could be a multi-word label continuation
        const merged = line.trimEnd() + " " + nextLine.trim();
        lines.push(merged);
        i++;
        continue;
      }
    }
    lines.push(line);
  }

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    // Tokenize: split on 2+ spaces to get columns
    const tokens = rawLine.split(/  +/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) continue;

    // First token is the label (possibly with lab code suffix like "01")
    const labelRaw = tokens[0].replace(/\s+\d{1,2}$/, "").trim();
    const lineLower = labelRaw.toLowerCase();

    if (SKIP_LINES.has(lineLower)) continue;

    // Match label
    let markerName: string | undefined;
    for (const [pattern, name] of LABEL_MAP) {
      if (pattern.test(labelRaw)) {
        markerName = name;
        break;
      }
    }

    if (!markerName || found.has(markerName)) continue;

    // Parse remaining tokens: value [flag] [prevValue] [date] [unit] [refRange]
    let value: string | undefined;
    let flag: ParsedMarker["flag"] = null;
    let unit = "";
    let refRange = "";
    let pastValue = false;

    for (let t = 1; t < tokens.length; t++) {
      const tok = tokens[t].trim();
      if (!tok) continue;
      if (LAB_CODE_RE.test(tok)) continue; // skip lab location codes
      if (SKIP_LINES.has(tok.toLowerCase())) continue;

      if (!value && NUM_RE.test(tok)) {
        value = tok;
        pastValue = false;
        continue;
      }

      if (value && !flag && FLAG_WORDS.has(tok.toLowerCase())) {
        flag = tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase() as ParsedMarker["flag"];
        pastValue = true;
        continue;
      }

      // Previous result value — skip the numeric right after flag (or right after value if no flag)
      if (value && NUM_RE.test(tok) && !pastValue) {
        pastValue = true; // this is the previous result, skip it
        continue;
      }

      // Date — skip
      if (DATE_RE.test(tok)) continue;

      // Unit
      if (value && !unit && UNIT_RE.test(tok)) {
        unit = tok;
        continue;
      }

      // Ref range
      if (value && !refRange && REF_RE.test(tok)) {
        refRange = tok;
        break;
      }
    }

    if (value) {
      found.set(markerName, { name: markerName, value, unit, flag, refRange });
    }
  }

  return Array.from(found.values());
}

// ─── MAIN PARSE FUNCTION ──────────────────────────────────────────────────────
export function parseLabCorpPdf(pdfBuffer: Buffer): ParsedLabReport {
  const text = extractText(pdfBuffer);
  const markers = parseLayout(text);

  const nameMatch = text.match(/^([A-Z][a-z]+,\s*[A-Z][a-z]+)/m);
  const patientName = nameMatch ? nameMatch[1] : undefined;

  const dateMatch = text.match(/Date Collected:\s*([\d\/]+)/i);
  const dateCollected = dateMatch ? dateMatch[1] : undefined;

  return { patientName, dateCollected, markers };
}

// ─── OUTPUT HELPERS ───────────────────────────────────────────────────────────
export function markersToResultsJson(markers: ParsedMarker[]): string {
  const obj: Record<string, string> = {};
  for (const m of markers) { obj[m.name] = m.value; }
  return JSON.stringify(obj);
}

export function markersToDisplayObject(markers: ParsedMarker[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const m of markers) {
    obj[m.name] = `${m.value}${m.unit ? " " + m.unit : ""}${m.flag ? " (" + m.flag + ")" : ""}`;
  }
  return obj;
}
