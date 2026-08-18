import {
  addOnlineStorage,
  deleteOnlineStorage,
  extractOnlineStorageId,
  getAllOnlineStorages,
  resolveOnlineStorageAnalysisId,
  updateOnlineStorage,
  type OnlineStorage,
} from "@/api/onlineStorage";
import {
  addGlobalStorage,
  deleteGlobalStorage,
  extractGlobalStorageId,
  getAllGlobalStorages,
  getGlobalStorageById,
  resolveGlobalStorageAnalysisId,
  resolveGlobalStorageBaseAnalysisId,
  resolveGlobalStorageCompanyId,
  updateGlobalStorage,
  type GlobalStorage,
  type GlobalStoragePayload,
} from "@/api/globalStorage";
import { getAllAnalyses, updateAnalysis, type Analysis } from "@/api/analysis";
import { getStoredCompanyId, getStoredUser } from "@/api/session";
import { getCompanyById, type Company } from "@/api/company";

export type PdfTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  align?: "left" | "center" | "right";
};

export type PdfElementType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "text"
  | "image"
  | "table"
  | "dynamic";

/** Keys that resolve from order / patient / result / user at fill time */
export type PdfDynamicFieldKey =
  | "order_number"
  | "order_created_at"
  | "result_id"
  | "result_date"
  | "patient_full_name"
  | "patient_address"
  | "patient_birth_day"
  | "patient_registered_at"
  | "patient_phone"
  | "lab_doctor"
  | "lab_assistant"
  | "company_name"
  | "analysis_name"
  | "laboratory_name"
  | "company_header"
  | "company_header_address";

export type PdfDynamicFieldDef = {
  key: PdfDynamicFieldKey;
  /** Lotincha yorliq (PDF shablonda ko'rinadi) */
  label: string;
  /** Sample preview value in template editor */
  sample: string;
  hint: string;
  /** Default true — "Yorliq: qiymat". Header bloklari o'z matnini o'zi o'z ichiga oladi. */
  showLabelByDefault?: boolean;
  multiline?: boolean;
  defaultSize?: { width: number; height: number };
  defaultStyle?: PdfTextStyle;
};

export const DYNAMIC_FIELDS: PdfDynamicFieldDef[] = [
  {
    key: "order_number",
    label: "Mijoz tartib raqami",
    sample: "Raqam #",
    hint: "Buyurtma raqami",
  },
  {
    key: "order_created_at",
    label: "Murojaat",
    sample: "Sanasi/vaqti",
    hint: "Murojaat sanasi/vaqti",
  },
  {
    key: "result_id",
    label: "Natija ID",
    sample: "Raqam #",
    hint: "Result id",
  },
  {
    key: "patient_full_name",
    label: "Mijoz F.I.Sh.",
    sample: "Familiya Ismi Sharif",
    hint: "Bemor F.I.Sh.",
  },
  {
    key: "result_date",
    label: "Natija",
    sample: "Sanasi/vaqti",
    hint: "Natija sanasi/vaqti",
  },
  {
    key: "patient_address",
    label: "Yashash manzili",
    sample: "Manzil",
    hint: "Yashash manzili",
  },
  {
    key: "patient_birth_day",
    label: "Tug'ilgan sanasi",
    sample: "Sanasi/vaqti",
    hint: "Tug'ilgan sana",
  },
  {
    key: "patient_registered_at",
    label: "Ro'yxatdan o'tgan sana",
    sample: "Sanasi/vaqti",
    hint: "Mijoz ro'yxatga olingan sana",
  },
  {
    key: "patient_phone",
    label: "Telefon raqami",
    sample: "Raqam #",
    hint: "Telefon raqami",
  },
  {
    key: "lab_doctor",
    label: "Vrach laborant",
    sample: "Laborant / direktor",
    hint: "Laborant / direktor",
  },
  {
    key: "lab_assistant",
    label: "Laboratoriya assistenti",
    sample: "Assistent F.I.Sh.",
    hint: "Laboratoriya assistenti",
  },
  {
    key: "company_name",
    label: "Kompaniya nomi",
    sample: "Kompaniya nomi",
    hint: "Joriy kompaniya",
  },
  {
    key: "analysis_name",
    label: "Analiz",
    sample: "Analiz nomi",
    hint: "Analiz nomi",
  },
  {
    key: "laboratory_name",
    label: "Laboratoriya",
    sample: "Laboratoriya nomi",
    hint: "Laboratoriya nomi",
  },
  {
    key: "company_header",
    label: "Shablon usti",
    sample:
      "SANITARIYA-EPIDEMIOLOGIK OSOYISHTALIK VA JAMOAT SALOMATLIGI QO'MITASINING  ________ VILOYATI, ________ TUMANI BO'LIMI",
    hint: "Tashkilot viloyati va tumani",
    showLabelByDefault: false,
    multiline: true,
    defaultSize: { width: 540, height: 52 },
    defaultStyle: { bold: true, fontSize: 10, align: "center" },
  },
  {
    key: "company_header_address",
    label: "Shablon usti adress",
    sample: "__________, Telefon ________",
    hint: "Tashkilot manzili va telefon raqami",
    showLabelByDefault: false,
    defaultSize: { width: 540, height: 22 },
    defaultStyle: { fontSize: 10, align: "left" },
  },
];

export function getDynamicFieldDef(key: PdfDynamicFieldKey | null | undefined) {
  return DYNAMIC_FIELDS.find(f => f.key === key) ?? null;
}

/** Context used when filling a template for a real order/result */
export type PdfDynamicContext = {
  orderId?: number | null;
  orderCreatedAt?: string | null;
  resultId?: number | null;
  resultDate?: string | null;
  patientFullName?: string | null;
  patientAddress?: string | null;
  patientBirthDay?: string | null;
  patientRegisteredAt?: string | null;
  patientPhone?: string | null;
  labDoctor?: string | null;
  labAssistant?: string | null;
  companyName?: string | null;
  analysisName?: string | null;
  laboratoryName?: string | null;
  companyRegion?: string | null;
  companyDistrict?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyFax?: string | null;
  companyWebsite?: string | null;
  companyTelegram?: string | null;
};

export type PdfCompanyDynamicFields = Pick<
  PdfDynamicContext,
  | "companyName"
  | "companyRegion"
  | "companyDistrict"
  | "companyAddress"
  | "companyPhone"
  | "companyFax"
  | "companyWebsite"
  | "companyTelegram"
>;

export function formatPdfDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatPdfDate(iso?: string | null): string {
  if (!iso) return "";
  // Already DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}/.test(iso.trim())) return iso.trim().slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const COMPANY_HEADER_BLANK = "________";
const COMPANY_ADDRESS_BLANK = "__________";
const COMPANY_PHONE_BLANK = "________";

function unwrapCompany(raw: unknown): Company | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Company & { data?: unknown; company?: unknown };
  if (typeof obj.id === "number" && Number.isFinite(obj.id) && obj.id > 0) return obj;
  const nested = [obj.data, obj.company].find(
    item => item && typeof item === "object" && !Array.isArray(item) && "id" in (item as object),
  );
  return nested ? (nested as Company) : obj;
}

