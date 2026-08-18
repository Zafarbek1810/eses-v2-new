import * as React from "react";
import { useEffect, useState } from "react";
import {
  Search, X, RefreshCw, Building2,
  AlertCircle, Loader2,
  ChevronLeft, ChevronsLeft, ChevronsRight, MapPin,
} from "lucide-react";
import {
  getAllCompanies,
  getCompanyById,
  type Company,
} from "@/api/company";
import { getAllRegions, type Region } from "@/api/region";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { getStoredUser, getStoredCompanyId } from "@/api/session";

/** Sessiyada saqlangan ma'lumotdan viloyat ID (rol yoki kompaniya orqali). */
function getStoredRegionId(): number | null {
  const user = getStoredUser();
  const fromRole = user?.role?.region?.id;
  if (typeof fromRole === "number" && Number.isFinite(fromRole)) return fromRole;
  const fromCompany = user?.company?.region?.id;
  return typeof fromCompany === "number" && Number.isFinite(fromCompany) ? fromCompany : null;
}

function companyMatchesSearch(company: Company, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    company.name,
    company.description,
    company.address,
    company.phone,
    company.region?.name,
    company.district?.name,
  ].some(v => typeof v === "string" && v.toLowerCase().includes(q));
}

function getCompanyDistrictId(company: Company): number | null {
  if (typeof company.district?.id === "number") return company.district.id;
  if (typeof company.districtId === "number") return company.districtId;
  if (typeof company.district_id === "number") return company.district_id;
  return null;
}

function resolveDistrictName(company: Company, regions: Region[]): string | null {
  if (company.district?.name) return company.district.name;
  const districtId = getCompanyDistrictId(company);
  if (districtId == null) return null;
  for (const region of regions) {
    const found = region.district?.find(d => d.id === districtId);
    if (found) return found.name;
  }
  return null;
}

const PER_PAGE = 10;

export function CompaniesPage({
  primaryColor,
  onOpenCompany,
}: {
  primaryColor: string;
  onOpenCompany?: (company: Company) => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [lockedRegionId, setLockedRegionId] = useState<number | null>(() => getStoredRegionId());
  const [regionReady, setRegionReady] = useState(() => getStoredRegionId() != null);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const loadRegions = async () => {
    try {
      const data = await getAllRegions();
      setRegions(Array.isArray(data) ? data : []);
    } catch {
      setRegions([]);
    }
  };

  const loadCompanies = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    setError(null);
    try {
      const all = await getAllCompanies();
      const filtered = (Array.isArray(all) ? all : []).filter(c => {
        if (lockedRegionId != null && c.region?.id !== lockedRegionId) return false;
        return companyMatchesSearch(c, s.trim());
      });
      const start = (p - 1) * PER_PAGE;
      setCompanies(filtered.slice(start, start + PER_PAGE));
      setTotal(filtered.length);
      setPage(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tashkilotlarni yuklab bo'lmadi");
      setCompanies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegions();
  }, []);

  // Rolda region bo'lmasa, admin biriktirilgan kompaniya orqali viloyatni aniqlaymiz.
  useEffect(() => {
    if (regionReady) return;
    const companyId = getStoredCompanyId();
    if (companyId == null) {
      setRegionReady(true);
      return;
    }
    let cancelled = false;
    void getCompanyById(companyId)
      .then(company => {
        if (cancelled) return;
        const id = company.region?.id;
        if (typeof id === "number" && Number.isFinite(id)) setLockedRegionId(id);
      })
      .catch(() => {
        /* viloyat aniqlanmadi — cheklovsiz ko'rsatiladi */
      })
      .finally(() => {
        if (!cancelled) setRegionReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [regionReady]);

  useEffect(() => {
    if (!regionReady) return;
    void loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, regionReady, lockedRegionId]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applySearch(); }}
              placeholder="Nomi, tavsif yoki manzil bo'yicha qidirish…"
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={applySearch}
            className="px-3.5 py-2.5 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Qidirish
          </button>

          <button
            onClick={() => void loadCompanies()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["Tashkilot", "Viloyat / Tuman", "Telefon", "Manzil", "Holat", "Yaratilgan"].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Tashkilot topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Qidiruvni o'zgartiring yoki keyinroq qayta urinib ko'ring
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr
                    key={company.id}
                    onClick={() => onOpenCompany?.(company)}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors group ${
                      onOpenCompany ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {company.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">
                            {company.description || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[12px] text-foreground leading-tight">
                        {company.region?.name || "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {resolveDistrictName(company, regions) || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap font-mono">
                      {company.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground max-w-[220px]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{company.address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          company.active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {company.active ? "Faol" : "Faol emas"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(company.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {total === 0
              ? "0 ta tashkilot"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…"
                  ? <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                      }
                    >
                      {p}
                    </button>
                  ),
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
