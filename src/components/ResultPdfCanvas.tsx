import * as React from "react";
import { CustomPdfTable } from "@/components/CustomPdfTable";
import {
  A4_PREVIEW_SCALE,
  PDF_CANVAS_FONT_CLASS,
  PDF_FONT_FAMILY,
  PDF_PAGE_GAP_PREVIEW,
  formatDynamicDisplay,
  getPagePreviewTop,
  getPdfPageMarginPreview,
  getPdfPreviewHeight,
  getPdfPreviewWidth,
  getTemplatePageLayouts,
  normalizeTableData,
  previewYFromDocumentY,
  type PdfDynamicContext,
  type PdfElement,
  type PdfPageLayout,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

export const ResultPdfCanvas = React.forwardRef<
  HTMLDivElement,
  {
    template: PdfTemplate;
    fillValues: Record<string, string>;
    dynamicCtx: PdfDynamicContext | null;
    onFillChange?: (key: string, value: string) => void;
    readOnly?: boolean;
    /** Print/export: top+bottom page margin so table splits aren't flush to edges. */
    withMargins?: boolean;
  }
>(function ResultPdfCanvas(
  { template, fillValues, dynamicCtx, onFillChange, readOnly = false, withMargins = false },
  ref,
) {
  const layouts = getTemplatePageLayouts(template, withMargins);
  const width = getPdfPreviewWidth(template, withMargins);
  const height = getPdfPreviewHeight(template, withMargins);
  const marginPx = withMargins ? getPdfPageMarginPreview() : 0;

  const renderElements = (keyPrefix: string, page?: PdfPageLayout) =>
    template.elements.map(el => {
      if (page) {
        const elBottom = el.y + el.height;
        const pageEnd = page.offsetY + page.height;
        if (el.y >= pageEnd || elBottom <= page.offsetY) return null;
      }
      return (
        <FillableElement
          key={`${keyPrefix}-${el.id}`}
          element={el}
          fillValues={fillValues}
          dynamicCtx={dynamicCtx}
          onFillChange={onFillChange}
          readOnly={readOnly}
          yOffset={page ? page.offsetY : 0}
          previewTop={
            page
              ? undefined
              : previewYFromDocumentY(el.y, layouts, PDF_PAGE_GAP_PREVIEW)
          }
        />
      );
    });

  if (withMargins) {
    return (
      <div
        ref={ref}
        className={`relative shrink-0 ${PDF_CANVAS_FONT_CLASS}`}
        style={{ width, height, fontFamily: PDF_FONT_FAMILY }}
      >
        {layouts.map(page => {
          const pageW = Math.round(page.width * A4_PREVIEW_SCALE);
          const pageH = Math.round(page.height * A4_PREVIEW_SCALE);
          const usableH = Math.max(40, pageH - 2 * marginPx);
          const top = getPagePreviewTop(page, PDF_PAGE_GAP_PREVIEW);
          return (
            <div
              key={page.id}
              data-pdf-page=""
              data-orientation={page.orientation}
              className="absolute left-0 bg-white shadow-md"
              style={{
                top,
                width: pageW,
                height: pageH,
              }}
            >
              <div
                className="absolute left-0 overflow-hidden"
                style={{
                  top: marginPx,
                  width: pageW,
                  height: usableH,
                }}
              >
                <div className="absolute left-0 top-0" style={{ width: pageW }}>
                  {renderElements(`p${page.index}`, page)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`relative bg-transparent shrink-0 ${PDF_CANVAS_FONT_CLASS}`}
      style={{ width, height, fontFamily: PDF_FONT_FAMILY }}
    >
      {layouts.map((page, i) => {
        const pageW = Math.round(page.width * A4_PREVIEW_SCALE);
        const pageH = Math.round(page.height * A4_PREVIEW_SCALE);
        const top = getPagePreviewTop(page, PDF_PAGE_GAP_PREVIEW);
        return (
          <React.Fragment key={page.id}>
            <div
              data-pdf-page=""
              data-orientation={page.orientation}
              className="absolute left-0 bg-white shadow-xl border border-slate-200"
              style={{ top, width: pageW, height: pageH }}
              aria-hidden
            />
            {i > 0 && (
              <div
                data-pdf-page-break=""
                className="absolute left-0 z-30 pointer-events-none border-t border-dashed border-teal-400/80"
                style={{ top, width: pageW }}
                aria-hidden
              >
                <span className="absolute right-1 -top-2.5 rounded bg-teal-100 px-1.5 py-0.5 text-[8px] font-semibold text-teal-700">
                  {i + 1}-sahifa
                  {page.orientation === "landscape" ? " · albom" : ""}
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}
      {renderElements("edit")}
    </div>
  );
});

function FillableElement({
  element,
  fillValues,
  dynamicCtx,
  onFillChange,
  readOnly = false,
  yOffset = 0,
  previewTop,
}: {
  element: PdfElement;
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext | null;
  onFillChange?: (key: string, value: string) => void;
  readOnly?: boolean;
  yOffset?: number;
  /** Absolute preview Y when rendering on continuous canvas with page gaps */
  previewTop?: number;
}) {
  const isTable = element.type === "table";

  const textStyle: React.CSSProperties = {
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: element.style?.bold ? 700 : 400,
    fontStyle: element.style?.italic ? "italic" : "normal",
    textDecoration: element.style?.underline ? "underline" : "none",
    fontSize: (element.style?.fontSize ?? 12) * A4_PREVIEW_SCALE,
    textAlign: element.style?.align || "left",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#0f172a",
    lineHeight: 1.35,
    pointerEvents: "none",
    userSelect: "none",
  };

  const top =
    previewTop != null
      ? previewTop
      : (element.y - yOffset) * A4_PREVIEW_SCALE;

  return (
    <div
      className="absolute"
      style={{
        left: element.x * A4_PREVIEW_SCALE,
        top,
        width: element.width * A4_PREVIEW_SCALE,
        ...(element.type === "image"
          ? { height: element.height * A4_PREVIEW_SCALE, overflow: "hidden" }
          : { minHeight: element.height * A4_PREVIEW_SCALE }),
        zIndex: isTable ? 20 : 1,
        pointerEvents: isTable && !readOnly ? "auto" : "none",
      }}
    >
      {element.type === "image" ? (
        element.imageSrc ? (
          <PdfTemplateImage src={element.imageSrc} />
        ) : null
      ) : element.type === "table" ? (
        <div className="w-full bg-white" style={{ pointerEvents: readOnly ? "none" : "auto" }}>
          <CustomPdfTable
            data={normalizeTableData(element.tableData)}
            fillValues={fillValues}
            onFillChange={onFillChange}
            readOnly={readOnly}
            compact
          />
        </div>
      ) : element.type === "dynamic" ? (
        <div style={textStyle}>{formatDynamicDisplay(element, dynamicCtx, false).full}</div>
      ) : (
        <div style={textStyle}>{element.content || " "}</div>
      )}
    </div>
  );
}

function PdfTemplateImage({ src }: { src: string }) {
  const isRemote = /^https?:\/\//i.test(src);
  const [corsMode, setCorsMode] = React.useState(isRemote);

  return (
    <img
      key={corsMode ? "cors" : "plain"}
      src={src}
      alt=""
      className="pointer-events-none select-none"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
      }}
      draggable={false}
      {...(corsMode ? { crossOrigin: "anonymous" as const } : {})}
      onError={() => {
        if (corsMode) setCorsMode(false);
      }}
    />
  );
}
