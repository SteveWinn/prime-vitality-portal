/**
 * LabCorp PDF Parser
 * Extracts TRT-relevant blood markers from LabCorp PDF reports.
 * Handles the standard LabCorp format: "TestName  value  [High/Low]  prevValue  date  units  refInterval"
 */

// Key TRT markers to extract — maps common LabCorp label variants to a canonical name
const MARKER_MAP: Array<{ canonical: string; patterns: RegExp[]; unit: string }> = [
  {
    canonical: "Testosterone (Total)",
    patterns: [/Testosterone\s*01\s+([\d.]+)/i, /^Testosterone\s+([\d.]+)/im],
    unit: "ng/dL",
  },
  {
    canonical: "Free Testosterone",
    patterns: [/Testost\.,?\s*Free,?\s*Calc\s+([\d.]+)/i, /Free Testosterone\s+([\d.]+)/i],
    unit: "pg/mL",
  },
  {
    canonical: "Estradiol",
    patterns: [/Estradiol\s*01\s+([\d.]+)/i, /^Estradiol\s+([\d.]+)/im],
    unit: "pg/mL",
  },
  {
    canonical: "Hematocrit",
    patterns: [/Hematocrit\s*01\s+([\d.]+)/i, /^Hematocrit\s+([\d.]+)/im],
    unit: "%",
  },
  {
    canonical: "Hemoglobin",
    patterns: [/Hemoglobin\s*01\s+([\d.]+)/i, /^Hemoglobin\s+([\d.]+)/im],
    unit: "g/dL",
  },
  {
    canonical: "PSA",
    patterns: [/Prostate Specific Ag\s*01\s+([\d.]+)/i, /PSA\s+([\d.]+)/i],
    unit: "ng/mL",
  },
  {
    canonical: "SHBG",
    patterns: [/Sex Horm Binding Glob[^0-9]*\s+([\d.]+)/i, /SHBG\s+([\d.]+)/i],
    unit: "nmol/L",
  },
  {
    canonical: "RBC",
    patterns: [/^RBC\s*01\s+([\d.]+)/im, /^RBC\s+([\d.]+)/im],
    unit: "x10E6/uL",
  },
  {
    canonical: "WBC",
    patterns: [/^WBC\s*01\s+([\d.]+)/im, /^WBC\s+([\d.]+)/im],
    unit: "x10E3/uL",
  },
  {
    canonical: "Albumin",
    patterns: [/^Albumin\s*01\s+([\d.]+)/im, /^Albumin\s+([\d.]+)/im],
    unit: "g/dL",
  },
  {
    canonical: "LH",
    patterns: [/^LH\s*01\s+([\d.]+)/im, /Luteinizing Hormone\s+([\d.]+)/i],
    unit: "mIU/mL",
  },
  {
    canonical: "FSH",
    patterns: [/^FSH\s*01\s+([\d.]+)/im, /Follicle Stimulating\s+([\d.]+)/i],
    unit: "mIU/mL",
  },
  {
    canonical: "Prolactin",
    patterns: [/^Prolactin\s*01\s+([\d.]+)/im, /^Prolactin\s+([\d.]+)/im],
    unit: "ng/mL",
  },
  {
    canonical: "Thyroid (TSH)",
    patterns: [/TSH\s*01\s+([\d.]+)/i, /Thyroid Stim\s*\S*\s+([\d.]+)/i],
    unit: "uIU/mL",
  },
  {
    canonical: "Vitamin D",
    patterns: [/Vitamin D,?\s*25\s*[\w-]*\s+([\d.]+)/i],
    unit: "ng/mL",
  },
];

// Reference ranges for flagging high/low
const REFERENCE_RANGES: Record<string, { low: number; high: number }> = {
  "Testosterone (Total)": { low: 264, high: 916 },
  "Free Testosterone": { low: 30.3, high: 183.2 },
  "Estradiol": { low: 7.6, high: 42.6 },
  "Hematocrit": { low: 37.5, high: 51.0 },
  "Hemoglobin": { low: 13.0, high: 17.7 },
  "PSA": { low: 0, high: 4.0 },
  "SHBG": { low: 16.5, high: 55.9 },
  "RBC": { low: 4.14, high: 5.80 },
  "WBC": { low: 3.4, high: 10.8 },
};

export interface ParsedMarker {
  name: string;
  value: number;
  unit: string;
  flag: "High" | "Low" | "Normal" | null;
  refRange?: { low: number; high: number };
}

export interface ParsedLabReport {
  patientName?: string;
  dateCollected?: string;
  specimenId?: string;
  markers: ParsedMarker[];
  rawText: string;
}

export function parseLabCorpPdf(text: string): ParsedLabReport {
  const result: ParsedLabReport = {
    markers: [],
    rawText: text,
  };

  // Extract patient metadata
  const nameMatch = text.match(/^([A-Z][a-z]+,\s*[A-Z][a-z]+)/m);
  if (nameMatch) result.patientName = nameMatch[1];

  const dateMatch = text.match(/Date Collected:\s*(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) result.dateCollected = dateMatch[1];

  const specMatch = text.match(/Specimen ID:\s*([\w-]+)/);
  if (specMatch) result.specimenId = specMatch[1];

  // Extract each marker
  for (const marker of MARKER_MAP) {
    for (const pattern of marker.patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          // Determine flag
          let flag: ParsedMarker["flag"] = null;
          const ref = REFERENCE_RANGES[marker.canonical];
          if (ref) {
            if (value > ref.high) flag = "High";
            else if (value < ref.low) flag = "Low";
            else flag = "Normal";
          }
          // Also check raw text for "High"/"Low" near the marker
          const vicinity = text.substring(Math.max(0, text.search(pattern)), text.search(pattern) + 200);
          if (!flag) {
            if (/\bHigh\b/i.test(vicinity)) flag = "High";
            else if (/\bLow\b/i.test(vicinity)) flag = "Low";
          }

          result.markers.push({
            name: marker.canonical,
            value,
            unit: marker.unit,
            flag,
            refRange: ref,
          });
          break; // Stop at first matching pattern
        }
      }
    }
  }

  return result;
}

/**
 * Convert parsed markers to the JSON string stored in the DB results field
 */
export function markersToResultsJson(markers: ParsedMarker[]): string {
  const obj: Record<string, string> = {};
  for (const m of markers) {
    const flagStr = m.flag && m.flag !== "Normal" ? ` (${m.flag})` : "";
    obj[`${m.name} (${m.unit})`] = `${m.value}${flagStr}`;
  }
  return JSON.stringify(obj);
}