function pickCompanyString(obj: unknown, keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function companyFieldsFromRecord(company: Company | null | undefined): PdfCompanyDynamicFields {
  return {
    companyName: company?.name?.trim() || null,
    companyRegion: company?.region?.name?.trim() || null,
    companyDistrict: company?.district?.name?.trim() || null,
    companyAddress: company?.address?.trim() || null,
    companyPhone: pickCompanyString(company, ["phone", "telefon", "phone_number", "phoneNumber"]),
    companyFax: pickCompanyString(company, ["fax", "faks"]),
    companyWebsite: pickCompanyString(company, ["website", "web", "web_site", "webSite"]),
    companyTelegram: pickCompanyString(company, ["telegram", "telegram_channel", "telegramChannel", "tg"]),
  };
}

function formatNamedPlace(name: string | null | undefined, suffix: "VILOYATI" | "TUMANI"): string {
  const raw = (name ?? "").trim();
  if (!raw) return `${COMPANY_HEADER_BLANK} ${suffix}`;
  const upper = raw.replace(/\s+/g, " ").toUpperCase();
  if (suffix === "VILOYATI") {
    if (/\b(VILOYATI|VILOYAT|SHAHRI|SHAHAR)\b/.test(upper)) return upper;
    return `${upper} ${suffix}`;
  }
  if (/\b(TUMANI|TUMAN)\b/.test(upper)) return upper;
  return `${upper} ${suffix}`;
}

function contactOrBlank(value: string | null | undefined, blank: string): string {
  const t = (value ?? "").trim();
  return t || blank;
}

export function formatCompanyHeader(ctx: PdfDynamicContext): string {
  const region = formatNamedPlace(ctx.companyRegion, "VILOYATI");
  const district = formatNamedPlace(ctx.companyDistrict, "TUMANI");
  return `SANITARIYA-EPIDEMIOLOGIK OSOYISHTALIK VA JAMOAT SALOMATLIGI QO'MITASINING  ${region}, ${district} BO'LIMI`;
}

export function formatCompanyHeaderAddress(ctx: PdfDynamicContext): string {
  const address = contactOrBlank(ctx.companyAddress, COMPANY_ADDRESS_BLANK);
  const phone = contactOrBlank(ctx.companyPhone, COMPANY_PHONE_BLANK);
  return `${address}, Telefon ${phone}`;
}

function emptyCompanyDynamicFields(): PdfCompanyDynamicFields {
  return {
    companyName: null,
    companyRegion: null,
    companyDistrict: null,
    companyAddress: null,
    companyPhone: null,
    companyFax: null,
    companyWebsite: null,
    companyTelegram: null,
  };
}

/** localStorage `ses_company_id` → `/company/getby/:id` (nom, viloyat, tuman, manzil, telefon) */
export async function resolveStoredCompanyDynamic(
  companyIdOverride?: number | null,
): Promise<PdfCompanyDynamicFields> {
  const stored = getStoredUser()?.company;
  const fallback: PdfCompanyDynamicFields = {
    ...emptyCompanyDynamicFields(),
    companyName: stored?.name?.trim() || null,
    companyRegion: stored?.region?.name?.trim() || null,
    companyAddress: stored?.address?.trim() || null,
    companyPhone: stored?.phone?.trim() || null,
  };

  const companyId = companyIdOverride ?? getStoredCompanyId();
  if (companyId == null || companyId <= 0) return fallback;

  try {
    const company = unwrapCompany(await getCompanyById(companyId));
    const fromApi = companyFieldsFromRecord(company);
    return {
      companyName: fromApi.companyName || fallback.companyName,
      companyRegion: fromApi.companyRegion || fallback.companyRegion,
      companyDistrict: fromApi.companyDistrict || fallback.companyDistrict,
      companyAddress: fromApi.companyAddress || fallback.companyAddress,
      companyPhone: fromApi.companyPhone || fallback.companyPhone,
      companyFax: fromApi.companyFax || fallback.companyFax,
      companyWebsite: fromApi.companyWebsite || fallback.companyWebsite,
      companyTelegram: fromApi.companyTelegram || fallback.companyTelegram,
    };
  } catch {
    return fallback;
  }
}

/** localStorage `ses_company_id` → `/company/getby/:id` nomi */
export async function resolveStoredCompanyName(
  companyIdOverride?: number | null,
): Promise<string | null> {
  return (await resolveStoredCompanyDynamic(companyIdOverride)).companyName ?? null;
}

export function resolveDynamicValue(
  key: PdfDynamicFieldKey,
  ctx: PdfDynamicContext,
  forPreview = false,
): string {
  const def = getDynamicFieldDef(key);
  const sample = def?.sample ?? "…";

  const pick = (v: string | number | null | undefined) => {
    if (v == null || String(v).trim() === "") return forPreview ? sample : "—";
    return String(v).trim();
  };

  switch (key) {
    case "order_number":
      return pick(ctx.orderId);
    case "order_created_at":
      return pick(formatPdfDateTime(ctx.orderCreatedAt) || null);
    case "result_id":
      return pick(ctx.resultId);
    case "result_date":
      return pick(formatPdfDateTime(ctx.resultDate) || formatPdfDateTime(ctx.orderCreatedAt) || null);
    case "patient_full_name":
      return pick(ctx.patientFullName);
    case "patient_address":
      return pick(ctx.patientAddress);
    case "patient_birth_day":
      return pick(formatPdfDate(ctx.patientBirthDay) || null);
    case "patient_registered_at":
      return pick(formatPdfDate(ctx.patientRegisteredAt) || null);
    case "patient_phone":
      return pick(ctx.patientPhone);
    case "lab_doctor":
      return pick(ctx.labDoctor);
    case "lab_assistant":
      return pick(ctx.labAssistant);
    case "company_name":
      return pick(ctx.companyName);
    case "analysis_name":
      return pick(ctx.analysisName);
    case "laboratory_name":
      return pick(ctx.laboratoryName);
    case "company_header":
      return formatCompanyHeader(ctx);
    case "company_header_address":
      return formatCompanyHeaderAddress(ctx);
    default:
      return forPreview ? sample : "—";
  }
}

/** One cell in the editable table */
export type PdfCellValueMode = "static" | "dynamic";

export type PdfTableCell = {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  /** Hidden — covered by another cell's span */
  covered?: boolean;
  /**
   * static — faqat PDF shablon sahifasida tahrirlanadi
   * dynamic — Natijalar sahifasida to'ldiriladi / o'zgartiriladi
   */
  valueMode?: PdfCellValueMode;
};

export function normalizeCellValueMode(
  mode: PdfCellValueMode | null | undefined,
): PdfCellValueMode {
  return mode === "dynamic" ? "dynamic" : "static";
}

export function isDynamicCell(cell: Pick<PdfTableCell, "valueMode"> | null | undefined) {
  return normalizeCellValueMode(cell?.valueMode) === "dynamic";
}

/** Full editable table: header + body (manual), optional per-column widths */
export type PdfTableData = {
  cols: number;
  headerRows: number;
  headerCells: PdfTableCell[][];
  bodyRows: number;
  bodyCells: PdfTableCell[][];
  /** Relative column widths in %; length === cols; sum ≈ 100 */
  colWidths: number[];
};

/** Rectangular selection in header or body (Excel-like) */
export type PdfTableSelection = {
  section: "header" | "body";
  r1: number;
  c1: number;
  r2: number;
  c2: number;
};

export type PdfElement = {
  id: string;
  type: PdfElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  imageSrc?: string;
  /** Bind template table to an analysis (Results page matching) */
  analysisId?: number | null;
  analysisName?: string;
  /** Header + body grid drawn by user */
  tableData?: PdfTableData;
  dynamicKey?: PdfDynamicFieldKey | null;
  showDynamicLabel?: boolean;
  style: PdfTextStyle;
};

export type PdfTemplate = {
  id: string;
  name: string;
  elements: PdfElement[];
  updatedAt: string;
  createdAt: string;
  /** Backend `/onlinestorage` record id when persisted remotely */
  storageId?: number | null;
  /** Backend `/globalstorage` record id when persisted globally */
  globalStorageId?: number | null;
  /** Company that published this global template (if known) */
  companyId?: number | null;
  companyName?: string;
  /** Analysis this template belongs to (`/onlinestorage` analysis_id) */
  analysisId?: number | null;
  analysisName?: string;
  /** Global catalog analysis (`/globalstorage` baseanalysis_id) */
  baseAnalysisId?: number | null;
};

export const PDF_TEMPLATE_STORAGE_KEY = "ses-pdf-templates";
export const ACTIVE_PDF_TEMPLATE_KEY = "ses-pdf-active-template-id";

/** A4 at ~0.75 scale for on-screen preview (210×297 mm → px @ 96dpi * 0.75) */
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
export const A4_PREVIEW_SCALE = 0.72;
export const A4_PREVIEW_WIDTH = Math.round(A4_WIDTH * A4_PREVIEW_SCALE);
export const A4_PREVIEW_HEIGHT = Math.round(A4_HEIGHT * A4_PREVIEW_SCALE);
/** Soft cap for very long templates (keeps editor usable) */
export const PDF_MAX_PAGES = 10;
/** Top/bottom margin on each printed page (pt) so table splits aren't flush to edges */
export const PDF_PAGE_MARGIN = 44;

const MIN_TABLE_COLS = 1;
const MAX_TABLE_COLS = 12;
const MIN_HEADER_ROWS = 1;
const MAX_HEADER_ROWS = 6;
const MIN_BODY_ROWS = 0;
const MAX_BODY_ROWS = 80;
const MIN_COL_WIDTH_PCT = 5;

export function emptyTableCell(
  text = "",
  valueMode: PdfCellValueMode = "static",
): PdfTableCell {
  return { text, colSpan: 1, rowSpan: 1, covered: false, valueMode };
}

export function equalColWidths(cols: number): number[] {
  const c = Math.max(1, cols);
  const base = Math.floor((10000 / c)) / 100;
  const widths = Array.from({ length: c }, () => base);
  const sum = widths.reduce((a, b) => a + b, 0);
  widths[c - 1] = Math.round((widths[c - 1] + (100 - sum)) * 100) / 100;
  return widths;
}

export function normalizeColWidths(widths: number[] | null | undefined, cols: number): number[] {
  const c = Math.max(1, cols);
  if (!widths || widths.length === 0) return equalColWidths(c);
  const next = Array.from({ length: c }, (_, i) => {
    const v = Number(widths[i]);
    return Number.isFinite(v) && v > 0 ? v : 100 / c;
  });
  const sum = next.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equalColWidths(c);
  return next.map(w => Math.round((w / sum) * 10000) / 100);
}

/** Drag resize between col `leftCol` and `leftCol+1`; deltaPct is change to left column */
export function resizeAdjacentColWidths(
  widths: number[],
  leftCol: number,
  deltaPct: number,
): number[] {
  const next = [...widths];
  const rightCol = leftCol + 1;
  if (leftCol < 0 || rightCol >= next.length) return next;
  const left = next[leftCol];
  const right = next[rightCol];
  const pair = left + right;
  let newLeft = left + deltaPct;
  newLeft = Math.max(MIN_COL_WIDTH_PCT, Math.min(pair - MIN_COL_WIDTH_PCT, newLeft));
  next[leftCol] = Math.round(newLeft * 100) / 100;
  next[rightCol] = Math.round((pair - newLeft) * 100) / 100;
  return next;
}

export function setColWidthAt(data: PdfTableData, col: number, pct: number): PdfTableData {
  const prev = normalizeTableData(data);
  if (col < 0 || col >= prev.cols) return prev;
  const widths = [...prev.colWidths];
  const others = widths.reduce((s, w, i) => (i === col ? s : s + w), 0);
  const clamped = Math.max(
    MIN_COL_WIDTH_PCT,
    Math.min(100 - MIN_COL_WIDTH_PCT * (prev.cols - 1), Number(pct) || MIN_COL_WIDTH_PCT),
  );
  widths[col] = clamped;
  // Scale remaining columns to fill 100 - clamped
  const targetOthers = 100 - clamped;
  if (others > 0) {
    for (let i = 0; i < widths.length; i++) {
      if (i === col) continue;
      widths[i] = Math.round((widths[i] / others) * targetOthers * 100) / 100;
    }
  }
  return { ...prev, colWidths: normalizeColWidths(widths, prev.cols) };
}

function makeCellGrid(rows: number, cols: number, seed?: PdfTableCell[][]): PdfTableCell[][] {
  const out: PdfTableCell[][] = [];
  for (let i = 0; i < rows; i++) {
    const src = seed?.[i] ?? [];
    const row: PdfTableCell[] = [];
    for (let j = 0; j < cols; j++) {
      const cell = src[j];
      row.push({
        text: typeof cell?.text === "string" ? cell.text : "",
        colSpan: Math.max(1, Number(cell?.colSpan) || 1),
        rowSpan: Math.max(1, Number(cell?.rowSpan) || 1),
        covered: Boolean(cell?.covered),
        valueMode: normalizeCellValueMode(cell?.valueMode),
      });
    }
    out.push(row);
  }
  return out;
}

export function createEmptyTableData(cols = 4, headerRows = 1, bodyRows = 3): PdfTableData {
  const c = clampInt(cols, MIN_TABLE_COLS, MAX_TABLE_COLS);
  const hr = clampInt(headerRows, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const br = clampInt(bodyRows, MIN_BODY_ROWS, MAX_BODY_ROWS);
  const headerCells: PdfTableCell[][] = [];
  for (let i = 0; i < hr; i++) {
    const row: PdfTableCell[] = [];
    for (let j = 0; j < c; j++) {
      row.push(emptyTableCell(i === 0 && j === 0 ? "Ko'rsatkich" : ""));
    }
    headerCells.push(row);
  }
  const bodyCells = makeCellGrid(br, c);
  return {
    cols: c,
    headerRows: hr,
    headerCells,
    bodyRows: br,
    bodyCells,
    colWidths: equalColWidths(c),
  };
}

/** Body fill key: row index + column index */
export function bodyCellKey(row: number | string, col: number) {
  return `${row}:${col}`;
}

/** Header fill key for dynamic header cells on Results */
export function headerCellKey(row: number, col: number) {
  return `h:${row}:${col}`;
}

export function normalizeSelection(sel: PdfTableSelection): PdfTableSelection {
  return {
    section: sel.section === "body" ? "body" : "header",
    r1: Math.min(sel.r1, sel.r2),
    c1: Math.min(sel.c1, sel.c2),
    r2: Math.max(sel.r1, sel.r2),
    c2: Math.max(sel.c1, sel.c2),
  };
}

export function isInSelection(
  row: number,
  col: number,
  sel: PdfTableSelection | null | undefined,
): boolean {
  if (!sel) return false;
  const b = normalizeSelection(sel);
  return row >= b.r1 && row <= b.r2 && col >= b.c1 && col <= b.c2;
}

export function normalizeTableData(data?: PdfTableData | null): PdfTableData {
  // Migrate legacy full-grid format { rows, cells } and header-only templates
  const legacy = data as
    | (PdfTableData & { rows?: number; cells?: PdfTableCell[][] })
    | null
    | undefined;

  if (!legacy) return createEmptyTableData();

  let headerCells = legacy.headerCells;
  let headerRows = legacy.headerRows;
  let cols = legacy.cols;
  let bodyCells = legacy.bodyCells;
  let bodyRows = legacy.bodyRows;

  if ((!headerCells || headerCells.length === 0) && Array.isArray(legacy.cells)) {
    headerRows = 1;
    cols = legacy.cols || Math.max(...legacy.cells.map(r => r?.length ?? 0), 1);
    headerCells = [
      (legacy.cells[0] ?? []).map(c =>
        emptyTableCell(typeof c?.text === "string" ? c.text : ""),
      ),
    ];
    // Remaining legacy rows become body
    if (legacy.cells.length > 1) {
      bodyCells = legacy.cells.slice(1);
      bodyRows = bodyCells.length;
    }
  }

  if (!headerCells || headerCells.length === 0) return createEmptyTableData();

  const hr = clampInt(headerRows || headerCells.length, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const c = clampInt(
    cols || Math.max(...headerCells.map(r => r?.length ?? 0), 1),
    MIN_TABLE_COLS,
    MAX_TABLE_COLS,
  );

  const outHeader = makeCellGrid(hr, c, headerCells);

  // Legacy templates without body: start with 3 empty body rows
  const hasBody = Array.isArray(bodyCells);
  const br = clampInt(
    hasBody ? bodyRows ?? bodyCells!.length : 3,
    MIN_BODY_ROWS,
    MAX_BODY_ROWS,
  );
  const outBody = makeCellGrid(br, c, hasBody ? bodyCells : undefined);

  return {
    cols: c,
    headerRows: hr,
    headerCells: outHeader,
    bodyRows: br,
    bodyCells: outBody,
    colWidths: normalizeColWidths(legacy.colWidths, c),
  };
}

export function resizeTableCols(data: PdfTableData, nextCols: number): PdfTableData {
  const prev = normalizeTableData(data);
  const cols = clampInt(nextCols, MIN_TABLE_COLS, MAX_TABLE_COLS);
  const headerCells = makeCellGrid(prev.headerRows, cols, prev.headerCells);
  const bodyCells = makeCellGrid(prev.bodyRows, cols, prev.bodyCells);
  const colWidths =
    cols === prev.cols
      ? prev.colWidths
      : cols > prev.cols
        ? normalizeColWidths(
            [...prev.colWidths, ...Array.from({ length: cols - prev.cols }, () => 100 / cols)],
            cols,
          )
        : normalizeColWidths(prev.colWidths.slice(0, cols), cols);
  return sanitizeMerges({
    cols,
    headerRows: prev.headerRows,
    headerCells,
    bodyRows: prev.bodyRows,
    bodyCells,
    colWidths,
  });
}

export function resizeHeaderRows(data: PdfTableData, nextHeaderRows: number): PdfTableData {
  const prev = normalizeTableData(data);
  const hr = clampInt(nextHeaderRows, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const headerCells = makeCellGrid(hr, prev.cols, prev.headerCells);
  return sanitizeMerges({
    cols: prev.cols,
    headerRows: hr,
    headerCells,
    bodyRows: prev.bodyRows,
    bodyCells: prev.bodyCells.map(r => r.map(c => ({ ...c }))),
    colWidths: prev.colWidths,
  });
}

export function resizeBodyRows(data: PdfTableData, nextBodyRows: number): PdfTableData {
  const prev = normalizeTableData(data);
  const br = clampInt(nextBodyRows, MIN_BODY_ROWS, MAX_BODY_ROWS);
  return sanitizeMerges({
    cols: prev.cols,
    headerRows: prev.headerRows,
    headerCells: prev.headerCells.map(r => r.map(c => ({ ...c }))),
    bodyRows: br,
    bodyCells: makeCellGrid(br, prev.cols, prev.bodyCells),
    colWidths: [...prev.colWidths],
  });
}

export function updateHeaderCell(
  data: PdfTableData,
  row: number,
  col: number,
  patch: Partial<PdfTableCell>,
): PdfTableData {
  const next = normalizeTableData(data);
  if (row < 0 || col < 0 || row >= next.headerRows || col >= next.cols) return next;
  if (next.headerCells[row][col].covered) return next;
  const headerCells = next.headerCells.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? { ...c, ...patch } : { ...c })),
  );
  return { ...next, headerCells };
}

export function updateBodyCell(
  data: PdfTableData,
  row: number,
  col: number,
  patch: Partial<PdfTableCell>,
): PdfTableData {
  const next = normalizeTableData(data);
  if (row < 0 || col < 0 || row >= next.bodyRows || col >= next.cols) return next;
  if (next.bodyCells[row][col].covered) return next;
  const bodyCells = next.bodyCells.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? { ...c, ...patch } : { ...c })),
  );
  return { ...next, bodyCells };
}

