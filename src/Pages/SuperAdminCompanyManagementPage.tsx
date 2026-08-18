import * as React from "react";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Database,
  Shield,
  Users,
} from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RolesSection } from "./management/RolesSection";
import { UsersSection } from "./management/UsersSection";
import { CompanyGlobalDataSection } from "./management/CompanyGlobalDataSection";

type TabId = "roles" | "users" | "data";

const TABS: { id: TabId; label: string; description: string; icon: React.ElementType }[] = [
  { id: "roles", label: "Rollar", description: "Tashkilot rollari", icon: Shield },
  { id: "users", label: "Foydalanuvchilar", description: "Xodimlar va ruxsatlar", icon: Users },
  { id: "data", label: "Ma'lumotlar qo'shish", description: "Global lab, analiz, shablon", icon: Database },
];

export function SuperAdminCompanyManagementPage({
  companyId,
  companyName,
  primaryColor,
  onBack,
}: {
  companyId: number;
  companyName: string;
  primaryColor: string;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("roles");

  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-6 ses-scrollbar">
      <div className="mb-5 flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Tashkilotlarga qaytish
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: primaryColor }}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-extrabold text-foreground">{companyName}</h2>
            <p className="text-xs text-muted-foreground">Tashkilot boshqaruvi · ID #{companyId}</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[600px] items-start gap-5 max-lg:flex-col">
        <aside className="sticky top-0 w-[248px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm max-lg:static max-lg:w-full">
          <div className="border-b border-border px-4 py-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bo'limlar</p>
          </div>
          <nav className="space-y-1 p-2 max-lg:flex max-lg:overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors max-lg:min-w-[210px] ${
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                  style={active ? { boxShadow: `inset 3px 0 0 ${primaryColor}` } : undefined}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={active ? { background: `${primaryColor}18`, color: primaryColor } : undefined}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{tab.label}</span>
                    <span className="block truncate text-[10px] font-normal text-muted-foreground">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          {activeTab === "roles" && <RolesSection primaryColor={primaryColor} companyId={companyId} />}
          {activeTab === "users" && <UsersSection primaryColor={primaryColor} companyId={companyId} />}
          {activeTab === "data" && (
            <ErrorBoundary fallbackTitle="Ma'lumotlar qo'shish bo'limida xatolik">
              <CompanyGlobalDataSection primaryColor={primaryColor} companyId={companyId} />
            </ErrorBoundary>
          )}
        </section>
      </div>
    </main>
  );
}
