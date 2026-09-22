import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { CustomPdfTable } from "@/components/CustomPdfTable";
import {
  createPdfOverlayText,
  GRID_OVERLAYS_KEY,
  overlaysFromFill,
  type PdfOverlayText,
} from "@/api/result";
import {
  A4_PREVIEW_SCALE,
  PDF_CANVAS_FONT_CLASS,
  PDF_FONT_FAMILY,
  PDF_PAGE_GAP_PREVIEW,
  documentYFromPreviewY,
  formatDynamicDisplay,
  getPagePreviewTop,
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
    /** Click PDF to add free text on top (does not edit the template). */
    overlayEdit?: boolean;
    /**
     * Print/export layout: content is nested inside each `[data-pdf-page]`
     * so html2canvas captures real content (edit layout leaves pages empty).
     * Edge-to-edge — no extra top/bottom page margins.
     */
    withMargins?: boolean;
  }
>(function ResultPdfCanvas(
  {
    template,
    fillValues,
    dynamicCtx,
    onFillChange,
    readOnly = false,
    overlayEdit = false,
    withMargins = false,
  },
  ref,
) {
  // Same pagination as on-screen edit preview (full page height, no margin inset).
  const layouts = getTemplatePageLayouts(template, false);
  const width = getPdfPreviewWidth(template, false);
  const height = getPdfPreviewHeight(template, false);
  const overlays = overlaysFromFill(fillValues);
  // Jadval kataklari natija kiritishdagidek ochiq qoladi. Erkin yozuv faqat jadvaldan tashqarida.
  const tableReadOnly = readOnly;
  const innerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<{ id: string; empty: boolean } | null>(null);
  const freshIdRef = useRef<string | null>(null);
  const skipCanvasClickRef = useRef(false);

  const setNode = (node: HTMLDivElement | null) => {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const commitOverlays = (next: PdfOverlayText[]) => {
    onFillChange?.(GRID_OVERLAYS_KEY, JSON.stringify(next));
  };

  const clientToDoc = (clientX: number, clientY: number) => {
    const el = innerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const previewX = (clientX - rect.left) * (el.offsetWidth / rect.width);
    const previewY = (clientY - rect.top) * (el.offsetHeight / rect.height);
    return {
      x: previewX / A4_PREVIEW_SCALE,
      y: documentYFromPreviewY(previewY, layouts, PDF_PAGE_GAP_PREVIEW),
    };
  };

  const addOverlayAt = (clientX: number, clientY: number) => {
    const point = clientToDoc(clientX, clientY);
    if (!point) return;
    const x = Math.max(0, point.x);
    const y = Math.max(0, point.y);
    const session = sessionRef.current;
    if (session && freshIdRef.current === session.id && session.empty) {
      patchOverlay(session.id, { x, y });
      return;
    }
    if (session) return;
    const next = createPdfOverlayText(x, y);
    freshIdRef.current = next.id;
    sessionRef.current = { id: next.id, empty: true };
    commitOverlays([...overlays, next]);
  };

  const patchOverlay = (id: string, patch: Partial<PdfOverlayText>) => {
    commitOverlays(overlays.map(ov => (ov.id === id ? { ...ov, ...patch } : ov)));
  };

  const removeOverlay = (id: string) => {
    commitOverlays(overlays.filter(ov => ov.id !== id));
  };

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
          readOnly={tableReadOnly}
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
        ref={setNode}
        className={`relative shrink-0 ${PDF_CANVAS_FONT_CLASS}`}
        style={{ width, height, fontFamily: PDF_FONT_FAMILY }}
      >
        {layouts.map(page => {
          const pageW = Math.round(page.width * A4_PREVIEW_SCALE);
          const pageH = Math.round(page.height * A4_PREVIEW_SCALE);
          const top = getPagePreviewTop(page, PDF_PAGE_GAP_PREVIEW);
          return (
            <div
              key={page.id}
              data-pdf-page=""
              data-orientation={page.orientation}
              className="absolute left-0 overflow-hidden bg-white shadow-md"
              style={{
                top,
                width: pageW,
                height: pageH,
              }}
            >
              <div className="absolute left-0 top-0" style={{ width: pageW }}>
                {renderElements(`p${page.index}`, page)}
                <OverlayTexts
                  overlays={overlays.filter(ov => overlayIntersectsPage(ov, page))}
                  layouts={layouts}
                  page={page}
                  editable={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={setNode}
      className={`relative bg-transparent shrink-0 ${PDF_CANVAS_FONT_CLASS} ${
        overlayEdit ? "cursor-crosshair" : ""
      }`}
      style={{ width, height, fontFamily: PDF_FONT_FAMILY }}
      onClick={
        overlayEdit
          ? e => {
              if (skipCanvasClickRef.current) {
                skipCanvasClickRef.current = false;
                return;
              }
              const target = e.target as HTMLElement;
              if (target.closest("[data-pdf-overlay]")) return;
              if (target.closest("[data-pdf-table]")) return;
              addOverlayAt(e.clientX, e.clientY);
            }
          : undefined
      }
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
      <OverlayTexts
        overlays={overlays}
        layouts={layouts}
        editable={overlayEdit}
        onChange={overlayEdit ? patchOverlay : undefined}
        onRemove={overlayEdit ? removeOverlay : undefined}
        onSessionChange={
          overlayEdit
            ? session => {
                sessionRef.current = session;
              }
            : undefined
        }
        clientToDoc={overlayEdit ? clientToDoc : undefined}
        onDragEnd={
          overlayEdit
            ? () => {
                skipCanvasClickRef.current = true;
                window.setTimeout(() => {
                  skipCanvasClickRef.current = false;
                }, 0);
              }
            : undefined
        }
      />
    </div>
  );
});

function overlayIntersectsPage(ov: PdfOverlayText, page: PdfPageLayout) {
  const bottom = ov.y + ov.height;
  const pageEnd = page.offsetY + page.height;
  return ov.y < pageEnd && bottom > page.offsetY;
}

/** Input ichki paddingi. Matn boshlanishi konteyner burchagida qoladi. */
const OVERLAY_INPUT_PAD_X = 8;
const OVERLAY_INPUT_PAD_Y = 4;

function OverlayTexts({
  overlays,
  layouts,
  page,
  editable = false,
  onChange,
  onRemove,
  onSessionChange,
  clientToDoc,
  onDragEnd,
}: {
  overlays: PdfOverlayText[];
  layouts: PdfPageLayout[];
  page?: PdfPageLayout;
  editable?: boolean;
  onChange?: (id: string, patch: Partial<PdfOverlayText>) => void;
  onRemove?: (id: string) => void;
  onSessionChange?: (session: { id: string; empty: boolean } | null) => void;
  clientToDoc?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onDragEnd?: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editorHeight, setEditorHeight] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const focusRef = useRef<HTMLTextAreaElement | null>(null);
  const prevLen = useRef(overlays.length);
  const onSessionChangeRef = useRef(onSessionChange);
  const onChangeRef = useRef(onChange);
  const onDragEndRef = useRef(onDragEnd);
  const clientToDocRef = useRef(clientToDoc);
  onSessionChangeRef.current = onSessionChange;
  onChangeRef.current = onChange;
  onDragEndRef.current = onDragEnd;
  clientToDocRef.current = clientToDoc;

  useEffect(() => {
    if (overlays.length > prevLen.current) {
      const last = overlays[overlays.length - 1];
      if (last && !last.content) {
        setActiveId(last.id);
        setDraft("");
        setEditorHeight(null);
      }
    }
    prevLen.current = overlays.length;
  }, [overlays]);

  useEffect(() => {
    if (activeId && !overlays.some(ov => ov.id === activeId)) {
      setActiveId(null);
      setDraft("");
      setEditorHeight(null);
    }
  }, [overlays, activeId]);

  useEffect(() => {
    if (!editable || !activeId) {
      onSessionChangeRef.current?.(null);
      return;
    }
    onSessionChangeRef.current?.({ id: activeId, empty: draft.trim().length === 0 });
  }, [editable, activeId, draft]);

  useEffect(() => {
    if (!activeId || !focusRef.current) return;
    const el = focusRef.current;
    setEditorHeight(el.scrollHeight);
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [activeId]);

  const closeEditor = () => {
    setActiveId(null);
    setDraft("");
    setEditorHeight(null);
    onSessionChangeRef.current?.(null);
  };

  const confirmEdit = (id: string) => {
    const value = draft;
    if (!value.trim()) {
      onRemove?.(id);
      closeEditor();
      return;
    }
    const el = focusRef.current;
    const fontSize = overlays.find(item => item.id === id)?.fontSize ?? 12;
    const contentPx = Math.max(0, (el?.scrollHeight ?? 0) - OVERLAY_INPUT_PAD_Y * 2);
    onChange?.(id, {
      content: value,
      height: Math.max(fontSize * 1.35, contentPx / A4_PREVIEW_SCALE),
    });
    closeEditor();
  };

  const cancelEdit = (id: string) => {
    onRemove?.(id);
    closeEditor();
  };

  const openEditor = (ov: PdfOverlayText) => {
    if (activeId === ov.id) return;
    if (activeId && draft.trim()) return;
    if (activeId) onRemove?.(activeId);
    setActiveId(ov.id);
    setDraft(ov.content);
    setEditorHeight(null);
    onSessionChangeRef.current?.({
      id: ov.id,
      empty: ov.content.trim().length === 0,
    });
  };

  return (
    <>
      {overlays.map(ov => {
        const top = page
          ? (ov.y - page.offsetY) * A4_PREVIEW_SCALE
          : previewYFromDocumentY(ov.y, layouts, PDF_PAGE_GAP_PREVIEW);
        const left = ov.x * A4_PREVIEW_SCALE;
        const width = ov.width * A4_PREVIEW_SCALE;
        const height = ov.height * A4_PREVIEW_SCALE;
        const fontSize = (ov.fontSize ?? 12) * A4_PREVIEW_SCALE;
        const active = editable && activeId === ov.id;
        const dragging = draggingId === ov.id;
        const pageWidth = Math.max(page?.width ?? 0, ...layouts.map(layout => layout.width), 0);
        const buttonsOnLeft = pageWidth > 0 && ov.x + ov.width > pageWidth - 110;
        if (!ov.content && !active) return null;

        const textStyle: React.CSSProperties = {
          fontFamily: PDF_FONT_FAMILY,
          fontSize,
          color: "#0f172a",
          lineHeight: 1.35,
        };

        return (
          <div
            key={ov.id}
            data-pdf-overlay=""
            className="absolute"
            style={{
              left,
              top,
              width,
              minHeight: active ? undefined : height,
              zIndex: active || dragging ? 60 : 45,
              pointerEvents: editable ? "auto" : "none",
            }}
            onClick={e => e.stopPropagation()}
          >
            {active ? (
              <>
                <textarea
                  ref={focusRef}
                  value={draft}
                  placeholder="Yozuv..."
                  rows={1}
                  onKeyDown={e => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelEdit(ov.id);
                    }
                  }}
                  onChange={e => {
                    const el = e.target;
                    const value = el.value;
                    el.style.height = "auto";
                    const next = el.scrollHeight;
                    setDraft(value);
                    setEditorHeight(next);
                    onSessionChangeRef.current?.({
                      id: ov.id,
                      empty: value.trim().length === 0,
                    });
                  }}
                  className="block w-full resize-none rounded-lg border-0 bg-white shadow-[0_0_0_1.5px_#14b8a6] outline-none placeholder:text-slate-400"
                  style={{
                    ...textStyle,
                    boxSizing: "border-box",
                    marginTop: -OVERLAY_INPUT_PAD_Y,
                    marginLeft: -OVERLAY_INPUT_PAD_X,
                    marginRight: -OVERLAY_INPUT_PAD_X,
                    width: `calc(100% + ${OVERLAY_INPUT_PAD_X * 2}px)`,
                    padding: `${OVERLAY_INPUT_PAD_Y}px ${OVERLAY_INPUT_PAD_X}px`,
                    minHeight: Math.max(28, fontSize * 1.35 + OVERLAY_INPUT_PAD_Y * 2),
                    height: editorHeight ?? undefined,
                    cursor: "text",
                  }}
                />
                <div
                  className="absolute flex items-center gap-1.5"
                  style={{
                    top: -OVERLAY_INPUT_PAD_Y,
                    ...(buttonsOnLeft
                      ? { right: `calc(100% + ${OVERLAY_INPUT_PAD_X + 8}px)` }
                      : { left: `calc(100% + ${OVERLAY_INPUT_PAD_X + 8}px)` }),
                  }}
                >
                  <button
                    type="button"
                    title="Saqlash"
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => {
                      e.stopPropagation();
                      confirmEdit(ov.id);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    title="O'chirish"
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => {
                      e.stopPropagation();
                      cancelEdit(ov.id);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow"
                  >
                    <X className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              </>
            ) : (
              <div
                className={`whitespace-pre-wrap break-words ${
                  editable ? "cursor-grab rounded-sm hover:bg-teal-500/10 active:cursor-grabbing" : ""
                }`}
                title={editable ? "Sudrab joyini o'zgartiring. Bosib tahrirlang." : undefined}
                style={{
                  ...textStyle,
                  minHeight: height,
                  touchAction: editable ? "none" : undefined,
                  userSelect: "none",
                }}
                onPointerDown={
                  editable
                    ? e => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        e.preventDefault();
                        const toDoc = clientToDocRef.current;
                        const start = toDoc?.(e.clientX, e.clientY);
                        if (!start) {
                          openEditor(ov);
                          return;
                        }
                        const origX = ov.x;
                        const origY = ov.y;
                        const startClientX = e.clientX;
                        const startClientY = e.clientY;
                        let moved = false;
                        const move = (ev: PointerEvent) => {
                          if (Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) < 4) return;
                          if (!moved) {
                            moved = true;
                            setDraggingId(ov.id);
                          }
                          const next = toDoc?.(ev.clientX, ev.clientY);
                          if (!next) return;
                          onChangeRef.current?.(ov.id, {
                            x: Math.max(0, origX + (next.x - start.x)),
                            y: Math.max(0, origY + (next.y - start.y)),
                          });
                        };
                        const up = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", up);
                          setDraggingId(current => (current === ov.id ? null : current));
                          if (moved) onDragEndRef.current?.();
                          else openEditor(ov);
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }
                    : undefined
                }
              >
                {ov.content}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

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
        <div
          data-pdf-table=""
          className="w-full bg-white"
          style={{ pointerEvents: readOnly ? "none" : "auto", cursor: "auto" }}
          onClick={e => e.stopPropagation()}
        >
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