export function updateColWidths(data: PdfTableData, colWidths: number[]): PdfTableData {
  const next = normalizeTableData(data);
  return { ...next, colWidths: normalizeColWidths(colWidths, next.cols) };
}

/** Find the master cell that covers (row,col) in header, or the cell itself */
export function findMergeMaster(
  data: PdfTableData,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const d = normalizeTableData(data);
  return findGridMergeMaster(d.headerCells, d.headerRows, d.cols, row, col);
}

export function findBodyMergeMaster(
  data: PdfTableData,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const d = normalizeTableData(data);
  return findGridMergeMaster(d.bodyCells, d.bodyRows, d.cols, row, col);
}

function findGridMergeMaster(
  cells: PdfTableCell[][],
  rows: number,
  cols: number,
  row: number,
  col: number,
): { row: number; col: number } | null {
  if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
  const cell = cells[row][col];
  if (!cell.covered) return { row, col };
  for (let r = 0; r <= row; r++) {
    for (let c = 0; c <= col; c++) {
      const m = cells[r][c];
      if (m.covered) continue;
      const rs = m.rowSpan ?? 1;
      const cs = m.colSpan ?? 1;
      if (r <= row && row < r + rs && c <= col && col < c + cs) {
        return { row: r, col: c };
      }
    }
  }
  return { row, col };
}

