import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  A4_PREVIEW_SCALE,
  MAX_TABLE_ROW_PT,
  MIN_TABLE_ROW_PT,
  bodyCellKey,
  headerCellKey,
  isDynamicCell,
  isInSelection,
  normalizeCellRotate,
  normalizeCellValueMode,
  normalizeTableData,
  PDF_FONT_FAMILY,
  resizeAdjacentColWidths,
  type PdfCellRotate,
  type PdfCellValueMode,
  type PdfTableCell,
  type PdfTableData,
  type PdfTableSelection,
} from "@/lib/pdfTemplate";

export type CustomPdfTableProps = {
  data: PdfTableData;
  /** Template editor: edit header cells */
  editableHeader?: boolean;
  /** Template editor: edit body cells manually */
  editableBody?: boolean;
  /** Template editor: show value-mode dropdown on cells */
  showValueModeMenu?: boolean;
  selection?: PdfTableSelection | null;
  onSelectHeaderCell?: (row: number, col: number, shiftKey: boolean) => void;
  onSelectBodyCell?: (row: number, col: number, shiftKey: boolean) => void;
  onChangeHeaderCell?: (row: number, col: number, patch: Partial<PdfTableCell>) => void;
  onChangeBodyCell?: (row: number, col: number, patch: Partial<PdfTableCell>) => void;
  /** Results: overlay values keyed by bodyCellKey / headerCellKey — only dynamic cells */
  fillValues?: Record<string, string>;
  onFillChange?: (key: string, value: string) => void;
  /** Export/print: show values as text instead of inputs */
  readOnly?: boolean;
  compact?: boolean;
  /** Drag handles between columns to change widths */
  resizableColumns?: boolean;
  onColWidthsChange?: (widths: number[]) => void;
  /** Drag handles on row edges to change heights */
  resizableRows?: boolean;
  onRowHeightsChange?: (section: "header" | "body", heights: number[]) => void;
  className?: string;
};

/** @deprecated use bodyCellKey */
export function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function rotatedBlockSize(text: string, compact?: boolean) {
  const len = Math.max(text.trim().length, 3);
  const char = compact ? 4.8 : 6.4;
  return Math.round(Math.min(220, Math.max(compact ? 34 : 46, len * char + 12)));
}

function verticalWrapStyle(rotate: 90 | 270, wrapWidth: number): CSSProperties {
  return {
    width: wrapWidth,
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
    transformOrigin: "center center",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    lineHeight: 1.15,
    textAlign: "center",
  };
}

/** Aylantirilgan matn: berilgan balandlik = satr uzunligi, ortiqchasi yon qatorlarga tushadi */
function WrappedRotatedText({
  text,
  rotate,
  boxPx,
  compact,
  placeholder,
  className = "",
  onChange,
  onMouseDown,
}: {
  text: string;
  rotate: 90 | 270;
  boxPx: number;
  compact?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (value: string) => void;
  onMouseDown?: (e: ReactMouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapWidth = Math.max(8, boxPx - (compact ? 2 : 4));
  const style = verticalWrapStyle(rotate, wrapWidth);

  const editable = Boolean(onChange);
  useEffect(() => {
    if (!editable) return;
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const next = text ?? "";
    const current = (el.innerText ?? "").replace(/\n$/, "");
    if (current !== next) el.innerText = next;
  }, [editable, text]);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: boxPx }}>
      {onChange ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          data-placeholder={placeholder || undefined}
          className={`pdf-wrap-edit absolute left-1/2 top-1/2 outline-none ${className}`}
          style={style}
          onMouseDown={e => {
            e.stopPropagation();
            onMouseDown?.(e);
          }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onPaste={e => {
            e.preventDefault();
            const plain = e.clipboardData.getData("text/plain");
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            sel.deleteFromDocument();
            sel.getRangeAt(0).insertNode(document.createTextNode(plain));
            sel.collapseToEnd();
            onChange((e.currentTarget.innerText ?? "").replace(/\n$/, ""));
          }}
          onInput={e => onChange((e.currentTarget.innerText ?? "").replace(/\n$/, ""))}
        />
      ) : (
        <div className={`absolute left-1/2 top-1/2 ${className}`} style={style}>
          {text || "\u00a0"}
        </div>
      )}
    </div>
  );
}

