import * as React from "react";
import { CustomPdfTable } from "@/components/CustomPdfTable";
import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_SCALE,
  A4_PREVIEW_WIDTH,
  formatDynamicDisplay,
  getPdfPageCount,
  getPdfPageMarginPreview,
  getPdfPreviewHeight,
  getPdfUsablePreviewHeight,
  normalizeTableData,
  type PdfDynamicContext,
  type PdfElement,
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
  }
>(function ResultPdfCanvas(
  { template, fillValues, dynamicCtx, onFillChange, readOnly = false },
  ref,
) {
  // Export / public view: each page has top+bottom margin so splits aren't flush to edges.
  // Edit mode: continuous canvas so inputs stay a single DOM tree.
  const withMargins = readOnly;
  const pageCount = getPdfPageCount(template, withMargins);
  const height = getPdfPreviewHeight(template, withMargins);
  const marginPx = withMargins ? getPdfPageMarginPreview() : 0;
  const usablePx = getPdfUsablePreviewHeight(withMargins);

  const renderElements = (keyPrefix: string) =>
    template.elements.map(el => (
      <FillableElement
        key={`${keyPrefix}-${el.id}`}
        element={el}
        fillValues={fillValues}
        dynamicCtx={dynamicCtx}
        onFillChange={onFillChange}
        readOnly={readOnly}
      />
    ));

  if (withMargins) {
    return (
      <div
        ref={ref}
        className="relative bg-white shrink-0"
        style={{ width: A4_PREVIEW_WIDTH, height }}
      >
        {Array.from({ length: pageCount }, (_, page) => (
          <div
            key={page}
            className="absolute left-0 bg-white"
            style={{
              top: page * A4_PREVIEW_HEIGHT,
              width: A4_PREVIEW_WIDTH,
              height: A4_PREVIEW_HEIGHT,
            }}
          >
            {/* Content window inset by top/bottom margins — edges stay blank */}
            <div
              className="absolute left-0 overflow-hidden"
              style={{
                top: marginPx,
                width: A4_PREVIEW_WIDTH,
                height: usablePx,
              }}
            >
              <div
                className="absolute left-0"
                style={{
                  top: -page * usablePx,
                  width: A4_PREVIEW_WIDTH,
                }}
              >
                {renderElements(`p${page}`)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="relative bg-white shrink-0 shadow-xl border border-slate-200"
      style={{ width: A4_PREVIEW_WIDTH, height }}
    >
      {pageCount > 1 &&
        Array.from({ length: pageCount - 1 }, (_, i) => (
          <div
            key={`break-${i}`}
            data-pdf-page-break=""
            className="absolute left-0 right-0 z-30 pointer-events-none border-t border-dashed border-teal-400/80"
            style={{ top: (i + 1) * A4_PREVIEW_HEIGHT }}
            aria-hidden
          >
            <span className="absolute right-1 -top-2.5 rounded bg-teal-100 px-1.5 py-0.5 text-[8px] font-semibold text-teal-700">
              {i + 2}-sahifa
            </span>
          </div>
        ))}
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
}: {
  element: PdfElement;
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext | null;
  onFillChange?: (key: string, value: string) => void;
  readOnly?: boolean;
}) {
  const isTable = element.type === "table";

  const textStyle: React.CSSProperties = {
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

  return (
    <div
      className="absolute"
      style={{
        left: element.x * A4_PREVIEW_SCALE,
        top: element.y * A4_PREVIEW_SCALE,
        width: element.width * A4_PREVIEW_SCALE,
        // Images must keep the exact template box size (minHeight lets them grow).
        ...(element.type === "image"
          ? { height: element.height * A4_PREVIEW_SCALE, overflow: "hidden" }
          : { minHeight: element.height * A4_PREVIEW_SCALE }),
        zIndex: isTable ? 20 : 1,
        pointerEvents: isTable && !readOnly ? "auto" : "none",
      }}
    >
      {element.type === "image" ? (
        element.imageSrc ? (
          <img
            src={element.imageSrc}
            alt=""
            className="pointer-events-none select-none"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
            draggable={false}
            crossOrigin="anonymous"
          />
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