function clearHeaderMergeAt(data: PdfTableData, row: number, col: number): PdfTableData {
  const d = normalizeTableData(data);
  const master = findGridMergeMaster(d.headerCells, d.headerRows, d.cols, row, col);
  if (!master) return d;
  const m = d.headerCells[master.row][master.col];
  const rs = m.rowSpan ?? 1;
  const cs = m.colSpan ?? 1;
  const headerCells = d.headerCells.map(r => r.map(c => ({ ...c })));
  for (let r = master.row; r < master.row + rs && r < d.headerRows; r++) {
    for (let c = master.col; c < master.col + cs && c < d.cols; c++) {
      headerCells[r][c] = {
        ...headerCells[r][c],
        colSpan: 1,
        rowSpan: 1,
        covered: false,
      };
    }
  }
  return { ...d, headerCells };
}

function clearBodyMergeAt(data: PdfTableData, row: number, col: number): PdfTableData {
  const d = normalizeTableData(data);
  const master = findGridMergeMaster(d.bodyCells, d.bodyRows, d.cols, row, col);
  if (!master) return d;
  const m = d.bodyCells[master.row][master.col];
  const rs = m.rowSpan ?? 1;
  const cs = m.colSpan ?? 1;
  const bodyCells = d.bodyCells.map(r => r.map(c => ({ ...c })));
  for (let r = master.row; r < master.row + rs && r < d.bodyRows; r++) {
    for (let c = master.col; c < master.col + cs && c < d.cols; c++) {
      bodyCells[r][c] = {
        ...bodyCells[r][c],
        colSpan: 1,
        rowSpan: 1,
        covered: false,
      };
    }
  }
  return { ...d, bodyCells };
}

export function unmergeHeaderSelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection(sel);
  let next = normalizeTableData(data);
  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      next = clearHeaderMergeAt(next, r, c);
    }
  }
  return next;
}

export function unmergeBodySelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection({ ...sel, section: "body" });
  let next = normalizeTableData(data);
  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      next = clearBodyMergeAt(next, r, c);
    }
  }
  return next;
}

export function mergeHeaderSelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection({ ...sel, section: "header" });
  if (b.r1 === b.r2 && b.c1 === b.c2) return normalizeTableData(data);

  let next = unmergeHeaderSelection(data, b);
  const headerCells = next.headerCells.map(r => r.map(c => ({ ...c })));
  const master = headerCells[b.r1][b.c1];
  const text = master.text;
  const valueMode = normalizeCellValueMode(master.valueMode);
  const rowSpan = b.r2 - b.r1 + 1;
  const colSpan = b.c2 - b.c1 + 1;

  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      if (r === b.r1 && c === b.c1) {
        headerCells[r][c] = {
          text,
          colSpan,
          rowSpan,
          covered: false,
          valueMode,
        };
      } else {
        headerCells[r][c] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
          valueMode: "static",
        };
      }
    }
  }
  return { ...next, headerCells };
}

export function mergeBodySelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection({ ...sel, section: "body" });
  if (b.r1 === b.r2 && b.c1 === b.c2) return normalizeTableData(data);

  let next = unmergeBodySelection(data, b);
  const bodyCells = next.bodyCells.map(r => r.map(c => ({ ...c })));
  const master = bodyCells[b.r1][b.c1];
  const text = master.text;
  const valueMode = normalizeCellValueMode(master.valueMode);
  const rowSpan = b.r2 - b.r1 + 1;
  const colSpan = b.c2 - b.c1 + 1;

  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      if (r === b.r1 && c === b.c1) {
        bodyCells[r][c] = {
          text,
          colSpan,
          rowSpan,
          covered: false,
          valueMode,
        };
      } else {
        bodyCells[r][c] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
          valueMode: "static",
        };
      }
    }
  }
  return { ...next, bodyCells };
}

