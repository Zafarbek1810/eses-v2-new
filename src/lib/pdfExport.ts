import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { A4_HEIGHT, A4_WIDTH, PDF_FONT_FAMILY } from "@/lib/pdfTemplate";

type CaptureResult = {
  canvas: HTMLCanvasElement;
  pdf: jsPDF;
  pageCount: number;
};

type PageCapture = {
  canvas: HTMLCanvasElement;
  orientation: "portrait" | "landscape";
  widthPt: number;
  heightPt: number;
};

function applyCloneStyles(cloned: HTMLElement, captureScale: number) {
  const border = `${1 / captureScale}px solid #000`;
  cloned.style.fontFamily = PDF_FONT_FAMILY;
  cloned.querySelectorAll("*").forEach(n => {
    (n as HTMLElement).style.fontFamily = PDF_FONT_FAMILY;
  });
  cloned.querySelectorAll("[data-pdf-page-break]").forEach(n => n.remove());
  cloned.querySelectorAll("table").forEach(t => {
    const table = t as HTMLElement;
    table.style.border = "none";
    table.style.borderCollapse = "collapse";
    table.style.borderSpacing = "0";
  });
  cloned.querySelectorAll("th, td").forEach(cell => {
    const node = cell as HTMLElement;
    node.style.border = border;
    node.style.outline = "none";
    node.style.boxShadow = "none";
  });
}

async function captureNode(el: HTMLElement, captureScale = 2): Promise<HTMLCanvasElement> {
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  return html2canvas(el, {
    scale: captureScale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    onclone: (_doc, cloned) => applyCloneStyles(cloned, captureScale),
  });
}

function pageSizeForOrientation(orientation: "portrait" | "landscape") {
  return orientation === "landscape"
    ? { widthPt: A4_HEIGHT, heightPt: A4_WIDTH }
    : { widthPt: A4_WIDTH, heightPt: A4_HEIGHT };
}

async function capturePages(el: HTMLElement): Promise<PageCapture[]> {
  const pageNodes = Array.from(
    el.querySelectorAll<HTMLElement>("[data-pdf-page]"),
  );

  if (pageNodes.length > 0) {
    const pages: PageCapture[] = [];
    for (const node of pageNodes) {
      const orientation =
        node.dataset.orientation === "landscape" ? "landscape" : "portrait";
      const { widthPt, heightPt } = pageSizeForOrientation(orientation);
      const canvas = await captureNode(node);
      pages.push({ canvas, orientation, widthPt, heightPt });
    }
    return pages;
  }

  // Legacy fallback: single continuous portrait sheet sliced by A4 height
  const canvas = await captureNode(el);
  const { widthPt, heightPt } = pageSizeForOrientation("portrait");
  const imgW = widthPt;
  const imgH = (canvas.height * imgW) / canvas.width;
  const pageCount = Math.max(1, Math.ceil(imgH / heightPt - 0.01));
  const slicePx = canvas.height / pageCount;
  const pages: PageCapture[] = [];

  for (let i = 0; i < pageCount; i++) {
    const sy = Math.floor(i * slicePx);
    const sh = Math.min(Math.ceil(slicePx), canvas.height - sy);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.max(1, sh);
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
    pages.push({
      canvas: pageCanvas,
      orientation: "portrait",
      widthPt,
      heightPt,
    });
  }
  return pages;
}

function buildPdfFromPages(pages: PageCapture[]): { pdf: jsPDF; pageCount: number } {
  if (pages.length === 0) {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [A4_WIDTH, A4_HEIGHT],
    });
    return { pdf, pageCount: 0 };
  }

  const first = pages[0];
  const pdf = new jsPDF({
    orientation: first.orientation,
    unit: "pt",
    format: [first.widthPt, first.heightPt],
  });

  pages.forEach((page, i) => {
    if (i > 0) {
      pdf.addPage([page.widthPt, page.heightPt], page.orientation);
    }
    const imgData = page.canvas.toDataURL("image/png");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Fit image into page (covers full page; capture already matches aspect).
    pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
  });

  return { pdf, pageCount: pages.length };
}

/**
 * Capture a rendered PDF preview element as canvas + multi-page A4 jsPDF.
 * Each `[data-pdf-page]` keeps its own portrait/landscape size.
 */
async function captureElement(el: HTMLElement): Promise<CaptureResult> {
  const pages = await capturePages(el);
  const { pdf, pageCount } = buildPdfFromPages(pages);
  const canvas = pages[0]?.canvas ?? document.createElement("canvas");
  return { canvas, pdf, pageCount };
}

/** Capture a rendered PDF preview element and save as a multi-page A4 PDF. */
export async function downloadElementAsPdf(
  el: HTMLElement,
  filename: string,
): Promise<void> {
  const { pdf } = await captureElement(el);
  pdf.save(filename);
}

function waitForImages(doc: Document): Promise<void> {
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

/**
 * Capture the on-screen order PDF and open the system print dialog with that content.
 * Uses a real browser window + page images (same capture as download) so Chrome
 * print preview shows the PDF instead of a blank page from an off-screen iframe.
 */
export async function printElementAsPdf(el: HTMLElement): Promise<void> {
  const pages = await capturePages(el);
  if (pages.length === 0 || pages.some(p => p.canvas.width < 2 || p.canvas.height < 2)) {
    throw new Error("PDF kontenti olinmadi");
  }

  const pagesHtml = pages
    .map((page, i) => {
      const src = page.canvas.toDataURL("image/png");
      return `<div class="page page-${page.orientation}"><img src="${src}" alt="Sahifa ${i + 1}" /></div>`;
    })
    .join("");

  const hasLandscape = pages.some(p => p.orientation === "landscape");
  const hasPortrait = pages.some(p => p.orientation === "portrait");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chop etish</title>
  <style>
    @page portrait-page { size: A4 portrait; margin: 0; }
    @page landscape-page { size: A4 landscape; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page {
      margin: 0 auto;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      background: #fff;
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .page-portrait {
      width: ${A4_WIDTH}pt;
      height: ${A4_HEIGHT}pt;
      ${hasPortrait ? "page: portrait-page;" : ""}
    }
    .page-landscape {
      width: ${A4_HEIGHT}pt;
      height: ${A4_WIDTH}pt;
      ${hasLandscape ? "page: landscape-page;" : ""}
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: fill;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    throw new Error(
      "Chop etish oynasini ochib bo'lmadi (popup bloklangan). Brauzerda popupga ruxsat bering.",
    );
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  await waitForImages(win.document);
  await new Promise<void>(r => window.setTimeout(() => r(), 100));

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
