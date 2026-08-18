import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  BaseAnalysesSection,
  BaseLaboratoriesSection,
} from "./management/BaseCatalogSections";
import { GlobalPdfTemplateSection } from "./management/GlobalPdfTemplateSection";

export type GlobalDataSection = "laboratories" | "analyses" | "templates";

export function SuperAdminGlobalDataPage({
  primaryColor,
  section,
}: {
  primaryColor: string;
  section: GlobalDataSection;
}) {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-6 ses-scrollbar">
      {section === "laboratories" && (
        <ErrorBoundary fallbackTitle="Global laboratoriyalar bo'limida xatolik">
          <BaseLaboratoriesSection primaryColor={primaryColor} />
        </ErrorBoundary>
      )}
      {section === "analyses" && (
        <ErrorBoundary fallbackTitle="Global analizlar bo'limida xatolik">
          <BaseAnalysesSection primaryColor={primaryColor} />
        </ErrorBoundary>
      )}
      {section === "templates" && (
        <ErrorBoundary fallbackTitle="Global PDF shablon bo'limida xatolik">
          <GlobalPdfTemplateSection primaryColor={primaryColor} />
        </ErrorBoundary>
      )}
    </main>
  );
}