function sanitizeGridMerges(
  cells: PdfTableCell[][],
  rows: number,
  cols: number,
): PdfTableCell[][] {
  const masters: Array<{
    r: number;
    c: number;
    text: string;
    rs: number;
    cs: number;
    valueMode: PdfCellValueMode;
  }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r]?.[c];
      if (!cell || cell.covered) continue;
      const cs = Math.min(Math.max(1, cell.colSpan ?? 1), cols - c);
      const rs = Math.min(Math.max(1, cell.rowSpan ?? 1), rows - r);
      masters.push({
        r,
        c,
        text: cell.text,
        rs,
        cs,
        valueMode: normalizeCellValueMode(cell.valueMode),
      });
    }
  }

  const out = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = cells[r]?.[c];
      return emptyTableCell(
        cell?.covered ? "" : (cell?.text ?? ""),
        normalizeCellValueMode(cell?.valueMode),
      );
    }),
  );

  for (const m of masters) {
    out[m.r][m.c] = {
      text: m.text,
      colSpan: m.cs,
      rowSpan: m.rs,
      covered: false,
      valueMode: m.valueMode,
    };
    for (let rr = m.r; rr < m.r + m.rs; rr++) {
      for (let cc = m.c; cc < m.c + m.cs; cc++) {
        if (rr === m.r && cc === m.c) continue;
        out[rr][cc] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
          valueMode: "static",
        };
      }
    }
  }
  return out;
}

function sanitizeMerges(data: PdfTableData): PdfTableData {
  const d = normalizeTableData(data);
  return {
    ...d,
    headerCells: sanitizeGridMerges(d.headerCells, d.headerRows, d.cols),
    bodyCells: sanitizeGridMerges(d.bodyCells, d.bodyRows, d.cols),
    colWidths: [...d.colWidths],
  };
}

export function tableHeightForRows(headerRows: number, bodyRows: number, compact = false): number {
  const h = compact ? 20 : 26;
  const b = compact ? 18 : 24;
  return Math.max(80, headerRows * h + Math.max(bodyRows, 1) * b + 8);
}

/** Effective painted height of an element (tables grow with row count). */
export function getElementRenderHeight(el: PdfElement): number {
  if (el.type === "table") {
    const grid = normalizeTableData(el.tableData);
    return Math.max(el.height, tableHeightForRows(grid.headerRows, grid.bodyRows, true));
  }
  return el.height;
}

/** Lowest Y (A4 points) occupied by template content. */
export function getPdfContentBottom(template: PdfTemplate): number {
  let bottom = 0;
  for (const el of template.elements) {
    bottom = Math.max(bottom, el.y + getElementRenderHeight(el));
  }
  return bottom;
}

/** Content area height inside one A4 page (excludes top/bottom margins when enabled). */
export function getPdfUsablePageHeight(withMargins = false): number {
  if (!withMargins) return A4_HEIGHT;
  return Math.max(120, A4_HEIGHT - 2 * PDF_PAGE_MARGIN);
}

export function getPdfPageMarginPreview(): number {
  return PDF_PAGE_MARGIN * A4_PREVIEW_SCALE;
}

export function getPdfUsablePreviewHeight(withMargins = false): number {
  if (!withMargins) return A4_PREVIEW_HEIGHT;
  return A4_PREVIEW_HEIGHT - 2 * getPdfPageMarginPreview();
}

/**
 * How many A4 pages the template needs (at least 1).
 * withMargins=true — used for result preview/export so content doesn't touch page edges.
 */
export function getPdfPageCount(template: PdfTemplate, withMargins = false): number {
  const bottom = getPdfContentBottom(template);
  if (bottom <= 0) return 1;
  const usable = getPdfUsablePageHeight(withMargins);
  return Math.max(1, Math.min(PDF_MAX_PAGES, Math.ceil(bottom / usable - 0.001)));
}

/** Full document height in A4 points (N × A4). */
export function getPdfDocumentHeight(template: PdfTemplate, withMargins = false): number {
  return getPdfPageCount(template, withMargins) * A4_HEIGHT;
}

/** Full document height in preview pixels (exact N × A4 preview). */
export function getPdfPreviewHeight(template: PdfTemplate, withMargins = false): number {
  return getPdfPageCount(template, withMargins) * A4_PREVIEW_HEIGHT;
}

function clampInt(n: number, min: number, max: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** @deprecated use resizeTableCols / resizeHeaderRows */
export function resizeTableData(
  data: PdfTableData,
  nextCols: number,
  _nextRows?: number,
): PdfTableData {
  return resizeTableCols(data, nextCols);
}

/** @deprecated use updateHeaderCell */
export function updateTableCell(
  data: PdfTableData,
  row: number,
  col: number,
  patch: Partial<PdfTableCell>,
): PdfTableData {
  return updateHeaderCell(data, row, col, patch);
}

export function createElementId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTemplateId() {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultStyleForType(type: PdfElementType): PdfTextStyle {
  switch (type) {
    case "heading1":
      return { bold: true, fontSize: 22, align: "left" };
    case "heading2":
      return { bold: true, fontSize: 18, align: "left" };
    case "heading3":
      return { bold: true, fontSize: 14, align: "left" };
    case "text":
    case "dynamic":
      return { fontSize: 11, align: "left" };
    default:
      return { fontSize: 12, align: "left" };
  }
}

const PDF_ELEMENT_TYPES = new Set<PdfElementType>([
  "heading1",
  "heading2",
  "heading3",
  "text",
  "image",
  "table",
  "dynamic",
]);

/** Harden API/localStorage payloads so missing `style` etc. cannot crash the editor. */
export function normalizePdfElement(raw: unknown): PdfElement | null {
  if (!raw || typeof raw !== "object") return null;
  const el = raw as Record<string, unknown>;
  const type = el.type as PdfElementType;
  if (!PDF_ELEMENT_TYPES.has(type)) return null;

  const size = defaultSizeForType(type);
  const styleRaw =
    el.style && typeof el.style === "object" && !Array.isArray(el.style)
      ? (el.style as PdfTextStyle)
      : {};

  const analysisIdRaw = Number(el.analysisId);
  const dynamicKey =
    type === "dynamic" && typeof el.dynamicKey === "string"
      ? (el.dynamicKey as PdfDynamicFieldKey)
      : type === "dynamic"
        ? null
        : null;

  return {
    id: typeof el.id === "string" && el.id ? el.id : createElementId(),
    type,
    x: Number.isFinite(Number(el.x)) ? Number(el.x) : 0,
    y: Number.isFinite(Number(el.y)) ? Number(el.y) : 0,
    width: Number.isFinite(Number(el.width)) && Number(el.width) > 0 ? Number(el.width) : size.width,
    height:
      Number.isFinite(Number(el.height)) && Number(el.height) > 0 ? Number(el.height) : size.height,
    content: el.content == null ? defaultContentForType(type) : String(el.content),
    imageSrc: typeof el.imageSrc === "string" ? el.imageSrc : undefined,
    analysisId:
      Number.isFinite(analysisIdRaw) && analysisIdRaw > 0 ? analysisIdRaw : null,
    analysisName: typeof el.analysisName === "string" ? el.analysisName : "",
    tableData: type === "table" ? normalizeTableData(el.tableData as PdfTableData | undefined) : undefined,
    dynamicKey,
    showDynamicLabel:
      type === "dynamic"
        ? el.showDynamicLabel !== false
        : undefined,
    style: { ...defaultStyleForType(type), ...styleRaw },
  };
}

export function normalizePdfElements(raw: unknown): PdfElement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizePdfElement)
    .filter((el): el is PdfElement => el != null);
}

export function defaultContentForType(type: PdfElementType): string {
  switch (type) {
    case "heading1":
      return "Sarlavha 1";
    case "heading2":
      return "Sarlavha 2";
    case "heading3":
      return "Sarlavha 3";
    case "text":
      return "Matn yozing...";
    case "image":
      return "";
    case "table":
      return "Jadval";
    case "dynamic":
      return "";
    default:
      return "";
  }
}

export function defaultSizeForType(type: PdfElementType): { width: number; height: number } {
  switch (type) {
    case "heading1":
      return { width: 500, height: 36 };
    case "heading2":
      return { width: 460, height: 30 };
    case "heading3":
      return { width: 420, height: 26 };
    case "text":
      return { width: 460, height: 48 };
    case "image":
      return { width: 180, height: 140 };
    case "table":
      return { width: 540, height: 220 };
    case "dynamic":
      return { width: 260, height: 22 };
    default:
      return { width: 200, height: 40 };
  }
}

