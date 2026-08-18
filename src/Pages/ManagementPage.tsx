import * as React from "react";
import { useState } from "react";
import { Shield, Users, FlaskConical, TestTube2, FileType, Globe } from "lucide-react";
import { RolesSection } from "./management/RolesSection";
import { UsersSection } from "./management/UsersSection";
import { LaboratoriesSection } from "./management/LaboratoriesSection";
import { AnalysesSection } from "./management/AnalysesSection";
import { PatternsSection } from "./management/PatternsSection";
import { PdfTemplateSection } from "./management/PdfTemplateSection";
import { GlobalPdfTemplateSection } from "./management/GlobalPdfTemplateSection";
import {
  BaseAnalysesSection,
  BaseLaboratoriesSection,
} from "./management/BaseCatalogSections";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { PdfTemplate } from "@/lib/pdfTemplate";
import type { Analysis } from "@/api/analysis";
import { analysisHasOnlineStorage } from "@/api/analysis";
import type { PdfOpenForAnalysis } from "./management/PdfTemplateSection";

type TabId =
  | "roles"
  | "users"
  | "laboratories"
  | "analyses"
  | "baseLaboratories"
  | "baseAnalyses"
  | "patterns"
  | "pdf"
  | "globalPdf";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "roles", label: "Rollar", icon: Shield },
  { id: "users", label: "Foydalanuvchilar", icon: Users },
  { id: "laboratories", label: "Laboratoriyalar", icon: FlaskConical },
  { id: "analyses", label: "Analizlar", icon: TestTube2 },
  { id: "baseLaboratories", label: "Global laboratoriyalar", icon: Globe },
  { id: "baseAnalyses", label: "Global analizlar", icon: Globe },
  // { id: "patterns", label: "Analiz shablonlari", icon: LayoutTemplate },
  { id: "pdf", label: "PDF shablon", icon: FileType },
  { id: "globalPdf", label: "Global PDF shablon", icon: Globe },
];

export function ManagementPage({ primaryColor }: { primaryColor: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("roles");
  const [pdfImport, setPdfImport] = useState<PdfTemplate | null>(null);
  const [pdfOpenForAnalysis, setPdfOpenForAnalysis] = useState<PdfOpenForAnalysis | null>(null);

  const openPdfForAnalysis = (item: Analysis) => {
    setPdfOpenForAnalysis({
      id: item.id,
      name: item.name,
      laboratoryId: item.laboratory?.id ?? null,
      hasTemplate: analysisHasOnlineStorage(item),
    });
    setActiveTab("pdf");
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-xl border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] overflow-hidden">
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-border overflow-x-auto bg-secondary/20">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" style={active ? { color: primaryColor } : undefined} />
                {tab.label}
                {active && (
                  <span
                    className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full"
                    style={{ background: primaryColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "roles" && <RolesSection primaryColor={primaryColor} />}
      {activeTab === "users" && <UsersSection primaryColor={primaryColor} />}
      {activeTab === "laboratories" && <LaboratoriesSection primaryColor={primaryColor} />}
      {activeTab === "analyses" && (
        <ErrorBoundary fallbackTitle="Analizlar bo'limida xatolik">
          <AnalysesSection
            primaryColor={primaryColor}
            onOpenPdfTemplate={openPdfForAnalysis}
          />
        </ErrorBoundary>
      )}
      {activeTab === "baseLaboratories" && (
        <ErrorBoundary fallbackTitle="Global laboratoriyalar bo'limida xatolik">
          <BaseLaboratoriesSection primaryColor={primaryColor} />
        </ErrorBoundary>
      )}
      {activeTab === "baseAnalyses" && (
        <ErrorBoundary fallbackTitle="Global analizlar bo'limida xatolik">
          <BaseAnalysesSection primaryColor={primaryColor} />
        </ErrorBoundary>
      )}
      {activeTab === "patterns" && <PatternsSection primaryColor={primaryColor} />}
      {activeTab === "pdf" && (
        <ErrorBoundary fallbackTitle="PDF shablon bo'limida xatolik">
          <PdfTemplateSection
            primaryColor={primaryColor}
            importTemplate={pdfImport}
            onImportConsumed={() => setPdfImport(null)}
            openForAnalysis={pdfOpenForAnalysis}
            onOpenForAnalysisConsumed={() => setPdfOpenForAnalysis(null)}
          />
        </ErrorBoundary>
      )}
      {activeTab === "globalPdf" && (
        <ErrorBoundary fallbackTitle="Global PDF shablon bo'limida xatolik">
          <GlobalPdfTemplateSection
            primaryColor={primaryColor}
            onAdaptForLocal={template => {
              setPdfImport(template);
              setActiveTab("pdf");
            }}
          />
        </ErrorBoundary>
      )}
    </main>
  );
}
