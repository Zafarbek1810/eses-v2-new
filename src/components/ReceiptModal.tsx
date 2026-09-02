import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink, Loader2, Printer, QrCode, X } from "lucide-react";
import { copyTextToClipboard } from "@/lib/copyText";
import { formatDate } from "@/lib/formatDate";
import { buildShowResultUrl } from "@/lib/showResultLink";
import type { PdfTemplate } from "@/lib/pdfTemplate";

export type ResultQrLink = {
  analysisId: number;
  analysisName: string;
  url: string;
};

export type ReceiptPatient = {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
};

export type ReceiptCartItem = {
  key: string;
  analysis_id: number;
  analysis_name: string;
  laboratory_name: string;
  price: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  click: "Click",
};

const QR_PRINT_OPTIONS = {
  width: 280,
  margin: 1,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000", light: "#ffffff" },
};

function formatPrice(price: number) {
  return price.toLocaleString("uz-UZ") + " so'm";
}

function ResultQrImage({ src }: { src: string | null }) {
  if (!src) {
    return <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />;
  }
  return (
    <img
      src={src}
      alt="Natija QR kod"
      className="w-52 h-52 bg-white rounded-xl"
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ReceiptSlipData = {
  patientName: string;
  phone: string;
  analysisId: number;
  analysisName: string;
  laboratoryName: string;
  priceLabel: string;
  qrSrc: string | null;
};

function receiptSlipHtml(slip: ReceiptSlipData): string {
  const qr = slip.qrSrc
    ? `<img src="${slip.qrSrc}" alt="" width="200" height="200" style="width:200px;height:200px;background:#fff" />`
    : `<p style="font-size:12px;text-align:center;margin:0">QR kod mavjud emas</p>`;
  const lab = slip.laboratoryName
    ? `<div style="font-size:11px;color:#444;margin-top:2px">${escapeHtml(slip.laboratoryName)}</div>`
    : "";

  return `<div class="slip">
    <div class="inner">
      <div style="display:flex;justify-content:center;margin-bottom:12px">${qr}</div>
      <p style="text-align:center;font-size:11px;margin:0 0 18px;color:#333">QR kodni skanerlab natija PDF ni oching</p>
      <div style="font-size:13px;line-height:1.45;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:6px">
          <span>Bemor</span>
          <span style="font-weight:600;text-align:right">${escapeHtml(slip.patientName)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px">
          <span>Telefon</span>
          <span>${escapeHtml(slip.phone)}</span>
        </div>
      </div>
        <div style="border-top:1px dashed #888;border-bottom:1px dashed #888;padding:12px 0">
        <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px">
          <div>
            <div style="font-weight:600">${escapeHtml(slip.analysisName)}</div>
            <div style="font-size:11px;color:#666;margin-top:2px">ID: ${slip.analysisId}</div>
            ${lab}
          </div>
          <div style="white-space:nowrap;font-weight:600">${escapeHtml(slip.priceLabel)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function waitForPrintImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      img =>
        new Promise<void>(resolve => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  ).then(async () => {
    await Promise.all(
      images.map(img => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())),
    );
  });
}

async function printKassaReceipts(slips: ReceiptSlipData[]): Promise<void> {
  const win = window.open("", "_blank", "width=480,height=720");
  if (!win) {
    throw new Error(
      "Chop etish oynasini ochib bo'lmadi (popup bloklangan). Brauzerda popupga ruxsat bering.",
    );
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chek</title>
  <style id="page-size-style">
    @page { margin: 4mm; size: 80mm 200mm; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: system-ui, Segoe UI, sans-serif;
    }
    .slip {
      page-break-after: always;
      break-after: page;
      padding: 8px 0 16px;
    }
    .slip:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .inner {
      width: 280px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  ${slips.map(receiptSlipHtml).join("")}
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();

  await waitForPrintImages(win.document);
  await new Promise<void>(r => window.setTimeout(() => r(), 120));

  // Size each printed page to the actual content instead of trusting the
  // printer's default paper size — this is what stops a long name from
  // pushing content onto a second sheet.
  const slipEls = Array.from(win.document.querySelectorAll<HTMLElement>(".slip"));
  const tallestSlip = slipEls.reduce(
    (max, el) => Math.max(max, el.getBoundingClientRect().height),
    0,
  );
  const pageHeightMm = Math.ceil((tallestSlip / 96) * 25.4) + 8; // px -> mm + small buffer
  const styleEl = win.document.getElementById("page-size-style");
  if (styleEl) {
    styleEl.textContent = styleEl.textContent!.replace(
      /@page\s*{[^}]*}/,
      `@page { margin: 4mm; size: 80mm ${pageHeightMm}mm; }`,
    );
  }

  try {
    win.focus();
    win.print();
  } catch (err) {
    win.close();
    throw err instanceof Error ? err : new Error("Chop etib bo'lmadi");
  }

  const closeWin = () => {
    try {
      win.close();
    } catch {
      /* ignore */
    }
  };
  win.addEventListener("afterprint", () => {
    window.setTimeout(closeWin, 200);
  });
}

export function resolveStorageIdForAnalysis(
  analysisId: number,
  templates: PdfTemplate[],
): number | null {
  const matched =
    templates.find(
      t => t.analysisId === analysisId && t.storageId != null && t.storageId > 0,
    ) ??
    templates.find(
      t =>
        t.storageId != null &&
        t.storageId > 0 &&
        t.elements.some(el => el.type === "table" && el.analysisId === analysisId),
    );
  const storageId = matched?.storageId ?? null;
  return storageId != null && storageId > 0 ? storageId : null;
}

export function buildReceiptQrLinks(
  orderId: number,
  items: Pick<ReceiptCartItem, "analysis_id" | "analysis_name">[],
  templates: PdfTemplate[],
): ResultQrLink[] {
  const links: ResultQrLink[] = [];
  for (const item of items) {
    const storageId = resolveStorageIdForAnalysis(item.analysis_id, templates);
    if (storageId == null) continue;
    links.push({
      analysisId: item.analysis_id,
      analysisName: item.analysis_name,
      url: buildShowResultUrl({
        orderId,
        analysisId: item.analysis_id,
        storageId,
      }),
    });
  }
  return links;
}

export function ReceiptModal({
  primaryColor,
  patient,
  items,
  paymentMethod,
  paidAmount,
  discountPercent,
  totalBeforeDiscount,
  resultLinks,
  initialAnalysisId,
  onClose,
}: {
  primaryColor: string;
  patient: ReceiptPatient;
  items: ReceiptCartItem[];
  paymentMethod: string;
  paidAmount: number;
  discountPercent: number | null;
  totalBeforeDiscount: number;
  resultLinks: ResultQrLink[];
  initialAnalysisId?: number | null;
  onClose: () => void;
}) {
  const [activeAnalysisId, setActiveAnalysisId] = useState<number | null>(
    initialAnalysisId ?? resultLinks[0]?.analysisId ?? null,
  );
  const [copied, setCopied] = useState(false);
  const [qrSrcByUrl, setQrSrcByUrl] = useState<Record<string, string>>({});
  const [qrReady, setQrReady] = useState(resultLinks.length === 0);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const discountAmount =
    discountPercent != null && discountPercent > 0
      ? Math.round((totalBeforeDiscount * discountPercent) / 100)
      : 0;
  const methodLabel = PAYMENT_LABELS[paymentMethod] ?? paymentMethod;
  const now = new Date();
  const checkNo = `CHK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const activeLink =
    resultLinks.find(l => l.analysisId === activeAnalysisId) ?? resultLinks[0] ?? null;
  const activeQrSrc = activeLink ? qrSrcByUrl[activeLink.url] ?? null : null;

  useEffect(() => {
    setActiveAnalysisId(initialAnalysisId ?? resultLinks[0]?.analysisId ?? null);
  }, [initialAnalysisId, resultLinks]);

  useEffect(() => {
    let cancelled = false;
    const urls = resultLinks.map(l => l.url).filter(Boolean);
    if (urls.length === 0) {
      setQrSrcByUrl({});
      setQrReady(true);
      return;
    }
    setQrReady(false);
    void Promise.all(
      urls.map(async url => {
        try {
          const src = await QRCode.toDataURL(url, QR_PRINT_OPTIONS);
          return [url, src] as const;
        } catch {
          return [url, ""] as const;
        }
      }),
    ).then(pairs => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [url, src] of pairs) {
        if (src) next[url] = src;
      }
      setQrSrcByUrl(next);
      setQrReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [resultLinks]);

  const handlePrint = () => {
    if (printing || items.length === 0) return;
    setPrintError(null);
    setPrinting(true);
    const slips: ReceiptSlipData[] = items.map(item => {
      const link = resultLinks.find(l => l.analysisId === item.analysis_id) ?? null;
      return {
        patientName: `${patient.last_name ?? ""} ${patient.first_name ?? ""}`.trim(),
        phone: patient.phone || "—",
        analysisId: item.analysis_id,
        analysisName: item.analysis_name,
        laboratoryName: item.laboratory_name,
        priceLabel: formatPrice(item.price),
        qrSrc: link ? qrSrcByUrl[link.url] ?? null : null,
      };
    });
    void printKassaReceipts(slips)
      .catch(err => {
        setPrintError(err instanceof Error ? err.message : "Chop etib bo'lmadi");
      })
      .finally(() => {
        setPrinting(false);
      });
  };

  const handleCopy = async () => {
    if (!activeLink) return;
    const ok = await copyTextToClipboard(activeLink.url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
            <div>
              <h2 className="font-semibold text-foreground text-[15px]">To&apos;lov cheki</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                QR kod orqali natija PDF sahifasini oching
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto ses-scrollbar">
            <div className="text-center border-b border-dashed border-border pb-4 mb-4">
              <p className="text-sm font-bold text-foreground tracking-wide">SES LABORATORIYA</p>
              <p className="text-[11px] text-muted-foreground mt-1">To&apos;lov cheki</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{checkNo}</p>
              <p className="text-[11px] text-muted-foreground whitespace-pre-line">
                {formatDate(now.toISOString())}
              </p>
            </div>

            {resultLinks.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {resultLinks.map(link => (
                  <button
                    key={link.analysisId}
                    type="button"
                    onClick={() => setActiveAnalysisId(link.analysisId)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                      activeLink?.analysisId === link.analysisId
                        ? "text-white border-transparent"
                        : "bg-secondary border-border text-foreground"
                    }`}
                    style={
                      activeLink?.analysisId === link.analysisId
                        ? { background: primaryColor }
                        : undefined
                    }
                  >
                    {link.analysisName}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center mb-5">
              {activeLink ? (
                <>
                  <div className="p-3 rounded-2xl bg-white border border-border">
                    <ResultQrImage src={activeQrSrc} />
                  </div>
                  <p className="mt-3 text-[12px] font-medium text-foreground text-center">
                    {activeLink.analysisName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground text-center">
                    ID: {activeLink.analysisId}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground text-center">
                    QR kodni skanerlab natija PDF ni oching
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground break-all text-center max-w-full">
                    {activeLink.url}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-border hover:bg-secondary"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "Nusxalandi" : "Havolani nusxalash"}
                    </button>
                    <a
                      href={activeLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-border hover:bg-secondary"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ochish
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <QrCode className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-foreground">
                    Natija PDF havolasi topilmadi
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Analiz uchun PDF shablon biriktirilmagan
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-[12px] mb-4">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Bemor</span>
                <span className="font-medium text-foreground text-right">
                  {patient.last_name} {patient.first_name}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Telefon</span>
                <span className="text-foreground">{patient.phone || "—"}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-border py-3 mb-4 space-y-2">
              {items.map(item => (
                <div key={item.key} className="flex justify-between gap-3 text-[12px]">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium truncate">{item.analysis_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.laboratory_name}</p>
                    <p className="text-[10px] text-muted-foreground">ID: {item.analysis_id}</p>
                  </div>
                  <span className="shrink-0 text-foreground">{formatPrice(item.price)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-[12px] mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jami</span>
                <span className="text-foreground">{formatPrice(totalBeforeDiscount)}</span>
              </div>
              {discountPercent != null && discountPercent > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chegirma ({discountPercent}%)</span>
                  <span className="text-foreground">-{formatPrice(discountAmount)}</span>
                </div>
              )}
              {paymentMethod ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To&apos;lov turi</span>
                  <span className="text-foreground">{methodLabel}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">To&apos;langan</span>
                <span className="font-bold text-foreground" style={{ color: primaryColor }}>
                  {formatPrice(paidAmount)}
                </span>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground pt-2">
              Rahmat! Sog&apos;ligingiz uchun!
            </p>
          </div>

          {printError && (
            <p className="px-6 pb-2 text-[12px] text-red-500">{printError}</p>
          )}

          <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Yopish
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing || items.length === 0 || (!qrReady && resultLinks.length > 0)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: primaryColor }}
            >
              {printing || (!qrReady && resultLinks.length > 0) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              Chop etish
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