export function createPdfElement(
  type: PdfElementType,
  x: number,
  y: number,
  extras?: Partial<PdfElement>,
): PdfElement {
  const dynamicKey = extras?.dynamicKey ?? null;
  const def = dynamicKey ? getDynamicFieldDef(dynamicKey) : null;
  const size = def?.defaultSize ?? defaultSizeForType(type);
  return {
    id: createElementId(),
    type,
    x: Math.max(0, Math.min(x, A4_WIDTH - size.width)),
    y: Math.max(0, Math.min(y, A4_HEIGHT * PDF_MAX_PAGES - 20)),
    width: size.width,
    height: size.height,
    content: def?.label ?? defaultContentForType(type),
    analysisId: null,
    analysisName: "",
    tableData: type === "table" ? createEmptyTableData(4, 1) : undefined,
    dynamicKey: type === "dynamic" ? dynamicKey : null,
    showDynamicLabel: type === "dynamic" ? true : undefined,
    style: defaultStyleForType(type),
    ...extras,
  };
}

export function createDynamicElement(
  key: PdfDynamicFieldKey,
  x: number,
  y: number,
): PdfElement {
  const def = getDynamicFieldDef(key)!;
  return createPdfElement("dynamic", x, y, {
    dynamicKey: key,
    content: def.label,
    showDynamicLabel: def.showLabelByDefault !== false,
    ...(def.defaultSize
      ? { width: def.defaultSize.width, height: def.defaultSize.height }
      : {}),
    style: { ...defaultStyleForType("dynamic"), ...def.defaultStyle },
  });
}

export function formatDynamicDisplay(
  el: PdfElement,
  ctx: PdfDynamicContext | null,
  forPreview: boolean,
): { label: string; value: string; full: string } {
  const key = el.dynamicKey;
  const def = key ? getDynamicFieldDef(key) : null;
  const label = (el.content || def?.label || "").trim();
  const value = key
    ? resolveDynamicValue(key, ctx ?? {}, forPreview || !ctx)
    : forPreview
      ? "…"
      : "—";
  const showLabel = el.showDynamicLabel !== false;
  const full = showLabel && label ? `${label}: ${value}` : value;
  return { label, value, full };
}

export function loadPdfTemplates(): PdfTemplate[] {
  try {
    const raw = localStorage.getItem(PDF_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PdfTemplate[]) : [];
  } catch {
    return [];
  }
}

