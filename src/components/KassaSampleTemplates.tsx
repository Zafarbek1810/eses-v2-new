import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import {
  getPdfPreviewHeight,
  getPdfPreviewWidth,
  listPdfTemplatesForAnalysis,
  resolveStoredCompanyDynamic,
  type PdfCompanyDynamicFields,
  type PdfDynamicContext,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

export type KassaSampleCartItem = {
  key: string;
  analysis_id: number;
  analysis_name: string;
  laboratory_name: string;
};

export function KassaSampleTemplates({
  items,
  primaryColor,
  organizationName,
  templates,
  loading,
  selectedByKey,
  fillByKey,
  onSelectTemplate,
  onFillChange,
}: {
  items: KassaSampleCartItem[];
  primaryColor: string;
  organizationName: string;
  templates: PdfTemplate[];
  loading: boolean;
  selectedByKey: Record<string, string>;
  fillByKey: Record<string, Record<string, string>>;
  onSelectTemplate: (itemKey: string, templateId: string) => void;
  onFillChange: (itemKey: string, cellKey: string, value: string) => void;
}) {
  const [company, setCompany] = useState<PdfCompanyDynamicFields | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveStoredCompanyDynamic()
      .then(next => {
        if (!cancelled) setCompany(next);
      })
      .catch(() => {
        if (!cancelled) setCompany(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-[14px] font-semibold text-foreground">PDF shablonlar</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Har bir analiz uchun shablonni tanlang, so&apos;ng PDF ustiga yozuv qo&apos;shing. Buyurtma yaratilganda yozuvlar saqlanadi.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Shablonlar yuklanmoqda...
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map(item => {
            const tpls = listPdfTemplatesForAnalysis(item.analysis_id, templates);
            const selectedId = selectedByKey[item.key];
            const selectedTpl = tpls.find(t => t.id === selectedId) ?? null;
            const fillValues = fillByKey[item.key] ?? {};
            const ctx: PdfDynamicContext = {
              ...(company ?? {}),
              patientFullName: organizationName.trim() || null,
              analysisName: item.analysis_name,
              laboratoryName: item.laboratory_name !== "—" ? item.laboratory_name : null,
            };

            return (
              <div key={item.key} className="space-y-3">
                <div className="px-5 pt-5 space-y-3">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{item.analysis_name}</p>
                    <p className="text-[11px] text-muted-foreground">{item.laboratory_name}</p>
                  </div>

                  {tpls.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">
                      Bu analiz uchun PDF shablon topilmadi
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tpls.map(tpl => {
                        const active = tpl.id === selectedId;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => onSelectTemplate(item.key, tpl.id)}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                              active
                                ? "text-white border-transparent"
                                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                            }`}
                            style={active ? { background: primaryColor } : undefined}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {tpl.name || "Shablon"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedTpl ? (
                  <div className="border-t border-border overflow-hidden bg-secondary/40">
                    <div className="px-5 py-2 border-b border-border bg-card/80">
                      <p className="text-[12px] font-semibold text-foreground">{selectedTpl.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedTpl.elements.some(el => el.type === "table")
                          ? "Jadval katagiga bosing va shu katakka yozing. Jadvaldan tashqariga bosing — yozuv shu joyda ochiladi. ✓ saqlaydi, ✕ o‘chiradi. Saqlangan yozuvni sudrab joyini o‘zgartiring."
                          : "PDF ustiga bosing — yozuv aynan shu joyda ochiladi. ✓ saqlaydi, ✕ o‘chiradi. Saqlangan yozuvni sudrab joyini o‘zgartiring."}
                      </p>
                    </div>
                    <SamplePdfStage
                      template={selectedTpl}
                      fillValues={fillValues}
                      dynamicCtx={ctx}
                      onFillChange={(key, value) => onFillChange(item.key, key, value)}
                    />
                  </div>
                ) : tpls.length > 0 ? (
                  <p className="px-5 pb-5 text-[12px] text-muted-foreground">
                    Yozuv qo&apos;shish uchun yuqoridan shablonni tanlang
                  </p>
                ) : (
                  <div className="pb-5" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SamplePdfStage({
  template,
  fillValues,
  dynamicCtx,
  onFillChange,
}: {
  template: PdfTemplate;
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext;
  onFillChange: (key: string, value: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);
  const previewWidth = getPdfPreviewWidth(template);
  const previewHeight = getPdfPreviewHeight(template);
  const zoom = previewWidth > 0 && wrapW > 0 ? wrapW / previewWidth : 1;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWrapW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="w-full overflow-auto ses-scrollbar max-h-[min(80vh,920px)]">
      <div
        className="w-full"
        style={{
          height: previewHeight * zoom,
        }}
      >
        <div
          style={{
            width: previewWidth,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <ResultPdfCanvas
            template={template}
            fillValues={fillValues}
            dynamicCtx={dynamicCtx}
            overlayEdit
            onFillChange={onFillChange}
          />
        </div>
      </div>
    </div>
  );
}