/** Katak ichidagi matnni saqlangan burchakda ko'rsatadi */
function CellContent({
  rotate,
  text,
  compact,
  fixedHeight,
  placeholder,
  className,
  onTextChange,
  onMouseDown,
  children,
}: {
  rotate: PdfCellRotate;
  text: string;
  compact?: boolean;
  /** Preview px. Vertical rotate shu balandlikka sig'dirish uchun qatorlarga bo'linadi */
  fixedHeight?: number;
  placeholder?: string;
  className?: string;
  onTextChange?: (value: string) => void;
  onMouseDown?: (e: ReactMouseEvent) => void;
  children: ReactNode;
}) {
  if (rotate === 90 || rotate === 270) {
    if (fixedHeight != null && fixedHeight > 0) {
      return (
        <WrappedRotatedText
          text={text}
          rotate={rotate}
          boxPx={fixedHeight}
          compact={compact}
          placeholder={placeholder}
          className={className}
          onChange={onTextChange}
          onMouseDown={onMouseDown}
        />
      );
    }
  }
  if (rotate === 0) return <>{children}</>;
  const vertical = rotate === 90 || rotate === 270;
  const sizingText = text.trim() ? text : placeholder || " ";
  const size = vertical ? rotatedBlockSize(sizingText, compact) : undefined;
  return (
    <div
      className="w-full min-w-0 overflow-hidden flex items-center justify-center"
      style={size ? { height: size, minHeight: size } : undefined}
    >
      <div
        style={{
          transform: `rotate(${rotate}deg)`,
          transformOrigin: "center center",
          whiteSpace: "nowrap",
          lineHeight: 1.15,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CellValueModeButton({
  mode,
  compact,
  open,
  onToggle,
  onSelect,
}: {
  mode: PdfCellValueMode;
  compact?: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: (mode: PdfCellValueMode) => void;
}) {
  const dynamic = mode === "dynamic";
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const menuW = 132;
      const menuH = 56;
      let left = r.right - menuW;
      let top = r.bottom + 2;
      if (left < 8) left = 8;
      if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
      if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 2;
      setPos({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <div className="relative shrink-0 self-stretch flex items-center">
      <button
        ref={btnRef}
        type="button"
        title={dynamic ? "O'zgaradigan qiymat" : "O'zgarmaydigan qiymat"}
        onClick={e => {
          e.stopPropagation();
          onToggle();
        }}
        onMouseDown={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        className={`flex items-center justify-center h-full border-l border-black/20 hover:bg-black/5 ${
          compact ? "w-3.5 min-w-[14px]" : "w-5 min-w-[20px]"
        } ${dynamic ? "text-amber-600 bg-amber-50/80" : "text-slate-500 bg-slate-100/80"}`}
      >
        <ChevronDown className={compact ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} strokeWidth={2.5} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="fixed z-[9999] w-[132px] rounded-md border border-slate-200 bg-white shadow-md py-0.5"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onSelect("dynamic")}
              className={`w-full px-2 py-1 text-[10px] leading-tight text-left hover:bg-amber-50 ${
                dynamic ? "font-semibold text-amber-700 bg-amber-50/70" : "text-slate-700"
              }`}
            >
              O&apos;zgaradigan
            </button>
            <button
              type="button"
              onClick={() => onSelect("static")}
              className={`w-full px-2 py-1 text-[10px] leading-tight text-left hover:bg-slate-50 ${
                !dynamic ? "font-semibold text-slate-800 bg-slate-50" : "text-slate-700"
              }`}
            >
              O&apos;zgarmaydigan
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Header + manual body grid; optional column resize and result fill overlay */
export function CustomPdfTable({
  data,
  editableHeader = false,
  editableBody = false,
  showValueModeMenu = false,
  selection = null,
  onSelectHeaderCell,
  onChangeHeaderCell,
  onChangeBodyCell,
  onSelectBodyCell,
  fillValues,
  onFillChange,
  readOnly = false,
  compact = false,
  resizableColumns = false,
  onColWidthsChange,
  resizableRows = false,
  onRowHeightsChange,
  className = "",
}: CustomPdfTableProps) {
  const grid = normalizeTableData(data);
  const tableRef = useRef<HTMLTableElement>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuKey) return;
    const close = () => setOpenMenuKey(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuKey]);

  const fs = compact ? "text-[8px]" : "text-[11px]";
  const pad = compact ? "px-1 py-0.5" : "px-2 py-1.5";
  const inputCls = compact
    ? "w-full min-h-[14px] text-center bg-transparent border-0 outline-none text-[8px] text-black"
    : "w-full min-h-[22px] text-center bg-transparent border-0 outline-none text-[11px] text-black";

  const filling = fillValues != null;
  const cellBorder = readOnly ? "align-middle" : `border border-black align-middle`;
  const cellBorderStyle: CSSProperties | undefined = readOnly
    ? { border: "1px solid #000", boxSizing: "border-box" }
    : undefined;
  /** Natija kiritilgan yacheyka — och havorang */
  const filledCellBg = "bg-sky-100";
  const tableStyle: CSSProperties = {
    tableLayout: "fixed",
    borderCollapse: "collapse",
    borderSpacing: 0,
    width: "100%",
    fontFamily: PDF_FONT_FAMILY,
    ...(readOnly ? { border: "none" } : {}),
  };

  const startColResize = (leftCol: number, e: ReactPointerEvent) => {
    if (!resizableColumns || !onColWidthsChange) return;
    e.preventDefault();
    e.stopPropagation();
    const table = tableRef.current;
    if (!table) return;
    const tableWidth = table.getBoundingClientRect().width || 1;
    const startX = e.clientX;
    const startWidths = [...grid.colWidths];
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const deltaPct = ((ev.clientX - startX) / tableWidth) * 100;
      onColWidthsChange(resizeAdjacentColWidths(startWidths, leftCol, deltaPct));
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const colResizeHandle = (ci: number, span: number) => {
    if (!resizableColumns || !onColWidthsChange) return null;
    const rightEdge = ci + span - 1;
    if (rightEdge >= grid.cols - 1) return null;
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        title="Ustun kengligini o'zgartirish"
        onPointerDown={e => startColResize(rightEdge, e)}
        onMouseDown={e => e.stopPropagation()}
        className="absolute top-0 right-0 z-20 w-1.5 h-full cursor-col-resize hover:bg-teal-400/70 active:bg-teal-500"
        style={{ transform: "translateX(50%)" }}
      />
    );
  };

  /** Explicit row span height in preview px, or undefined when every spanned row is auto. */
  const spanHeightPx = (section: "header" | "body", row: number, span: number) => {
    const heights = section === "header" ? grid.headerRowHeights : grid.bodyRowHeights;
    const fallback = section === "header" ? 26 : 24;
    let explicit = false;
    let sum = 0;
    for (let i = 0; i < span; i++) {
      const h = Number(heights[row + i]) || 0;
      if (h > 0) {
        explicit = true;
        sum += h;
      } else {
        sum += fallback;
      }
    }
    if (!explicit) return undefined;
    return Math.max(8, Math.round(sum * A4_PREVIEW_SCALE));
  };

  const startRowResize = (
    section: "header" | "body",
    rowIndex: number,
    e: ReactPointerEvent,
  ) => {
    if (!resizableRows || !onRowHeightsChange) return;
    e.preventDefault();
    e.stopPropagation();
    const heights =
      section === "header" ? [...grid.headerRowHeights] : [...grid.bodyRowHeights];
    const tr = tableRef.current?.querySelector<HTMLElement>(
      `tr[data-pdf-section="${section}"][data-pdf-row="${rowIndex}"]`,
    );
    const startPx = tr?.getBoundingClientRect().height || (section === "header" ? 22 : 20);
    const startY = e.clientY;
    const startPt = heights[rowIndex] > 0 ? heights[rowIndex] : startPx / A4_PREVIEW_SCALE;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const nextPt = Math.max(
        MIN_TABLE_ROW_PT,
        Math.min(MAX_TABLE_ROW_PT, startPt + (ev.clientY - startY) / A4_PREVIEW_SCALE),
      );
      const copy = [...heights];
      copy[rowIndex] = Math.round(nextPt * 10) / 10;
      onRowHeightsChange(section, copy);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const rowResizeHandle = (section: "header" | "body", rowIndex: number) => {
    if (!resizableRows || !onRowHeightsChange) return null;
    const count = section === "header" ? grid.headerRows : grid.bodyRows;
    if (rowIndex < 0 || rowIndex >= count) return null;
    return (
      <span
        role="separator"
        aria-orientation="horizontal"
        title="Qator balandligini o'zgartirish"
        onPointerDown={e => startRowResize(section, rowIndex, e)}
        onMouseDown={e => e.stopPropagation()}
        className="absolute left-0 bottom-0 z-20 h-1.5 w-full cursor-row-resize hover:bg-teal-400/70 active:bg-teal-500"
        style={{ transform: "translateY(50%)" }}
      />
    );
  };

  const fieldClass = (rotate: PdfCellRotate, extra = "") =>
    rotate
      ? `${compact ? "min-h-[14px] text-[8px]" : "min-h-[22px] text-[11px]"} text-center bg-transparent border-0 outline-none text-black px-0.5 ${extra}`
      : `${inputCls} px-1 ${extra}`;

  const fieldStyle = (rotate: PdfCellRotate, text: string): CSSProperties | undefined =>
    rotate ? { width: `${Math.max(4, (text.trim().length || 6) + 1)}ch` } : undefined;

  const modeBtn = (
    menuKey: string,
    cell: PdfTableCell,
    onMode: (mode: PdfCellValueMode) => void,
  ) => {
    if (!showValueModeMenu) return null;
    const mode = normalizeCellValueMode(cell.valueMode);
    return (
      <CellValueModeButton
        mode={mode}
        compact={compact}
        open={openMenuKey === menuKey}
        onToggle={() => setOpenMenuKey(prev => (prev === menuKey ? null : menuKey))}
        onSelect={next => {
          onMode(next);
          setOpenMenuKey(null);
        }}
      />
    );
  };

  return (
    <table
      ref={tableRef}
      className={`w-full border-collapse bg-white text-black ${fs} ${className} ${
        readOnly ? "" : "border border-black"
      }`}
      style={tableStyle}
    >
      <colgroup>
        {grid.colWidths.map((w, i) => (
          <col key={i} style={{ width: `${w}%` }} />
        ))}
      </colgroup>
      <thead>
        {grid.headerCells.map((row, ri) => (
          <tr key={`h-${ri}`} data-pdf-section="header" data-pdf-row={ri}>
            {row.map((cell, ci) => {
              if (cell.covered) return null;
              const cs = cell.colSpan ?? 1;
              const rs = cell.rowSpan ?? 1;
              const dynamic = isDynamicCell(cell);
              const menuKey = `h:${ri}:${ci}`;
              const rot = normalizeCellRotate(cell.rotate);
              const boxPx = spanHeightPx("header", ri, rs);
              const cellStyle: CSSProperties | undefined = {
                ...cellBorderStyle,
                ...(!boxPx && rot ? { overflow: "hidden" } : {}),
                ...(boxPx ? { height: boxPx, maxHeight: boxPx, padding: 0 } : {}),
              };
              const frameStyle: CSSProperties | undefined = boxPx
                ? { height: boxPx, maxHeight: boxPx, overflow: "hidden" }
                : undefined;

              if (editableHeader) {
                const highlighted =
                  selection?.section === "header"
                    ? (() => {
                        for (let r = ri; r < ri + rs; r++) {
                          for (let c = ci; c < ci + cs; c++) {
                            if (isInSelection(r, c, selection)) return true;
                          }
                        }
                        return false;
                      })()
                    : false;

                return (
                  <th
                    key={ci}
                    colSpan={cs}
                    rowSpan={rs}
                    style={cellStyle}
                    className={`${cellBorder} ${pad} p-0 font-semibold relative ${
                      highlighted
                        ? "outline outline-2 outline-offset-[-2px] outline-teal-500 bg-teal-100"
                        : dynamic
                          ? "bg-amber-50/70"
                          : "bg-slate-50"
                    }`}
                    onMouseDown={e => {
                      e.stopPropagation();
                      onSelectHeaderCell?.(ri, ci, e.shiftKey);
                    }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <div className="flex items-stretch w-full min-h-0" style={frameStyle}>
                      <div className="flex-1 min-w-0">
                        <CellContent
                          rotate={rot}
                          text={cell.text}
                          compact={compact}
                          fixedHeight={boxPx}
                          placeholder={dynamic ? "Natijada..." : "Sarlavha..."}
                          className="font-semibold"
                          onMouseDown={e => {
                            e.stopPropagation();
                            onSelectHeaderCell?.(ri, ci, e.shiftKey);
                          }}
                          onTextChange={
                            dynamic
                              ? undefined
                              : value => onChangeHeaderCell?.(ri, ci, { text: value })
                          }
                        >
                          {dynamic ? (
                            <input
                              value={cell.text}
                              readOnly
                              tabIndex={-1}
                              onMouseDown={e => {
                                e.stopPropagation();
                                onSelectHeaderCell?.(ri, ci, e.shiftKey);
                              }}
                              onClick={e => e.stopPropagation()}
                              className={fieldClass(
                                rot,
                                "font-semibold text-slate-400 cursor-default",
                              )}
                              style={fieldStyle(rot, cell.text || "Natijada")}
                              placeholder="Natijada..."
                              title="Bu katak faqat Natijalar sahifasida tahrirlanadi"
                            />
                          ) : (
                            <input
                              value={cell.text}
                              onChange={e => onChangeHeaderCell?.(ri, ci, { text: e.target.value })}
                              onMouseDown={e => {
                                e.stopPropagation();
                                onSelectHeaderCell?.(ri, ci, e.shiftKey);
                              }}
                              onClick={e => e.stopPropagation()}
                              className={fieldClass(rot, "font-semibold")}
                              style={fieldStyle(rot, cell.text || "Sarlavha")}
                              placeholder="Sarlavha..."
                            />
                          )}
                        </CellContent>
                      </div>
                      {modeBtn(menuKey, cell, valueMode =>
                        onChangeHeaderCell?.(ri, ci, { valueMode }),
                      )}
                    </div>
                    {colResizeHandle(ci, cs)}
                    {rowResizeHandle("header", ri + rs - 1)}
                  </th>
                );
              }

              // Results: dynamic header can be filled (yoki saqlangan fill mavjud)
              if (filling) {
                const key = headerCellKey(ri, ci);
                const hasFill = Object.prototype.hasOwnProperty.call(fillValues ?? {}, key);
                if (dynamic || (readOnly && hasFill)) {
                  const value = hasFill
                    ? String(fillValues?.[key] ?? "")
                    : (cell.text ?? "");
                  const hasContent = value.trim() !== "";
                  if (readOnly) {
                    return (
                      <th
                        key={ci}
                        colSpan={cs}
                        rowSpan={rs}
                        style={cellStyle}
                        className={`${cellBorder} ${pad} font-semibold text-center relative ${
                          hasContent ? filledCellBg : "bg-slate-50"
                        }`}
                      >
                        <div style={frameStyle}>
                          <CellContent
                            rotate={rot}
                            text={value}
                            compact={compact}
                            fixedHeight={boxPx}
                            className="font-semibold"
                          >
                            {value || "\u00a0"}
                          </CellContent>
                        </div>
                      </th>
                    );
                  }
                  return (
                    <th
                      key={ci}
                      colSpan={cs}
                      rowSpan={rs}
                      style={cellStyle}
                      className={`${cellBorder} ${pad} p-0 font-semibold text-center ${
                        hasContent ? filledCellBg : "bg-amber-50/40"
                      }`}
                    >
                      <div style={frameStyle}>
                        <CellContent
                          rotate={rot}
                          text={value}
                          compact={compact}
                          fixedHeight={boxPx}
                          placeholder="Kiriting..."
                          className="font-semibold"
                          onTextChange={next => onFillChange?.(key, next)}
                        >
                          <input
                            value={value}
                            onChange={e => onFillChange?.(key, e.target.value)}
                            className={fieldClass(rot, "font-semibold")}
                            style={fieldStyle(rot, value || "Kiriting")}
                            onClick={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                            placeholder="Kiriting..."
                          />
                        </CellContent>
                      </div>
                    </th>
                  );
                }
              }

              return (
                <th
                  key={ci}
                  colSpan={cs}
                  rowSpan={rs}
                  style={cellStyle}
                  className={`${cellBorder} ${pad} font-semibold text-center bg-slate-50 relative`}
                >
                  <div style={frameStyle}>
                    <CellContent
                      rotate={rot}
                      text={cell.text}
                      compact={compact}
                      fixedHeight={boxPx}
                      className="font-semibold"
                    >
                      {cell.text || "\u00a0"}
                    </CellContent>
                  </div>
                  {colResizeHandle(ci, cs)}
                  {rowResizeHandle("header", ri + rs - 1)}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {grid.bodyRows === 0 ? (
          <tr>
            <td
              colSpan={grid.cols}
              style={cellBorderStyle}
              className={`${cellBorder} ${pad} text-center text-slate-400`}
            >
              Body qatorlari yo&apos;q — panelda qo&apos;shing
            </td>
          </tr>
        ) : (
          grid.bodyCells.map((row, ri) => (
            <tr key={`b-${ri}`} data-pdf-section="body" data-pdf-row={ri}>
              {row.map((cell, ci) => {
                if (cell.covered) return null;
                const cs = cell.colSpan ?? 1;
                const rs = cell.rowSpan ?? 1;
                const dynamic = isDynamicCell(cell);
                const menuKey = `b:${ri}:${ci}`;
                const rot = normalizeCellRotate(cell.rotate);
                const boxPx = spanHeightPx("body", ri, rs);
                const cellStyle: CSSProperties | undefined = {
                  ...cellBorderStyle,
                  ...(!boxPx && rot ? { overflow: "hidden" } : {}),
                  ...(boxPx ? { height: boxPx, maxHeight: boxPx, padding: 0 } : {}),
                };
                const frameStyle: CSSProperties | undefined = boxPx
                  ? { height: boxPx, maxHeight: boxPx, overflow: "hidden" }
                  : undefined;

                if (editableBody) {
                  const highlighted =
                    selection?.section === "body"
                      ? (() => {
                          for (let r = ri; r < ri + rs; r++) {
                            for (let c = ci; c < ci + cs; c++) {
                              if (isInSelection(r, c, selection)) return true;
                            }
                          }
                          return false;
                        })()
                      : false;

                  return (
                    <td
                      key={ci}
                      colSpan={cs}
                      rowSpan={rs}
                      style={cellStyle}
                      className={`${cellBorder} ${pad} text-center p-0 relative ${
                        highlighted
                          ? "outline outline-2 outline-offset-[-2px] outline-teal-500 bg-teal-100"
                          : dynamic
                            ? "bg-amber-50/50"
                            : ""
                      }`}
                      onMouseDown={e => {
                        e.stopPropagation();
                        onSelectBodyCell?.(ri, ci, e.shiftKey);
                      }}
                      onPointerDown={e => e.stopPropagation()}
                    >
                      <div className="flex items-stretch w-full min-h-0" style={frameStyle}>
                        <div className="flex-1 min-w-0">
                          <CellContent
                            rotate={rot}
                            text={cell.text}
                            compact={compact}
                            fixedHeight={boxPx}
                            placeholder={dynamic ? "Natijada to'ldiriladi..." : "..."}
                            onMouseDown={e => {
                              e.stopPropagation();
                              onSelectBodyCell?.(ri, ci, e.shiftKey);
                            }}
                            onTextChange={
                              dynamic
                                ? undefined
                                : value => onChangeBodyCell?.(ri, ci, { text: value })
                            }
                          >
                            {dynamic ? (
                              <input
                                value={cell.text}
                                readOnly
                                tabIndex={-1}
                                onMouseDown={e => {
                                  e.stopPropagation();
                                  onSelectBodyCell?.(ri, ci, e.shiftKey);
                                }}
                                onClick={e => e.stopPropagation()}
                                className={fieldClass(rot, "text-slate-400 cursor-default")}
                                style={fieldStyle(rot, cell.text || "Natijada")}
                                placeholder="Natijada to'ldiriladi..."
                                title="Bu katak faqat Natijalar sahifasida tahrirlanadi"
                              />
                            ) : (
                              <input
                                value={cell.text}
                                onChange={e => onChangeBodyCell?.(ri, ci, { text: e.target.value })}
                                onMouseDown={e => {
                                  e.stopPropagation();
                                  onSelectBodyCell?.(ri, ci, e.shiftKey);
                                }}
                                onClick={e => e.stopPropagation()}
                                className={fieldClass(rot)}
                                style={fieldStyle(rot, cell.text || "...")}
                                placeholder="..."
                              />
                            )}
                          </CellContent>
                        </div>
                        {modeBtn(menuKey, cell, valueMode =>
                          onChangeBodyCell?.(ri, ci, { valueMode }),
                        )}
                      </div>
                      {ri === 0 ? colResizeHandle(ci, cs) : null}
                      {rowResizeHandle("body", ri + rs - 1)}
                    </td>
                  );
                }

                if (filling) {
                  const key = bodyCellKey(ri, ci);
                  const hasFill = Object.prototype.hasOwnProperty.call(fillValues ?? {}, key);
                  if (dynamic || (readOnly && hasFill)) {
                    const value = hasFill
                      ? String(fillValues?.[key] ?? "")
                      : (cell.text ?? "");
                    const hasContent = value.trim() !== "";
                    if (readOnly) {
                      return (
                        <td
                          key={ci}
                          colSpan={cs}
                          rowSpan={rs}
                          style={cellStyle}
                          className={`${cellBorder} ${pad} text-center relative ${
                            hasContent ? filledCellBg : ""
                          }`}
                        >
                          <div style={frameStyle}>
                            <CellContent
                              rotate={rot}
                              text={value}
                              compact={compact}
                              fixedHeight={boxPx}
                            >
                              {value || "\u00a0"}
                            </CellContent>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={ci}
                        colSpan={cs}
                        rowSpan={rs}
                        style={cellStyle}
                        className={`${cellBorder} ${pad} text-center p-0 ${
                          hasContent ? filledCellBg : ""
                        }`}
                      >
                        <div style={frameStyle}>
                          <CellContent
                            rotate={rot}
                            text={value}
                            compact={compact}
                            fixedHeight={boxPx}
                            placeholder="Kiriting..."
                            onTextChange={next => onFillChange?.(key, next)}
                          >
                            <input
                              value={value}
                              onChange={e => onFillChange?.(key, e.target.value)}
                              className={fieldClass(rot)}
                              style={fieldStyle(rot, value || "Kiriting")}
                              onClick={e => e.stopPropagation()}
                              onPointerDown={e => e.stopPropagation()}
                              placeholder="Kiriting..."
                            />
                          </CellContent>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={ci}
                      colSpan={cs}
                      rowSpan={rs}
                      style={cellStyle}
                      className={`${cellBorder} ${pad} text-center relative`}
                    >
                      <div style={frameStyle}>
                        <CellContent
                          rotate={rot}
                          text={cell.text}
                          compact={compact}
                          fixedHeight={boxPx}
                        >
                          {cell.text || "\u00a0"}
                        </CellContent>
                      </div>
                    </td>
                  );
                }

                return (
                  <td
                    key={ci}
                    colSpan={cs}
                    rowSpan={rs}
                    style={cellStyle}
                    className={`${cellBorder} ${pad} text-center relative`}
                  >
                    <div style={frameStyle}>
                      <CellContent
                        rotate={rot}
                        text={cell.text}
                        compact={compact}
                        fixedHeight={boxPx}
                      >
                        {cell.text || "\u00a0"}
                      </CellContent>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