export function savePdfTemplates(templates: PdfTemplate[]) {
  try {
    // Cache faqat metadata + layout; katta base64 rasmlar quota ni to'ldiradi
    const slim = templates.map(t => ({
      ...t,
      elements: (t.elements ?? []).map(el => {
        if (el.type !== "image") return el;
        const src = el.imageSrc ?? "";
        if (src.length <= 8_000) return el;
        return { ...el, imageSrc: undefined };
      }),
    }));
    localStorage.setItem(PDF_TEMPLATE_STORAGE_KEY, JSON.stringify(slim));
  } catch {
    try {
      localStorage.removeItem(PDF_TEMPLATE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Logout / login: company shablonlarini local cache dan tozalash */
export function clearPdfTemplatesStorage() {
  try {
    localStorage.removeItem(PDF_TEMPLATE_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_PDF_TEMPLATE_KEY);
  } catch {
    /* ignore */
  }
}

export function getActiveTemplateId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PDF_TEMPLATE_KEY);
  } catch {
    return null;
  }
}

export function setActiveTemplateId(id: string | null) {
  if (id == null) {
    localStorage.removeItem(ACTIVE_PDF_TEMPLATE_KEY);
  } else {
    localStorage.setItem(ACTIVE_PDF_TEMPLATE_KEY, id);
  }
}

export function getActivePdfTemplate(): PdfTemplate | null {
  const templates = loadPdfTemplates();
  if (templates.length === 0) return null;
  const activeId = getActiveTemplateId();
  if (activeId) {
    const found = templates.find(t => t.id === activeId);
    if (found) return found;
  }
  return templates[0];
}

export function upsertPdfTemplate(template: PdfTemplate) {
  const list = loadPdfTemplates();
  const idx = list.findIndex(t => t.id === template.id);
  if (idx >= 0) list[idx] = template;
  else list.unshift(template);
  savePdfTemplates(list);
  setActiveTemplateId(template.id);
  return template;
}

export function deletePdfTemplate(id: string) {
  const list = loadPdfTemplates().filter(t => t.id !== id);
  savePdfTemplates(list);
  if (getActiveTemplateId() === id) {
    setActiveTemplateId(list[0]?.id ?? null);
  }
}

/** Prefer template-level analysis, then table-bound; used as `/onlinestorage` analysis_id */
export function resolvePdfTemplateAnalysisId(template: PdfTemplate): number | null {
  const top = Number(template.analysisId);
  if (Number.isFinite(top) && top > 0) return top;

  for (const el of template.elements ?? []) {
    if (el?.type !== "table") continue;
    const n = Number(el.analysisId);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function pdfTemplateToStoragePayload(template: PdfTemplate): {
  elements: PdfElement[];
  analysisId?: number;
  analysisName?: string;
  baseAnalysisId?: number;
} {
  const analysisId = resolvePdfTemplateAnalysisId(template);
  const baseAnalysisId = Number(template.baseAnalysisId);
  return {
    elements: template.elements,
    ...(analysisId != null
      ? { analysisId, analysisName: template.analysisName?.trim() || "" }
      : {}),
    ...(Number.isFinite(baseAnalysisId) && baseAnalysisId > 0
      ? { baseAnalysisId }
      : {}),
  };
}

function coerceParsedStorageText(text: unknown): unknown {
  let parsed: unknown = text;
  // API may return JSON string (sometimes double-encoded)
  for (let i = 0; i < 2; i++) {
    if (typeof parsed !== "string") break;
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  return parsed;
}

export function parsePdfTemplateFromStorageText(
  text: unknown,
  fallbackName: string,
): PdfTemplate | null {
  const parsed = coerceParsedStorageText(text);
  if (parsed == null) return null;

  const now = new Date().toISOString();

  // Current format: { elements: [...] } (+ optional analysisId)
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.elements)) {
      const analysisIdRaw = Number(obj.analysisId ?? obj.analysis_id);
      const baseAnalysisIdRaw = Number(obj.baseAnalysisId ?? obj.baseanalysis_id);
      return {
        id: typeof obj.id === "string" && obj.id ? obj.id : createTemplateId(),
        name:
          (typeof obj.name === "string" && obj.name.trim()) ||
          fallbackName ||
          "PDF shablon",
        elements: normalizePdfElements(obj.elements),
        createdAt: typeof obj.createdAt === "string" ? obj.createdAt : now,
        updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : now,
        storageId:
          typeof obj.storageId === "number" && Number.isFinite(obj.storageId)
            ? obj.storageId
            : null,
        globalStorageId:
          typeof obj.globalStorageId === "number" && Number.isFinite(obj.globalStorageId)
            ? obj.globalStorageId
            : null,
        analysisId: Number.isFinite(analysisIdRaw) && analysisIdRaw > 0 ? analysisIdRaw : null,
        analysisName: typeof obj.analysisName === "string" ? obj.analysisName : "",
        baseAnalysisId:
          Number.isFinite(baseAnalysisIdRaw) && baseAnalysisIdRaw > 0 ? baseAnalysisIdRaw : null,
      };
    }
  }

  // Legacy: bare elements array
  if (Array.isArray(parsed)) {
    return {
      id: createTemplateId(),
      name: fallbackName || "PDF shablon",
      elements: normalizePdfElements(parsed),
      createdAt: now,
      updatedAt: now,
      storageId: null,
      analysisId: null,
      analysisName: "",
    };
  }

  return null;
}

export function onlineStorageRecordToPdfTemplate(
  record: OnlineStorage,
): PdfTemplate | null {
  const fromRecord = resolveOnlineStorageAnalysisId(record);
  let tpl = parsePdfTemplateFromStorageText(record.text, record.name);

  // text buzilgan bo'lsa ham analysis_id bo'lsa ro'yxatda ko'rsatamiz
  if (!tpl) {
    if (fromRecord == null) return null;
    const now = new Date().toISOString();
    tpl = {
      id: `storage-${record.id}`,
      name: record.name?.trim() || "PDF shablon",
      elements: [],
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now,
      storageId: record.id,
      analysisId: fromRecord,
      analysisName:
        typeof record.analysis === "object" && record.analysis?.name
          ? record.analysis.name.trim()
          : "",
    };
  }

  const fromElements = resolvePdfTemplateAnalysisId(tpl);
  const analysisId =
    fromRecord ??
    (Number(tpl.analysisId) > 0 ? Number(tpl.analysisId) : null) ??
    fromElements;
  const analysisName =
    (typeof record.analysis === "object" && record.analysis?.name?.trim()) ||
    tpl.analysisName?.trim() ||
    "";

  if (analysisId && analysisId > 0) {
    for (const el of tpl.elements) {
      if (el.type !== "table") continue;
      if (!el.analysisId) {
        el.analysisId = analysisId;
        if (analysisName) el.analysisName = analysisName;
      }
    }
  }

  return {
    ...tpl,
    id: `storage-${record.id}`,
    name: record.name?.trim() || tpl.name,
    storageId: record.id,
    analysisId: analysisId && analysisId > 0 ? analysisId : null,
    analysisName,
    createdAt: record.createdAt || tpl.createdAt,
    updatedAt: record.updatedAt || tpl.updatedAt,
  };
}

export async function fetchPdfTemplatesFromApi(companyId?: number): Promise<PdfTemplate[]> {
  if (companyId != null && companyId > 0) {
    await ensureCompanyPdfTemplatesFromGlobal(companyId).catch(() => 0);
  }
  const records = await getAllOnlineStorages(companyId);
  const templates = records
    .map(onlineStorageRecordToPdfTemplate)
    .filter((t): t is PdfTemplate => t != null);

  // Cache ixtiyoriy — quota to'lsa ham xotiradagi ro'yxat qaytadi
  try {
    savePdfTemplates(templates);
  } catch {
    /* ignore */
  }

  try {
    const activeId = getActiveTemplateId();
    if (activeId && !templates.some(t => t.id === activeId)) {
      setActiveTemplateId(templates[0]?.id ?? null);
    } else if (!activeId && templates[0]) {
      setActiveTemplateId(templates[0].id);
    } else if (templates.length === 0) {
      setActiveTemplateId(null);
    }
  } catch {
    /* ignore */
  }

  return templates;
}

export async function upsertPdfTemplateRemote(
  template: PdfTemplate,
  companyIdOverride?: number,
): Promise<PdfTemplate> {
  const analysisId = resolvePdfTemplateAnalysisId(template);
  if (analysisId == null) {
    throw new Error("Shablon uchun analiz tanlang, keyin saqlang");
  }
  const companyId = companyIdOverride ?? template.companyId ?? getStoredCompanyId();

  const now = new Date().toISOString();
  const next: PdfTemplate = {
    ...template,
    name: template.name.trim() || "PDF shablon",
    updatedAt: now,
    createdAt: template.createdAt || now,
  };

  const payload = {
    name: next.name,
    text: pdfTemplateToStoragePayload(next),
    analysis_id: analysisId,
    ...(companyId != null && companyId > 0 ? { company_id: companyId } : {}),
  };

  let storageId = next.storageId ?? null;
  if (storageId != null && storageId > 0) {
    await updateOnlineStorage(storageId, payload);
  } else {
    const created = await addOnlineStorage(payload);
    storageId = extractOnlineStorageId(created);
    if (storageId == null) {
      throw new Error("Server yangi shablon id qaytarmadi");
    }
  }

  try {
    await updateAnalysis(analysisId, {
      onlinestorage: true,
      ...(companyId != null && companyId > 0 ? { company_id: companyId } : {}),
    });
  } catch {
    /* onlinestorage yozuvi asosiy natija */
  }

  const saved: PdfTemplate = {
    ...next,
    storageId,
    companyId: companyId && companyId > 0 ? companyId : next.companyId,
  };
  upsertPdfTemplate(saved);
  return saved;
}

export async function deletePdfTemplateRemote(template: PdfTemplate): Promise<void> {
  const analysisId = resolvePdfTemplateAnalysisId(template);
  const companyId = template.companyId ?? getStoredCompanyId();
  if (template.storageId != null && template.storageId > 0) {
    await deleteOnlineStorage(template.storageId, companyId ?? undefined);
  }
  deletePdfTemplate(template.id);
  if (analysisId != null) {
    await updateAnalysis(analysisId, {
      onlinestorage: false,
      ...(companyId != null && companyId > 0 ? { company_id: companyId } : {}),
    });
  }
}

export function globalStorageRecordToPdfTemplate(
  record: GlobalStorage,
): PdfTemplate | null {
  const fromCompanyAnalysis = resolveGlobalStorageAnalysisId(record);
  const fromBaseAnalysis = resolveGlobalStorageBaseAnalysisId(record);
  const fromRecord = fromCompanyAnalysis ?? fromBaseAnalysis;
  const baseAnalysisName =
    typeof record.baseanalysis === "object" && record.baseanalysis?.name
      ? record.baseanalysis.name.trim()
      : "";
  let tpl = parsePdfTemplateFromStorageText(record.text, record.name);

  if (!tpl) {
    if (fromRecord == null) return null;
    const now = new Date().toISOString();
    tpl = {
      id: `global-${record.id}`,
      name: record.name?.trim() || "PDF shablon",
      elements: [],
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now,
      storageId: null,
      globalStorageId: record.id,
      analysisId: fromRecord,
      analysisName:
        (typeof record.analysis === "object" && record.analysis?.name
          ? record.analysis.name.trim()
          : "") || baseAnalysisName,
      baseAnalysisId: fromBaseAnalysis,
    };
  }

  const analysisId = fromRecord ?? (Number(tpl.analysisId) > 0 ? Number(tpl.analysisId) : null);
  const analysisName =
    (typeof record.analysis === "object" && record.analysis?.name?.trim()) ||
    baseAnalysisName ||
    tpl.analysisName?.trim() ||
    "";
  const companyId = resolveGlobalStorageCompanyId(record) ?? (Number(tpl.companyId) > 0 ? Number(tpl.companyId) : null);
  const companyName =
    (typeof record.company === "object" && record.company?.name?.trim()) ||
    tpl.companyName?.trim() ||
    "";

  if (analysisId && analysisId > 0) {
    const table = tpl.elements.find(el => el.type === "table");
    if (table && !table.analysisId) {
      table.analysisId = analysisId;
      if (analysisName) table.analysisName = analysisName;
    }
  }

  return {
    ...tpl,
    id: `global-${record.id}`,
    name: record.name?.trim() || tpl.name,
    storageId: null,
    globalStorageId: record.id,
    companyId: companyId && companyId > 0 ? companyId : null,
    companyName,
    analysisId: analysisId && analysisId > 0 ? analysisId : null,
    analysisName,
    baseAnalysisId: fromBaseAnalysis ?? tpl.baseAnalysisId ?? null,
    createdAt: record.createdAt || tpl.createdAt,
    updatedAt: record.updatedAt || tpl.updatedAt,
  };
}

/** Clone a global template so PDF tab can save it into this company's online storage */
export function cloneGlobalTemplateForLocalEdit(template: PdfTemplate): PdfTemplate {
  const now = new Date().toISOString();
  const cloned = structuredClone(template);
  return {
    ...cloned,
    id: createTemplateId(),
    elements: normalizePdfElements(cloned.elements),
    storageId: null,
    globalStorageId: null,
    baseAnalysisId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function normTemplateName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function globalStorageHasBody(item: GlobalStorage): boolean {
  if (item.text == null) return false;
  if (typeof item.text === "string") return item.text.trim() !== "";
  if (typeof item.text === "object") return Object.keys(item.text as object).length > 0;
  return true;
}

export function remapGlobalTemplateToAnalysis(
  template: PdfTemplate,
  analysisId: number,
  analysisName: string,
  companyId?: number | null,
): PdfTemplate {
  const cloned = cloneGlobalTemplateForLocalEdit(template);
  const nextCompanyId = Number(companyId);
  return {
    ...cloned,
    analysisId,
    analysisName,
    companyId: Number.isFinite(nextCompanyId) && nextCompanyId > 0 ? nextCompanyId : null,
    elements: cloned.elements.map(el =>
      el.type === "table" ? { ...el, analysisId, analysisName } : el,
    ),
  };
}

export function globalTemplateMatchesAnalyses(
  item: GlobalStorage,
  analyses: Array<{ id: number; name?: string | null; shortname?: string | null }>,
): boolean {
  if (analyses.length === 0) return false;
  const ids = new Set(analyses.map(a => a.id));
  const names = new Set(
    analyses.flatMap(a => [a.name, a.shortname].map(normTemplateName).filter(Boolean)),
  );
  const parsed = globalStorageRecordToPdfTemplate(item);
  const baseId = resolveGlobalStorageBaseAnalysisId(item) ?? parsed?.baseAnalysisId ?? null;
  if (baseId != null && ids.has(baseId)) return true;
  const analysisId = resolveGlobalStorageAnalysisId(item) ?? parsed?.analysisId ?? null;
  if (analysisId != null && ids.has(analysisId)) return true;
  const relationName = normTemplateName(
    item.baseanalysis?.name || item.analysis?.name || parsed?.analysisName,
  );
  if (relationName && names.has(relationName)) return true;
  const itemName = normTemplateName(item.name);
  if (itemName && names.has(itemName)) return true;
  for (const name of names) {
    if (!name) continue;
    if (itemName.includes(name) || (itemName && name.includes(itemName))) return true;
    if (relationName && (relationName.includes(name) || name.includes(relationName))) return true;
  }
  return false;
}

export async function hydrateGlobalStorageRecords(
  records: GlobalStorage[],
): Promise<GlobalStorage[]> {
  const list = Array.isArray(records) ? records : [];
  const result: GlobalStorage[] = [];
  const chunkSize = 8;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    const hydrated = await Promise.all(chunk.map(async item => {
      if (
        globalStorageHasBody(item)
        && (item.analysis || item.baseanalysis || globalStorageRecordToPdfTemplate(item))
      ) {
        return item;
      }
      return getGlobalStorageById(item.id).catch(() => item);
    }));
    result.push(...hydrated);
  }
  return result;
}

function pickGlobalTemplateForAnalysis(
  records: GlobalStorage[],
  analysis: Pick<Analysis, "id" | "name">,
): GlobalStorage | null {
  const target = normTemplateName(analysis.name);
  const scored = records.flatMap(item => {
    if (!globalTemplateMatchesAnalyses(item, [analysis])) return [];
    const parsed = globalStorageRecordToPdfTemplate(item);
    const names = [
      item.baseanalysis?.name,
      item.analysis?.name,
      parsed?.analysisName,
      item.name,
    ].map(normTemplateName).filter(Boolean);
    const exact = names.includes(target);
    return [{ item, exact }];
  });
  return (scored.find(entry => entry.exact) ?? scored[0])?.item ?? null;
}

const inflightGlobalTemplateSync = new Map<number, Promise<number>>();

/**
 * Tashkilotda PDF shablon yo'q analizlar uchun global shablonlarni
 * `/onlinestorage` ga `company_id` bilan ko'chiradi (super admin va director).
 */
export function ensureCompanyPdfTemplatesFromGlobal(companyId: number): Promise<number> {
  if (!Number.isFinite(companyId) || companyId <= 0) return Promise.resolve(0);
  const existing = inflightGlobalTemplateSync.get(companyId);
  if (existing) return existing;
  const promise = ensureCompanyPdfTemplatesFromGlobalInner(companyId).finally(() => {
    inflightGlobalTemplateSync.delete(companyId);
  });
  inflightGlobalTemplateSync.set(companyId, promise);
  return promise;
}

async function ensureCompanyPdfTemplatesFromGlobalInner(companyId: number): Promise<number> {
  const [analyses, existing, globalRaw] = await Promise.all([
    getAllAnalyses(companyId).catch(() => [] as Analysis[]),
    getAllOnlineStorages(companyId).catch(() => [] as OnlineStorage[]),
    getAllGlobalStorages().catch(() => [] as GlobalStorage[]),
  ]);
  if (!Array.isArray(analyses) || analyses.length === 0) return 0;

  const coveredIds = new Set(
    existing
      .map(item => resolveOnlineStorageAnalysisId(item))
      .filter((id): id is number => id != null),
  );
  const coveredNames = new Set(
    existing.flatMap(item => {
      const fromRelation = item.analysis?.name;
      const fromParsed = onlineStorageRecordToPdfTemplate(item)?.analysisName;
      return [fromRelation, fromParsed].map(normTemplateName).filter(Boolean);
    }),
  );

  const missing = analyses.filter(item => {
    if (coveredIds.has(item.id)) return false;
    return !coveredNames.has(normTemplateName(item.name));
  });
  if (missing.length === 0) return 0;

  const globals = await hydrateGlobalStorageRecords(globalRaw);
  let created = 0;
  for (const analysis of missing) {
    const match = pickGlobalTemplateForAnalysis(globals, analysis);
    if (!match) continue;
    const full = await getGlobalStorageById(match.id).catch(() => match);
    const parsed = globalStorageRecordToPdfTemplate(full) ?? globalStorageRecordToPdfTemplate(match);
    if (!parsed) continue;
    try {
      const saved = await upsertPdfTemplateRemote(
        remapGlobalTemplateToAnalysis(parsed, analysis.id, analysis.name, companyId),
        companyId,
      );
      if (saved.storageId != null) {
        coveredIds.add(analysis.id);
        coveredNames.add(normTemplateName(analysis.name));
        created += 1;
      }
    } catch {
      /* super admin tokenida backend analizni topa olmasligi mumkin */
    }
  }
  return created;
}

export async function fetchGlobalPdfTemplates(): Promise<PdfTemplate[]> {
  const records = await getAllGlobalStorages();
  return records
    .map(globalStorageRecordToPdfTemplate)
    .filter((t): t is PdfTemplate => t != null);
}

export async function upsertPdfTemplateGlobal(
  template: PdfTemplate,
  companyIdOverride?: number,
): Promise<PdfTemplate> {
  const analysisId = resolvePdfTemplateAnalysisId(template);
  const baseAnalysisId = Number(template.baseAnalysisId);
  const hasBaseAnalysis = Number.isFinite(baseAnalysisId) && baseAnalysisId > 0;
  if (!hasBaseAnalysis && analysisId == null) {
    throw new Error("Shablon uchun analiz tanlang, keyin saqlang");
  }

  const companyId = companyIdOverride ?? template.companyId ?? getStoredCompanyId();

  const now = new Date().toISOString();
  const next: PdfTemplate = {
    ...template,
    name: template.name.trim() || "PDF shablon",
    updatedAt: now,
    createdAt: template.createdAt || now,
  };

  const payload: GlobalStoragePayload = {
    name: next.name,
    text: pdfTemplateToStoragePayload(next),
    ...(hasBaseAnalysis
      ? { baseanalysis_id: baseAnalysisId }
      : { analysis_id: analysisId as number }),
  };

  let globalStorageId = next.globalStorageId ?? null;
  if (globalStorageId != null && globalStorageId > 0) {
    await updateGlobalStorage(globalStorageId, payload);
  } else {
    const created = await addGlobalStorage(payload);
    globalStorageId = extractGlobalStorageId(created);
    if (globalStorageId == null) {
      throw new Error("Server yangi global shablon id qaytarmadi");
    }
  }

  return {
    ...next,
    globalStorageId,
    companyId: companyId && companyId > 0 ? companyId : next.companyId,
    baseAnalysisId: hasBaseAnalysis ? baseAnalysisId : next.baseAnalysisId,
  };
}

export async function deletePdfTemplateGlobal(template: PdfTemplate): Promise<void> {
  if (template.globalStorageId != null && template.globalStorageId > 0) {
    await deleteGlobalStorage(template.globalStorageId);
  }
}
