import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { A4_HEIGHT, A4_WIDTH, PDF_FONT_FAMILY } from "@/lib/pdfTemplate";

type CaptureResult = {
  canvas: HTMLCanvasElement;
  pdf: jsPDF;
  pageCount: number;
};

/**
 * Capture a rendered PDF preview element as canvas + multi-page A4 jsPDF.
 * Tall content continues onto page 2, 3, … instead of being squashed onto one page.
 */
async function captureElement(el: HTMLElement): Promise<CaptureResult> {
  // Ensure the node is laid out / painted before snapshot (helps scroll parents).
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const captureScale = 2;
  const canvas = await html2canvas(el, {
    scale: captureScale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    onclone: (_doc, cloned) => {
      // scale:2 → 0.5px CSS = 1px in the final bitmap/PDF
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
    },
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [A4_WIDTH, A4_HEIGHT],
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL("image/png");

  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  // ceil with tiny epsilon avoids a blank extra page from float rounding
  // (preview px → A4 pt), while real overflow still adds pages.
  const pageCount = Math.max(1, Math.ceil(imgH / pageH - 0.01));

  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, -i * pageH, imgW, imgH);
  }

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

function sliceCanvasPages(canvas: HTMLCanvasElement, pageCount: number): string[] {
  const slicePx = canvas.height / pageCount;
  const pages: string[] = [];

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
    pages.push(pageCanvas.toDataURL("image/png"));
  }

  return pages;
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
    // Decode so print preview isn't blank on first paint.
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
  const { canvas, pageCount } = await captureElement(el);
  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error("PDF kontenti olinmadi");
  }

  const pageImages = sliceCanvasPages(canvas, pageCount);
  if (pageImages.length === 0) {
    throw new Error("PDF sahifalari yaratilmadi");
  }

  const pagesHtml = pageImages
    .map(
      (src, i) =>
        `<div class="page"><img src="${src}" alt="Sahifa ${i + 1}" /></div>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chop etish</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .page {
      width: ${A4_WIDTH}pt;
      height: ${A4_HEIGHT}pt;
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
    img {
      display: block;
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

  // Do not use noopener — we must write HTML and call print() on this window.
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
  // One more frame so layout settles before the dialog snapshots.
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
  // If user cancels / afterprint missing, leave tab open so they can retry Ctrl+P.
}
