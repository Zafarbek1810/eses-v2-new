import * as React from "react";
import { useEffect, useState } from "react";
import {
  Plus, Search, X, Edit3, Trash2, RefreshCw, FlaskConical,
  CheckCircle, AlertCircle, Loader2, Eye, UserPlus, UserMinus,
  ChevronLeft, ChevronsLeft, ChevronsRight, Users, UserCog,
} from "lucide-react";
import {
  getAllLaboratories,
  getLaboratoriesFull,
  getLaboratoryById,
  addLaboratory,
  updateLaboratory,
  deleteLaboratory,
  attachLabAssistant,
  detachLabAssistant,
  type Laboratory,
  type LaboratoryPayload,
  type LabAssistant,
} from "@/api/laboratory";
import { getAllUsers, type AppUser } from "@/api/user";
import { getCompanyById, type Company } from "@/api/company";
import { getStoredCompanyId } from "@/api/session";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

const PER_PAGE = 10;

function assistantLabel(a: LabAssistant | AppUser) {
  const name = [a.username, a.surname].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (typeof a.email === "string" && a.email) return a.email;
  return `#${a.id}`;
}

function laboratoryCompanyId(lab: Laboratory): number | null {
  const value = lab.company?.id ?? lab.company_id ?? lab.companyId;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function companyLaboratories(company: Company): Laboratory[] {
  const raw = company as Company & {
    laboratory?: unknown;
    laboratories?: unknown;
    labs?: unknown;
  };
  const candidate = raw.laboratory ?? raw.laboratories ?? raw.labs;
  return Array.isArray(candidate) ? candidate as Laboratory[] : [];
}

function scopeLaboratories(allLabs: Laboratory[], company: Company | null, companyId: number): Laboratory[] {
  const fromApi = Array.isArray(allLabs) ? allLabs : [];
  const matching = fromApi.filter(lab => {
    const cid = laboratoryCompanyId(lab);
    return cid == null || cid === companyId;
  });
  if (matching.length > 0) return matching;
  return company ? companyLaboratories(company) : [];
}

function LabFormModal({
  mode,
  initialName,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  initialName: string;
  primaryColor: string;
  saving: boolean;
  onSave: (data: LaboratoryPayload) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (!name.trim() || name.trim().length < 2) {
      setError("Kamida 2 ta belgi kiriting");
      return false;
    }
    setError(null);
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">
              {mode === "add" ? "Yangi laboratoriya" : "Laboratoriyani tahrirlash"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Laboratoriya nomini kiriting
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
          <input
            type="text"
            value={name}
            placeholder="Masalan: Baktery7777"
            onChange={e => { setName(e.target.value); setError(null); }}
            className={`w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
              error ? "border-red-400" : "border-border focus:border-[var(--primary)]"
            }`}
          />
          {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={() => { if (validate()) onSave({ name: name.trim() }); }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Qo'shish" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssistantsModal({
  lab,
  users,
  primaryColor,
  saving,
  onAttach,
  onDetach,
  onClose,
}: {
  lab: Laboratory;
  users: AppUser[];
  primaryColor: string;
  saving: boolean;
  onAttach: (assistantId: number) => void;
  onDetach: (assistantId: number) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const assistants = Array.isArray(lab.lab_assistants) ? lab.lab_assistants : [];
  const attachedIds = new Set(assistants.map(a => a.id));
  const available = users.filter(u => !attachedIds.has(u.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Assistentlar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{lab.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Assistent qo'shish</label>
            <div className="flex gap-2">
              <select
                value={selectedId === "" ? "" : String(selectedId)}
                onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : "")}
                className="flex-1 bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="">Foydalanuvchi tanlang</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} {u.surname} (#{u.id})
                  </option>
                ))}
              </select>
              <button
                disabled={saving || selectedId === ""}
                onClick={() => {
                  if (selectedId === "") return;
                  onAttach(selectedId);
                  setSelectedId("");
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50"
                style={{ background: primaryColor }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Biriktirish
              </button>
            </div>
            {available.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5">Barcha foydalanuvchilar allaqachon biriktirilgan</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
              Biriktirilgan ({lab.lab_assistants.length})
            </h3>
            {lab.lab_assistants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <Users className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Hali assistent yo'q</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assistants.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-foreground truncate">
                        {assistantLabel(a)}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">#{a.id}</div>
                    </div>
                    <button
                      disabled={saving}
                      onClick={() => onDetach(a.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      title="Olib tashlash"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Olib tashlash
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 shrink-0 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectorModal({
  lab,
  users,
  primaryColor,
  saving,
  onAssign,
  onDetach,
  onClose,
}: {
  lab: Laboratory;
  users: AppUser[];
  primaryColor: string;
  saving: boolean;
  onAssign: (directorId: number) => void;
  onDetach: () => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const currentId = lab.lab_director?.id ?? null;
  const available = users.filter(u => u.id !== currentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Lab direktor</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{lab.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Direktor biriktirish</label>
            <div className="flex gap-2">
              <select
                value={selectedId === "" ? "" : String(selectedId)}
                onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : "")}
                className="flex-1 bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="">Foydalanuvchi tanlang</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.username} {u.surname} (#{u.id})
                  </option>
                ))}
              </select>
              <button
                disabled={saving || selectedId === ""}
                onClick={() => {
                  if (selectedId === "") return;
                  onAssign(selectedId);
                  setSelectedId("");
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50"
                style={{ background: primaryColor }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Biriktirish
              </button>
            </div>
            {available.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5">Biriktirish uchun foydalanuvchi yo&apos;q</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
              Biriktirilgan {lab.lab_director ? "(1)" : "(0)"}
            </h3>
            {!lab.lab_director ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <UserCog className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Hali direktor biriktirilmagan</p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-foreground truncate">
                    {assistantLabel(lab.lab_director)}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">#{lab.lab_director.id}</div>
                </div>
                <button
                  disabled={saving}
                  onClick={onDetach}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                  title="Olib tashlash"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Olib tashlash
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 shrink-0 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

export function LaboratoriesSection({
  primaryColor,
  companyId,
}: {
  primaryColor: string;
  companyId?: number;
}) {
  const scopedCompanyId = companyId ?? getStoredCompanyId() ?? undefined;
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit"; lab: Laboratory }
    | { type: "delete"; lab: Laboratory }
    | { type: "assistants"; lab: Laboratory }
    | { type: "director"; lab: Laboratory }
    | null
  >(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const loadLabs = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    setError(null);
    try {
      if (scopedCompanyId != null) {
        const [allLabs, company] = await Promise.all([
          getAllLaboratories(scopedCompanyId),
          getCompanyById(scopedCompanyId),
        ]);
        const scoped = scopeLaboratories(allLabs, company, scopedCompanyId);
        const query = s.trim().toLowerCase();
        const filtered = scoped.filter(lab => !query || lab.name.toLowerCase().includes(query));
        const start = (p - 1) * PER_PAGE;
        setLabs(filtered.slice(start, start + PER_PAGE));
        setTotal(filtered.length);
        setPage(p);
        return;
      }

      const res = await getLaboratoriesFull({
        page: p,
        limit: PER_PAGE,
        search: s,
        companyId: scopedCompanyId,
      });
      setLabs(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Laboratoriyalarni yuklab bo'lmadi");
      setLabs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshLabModal = async (
    labId: number,
    type: "assistants" | "director",
  ) => {
    try {
      const fresh = await getLaboratoryById(labId, scopedCompanyId);
      setModal(m => (m?.type === type ? { type, lab: fresh } : m));
      setLabs(list => list.map(l => (l.id === labId ? fresh : l)));
    } catch {
      await loadLabs();
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        if (scopedCompanyId != null) {
          const company = await getCompanyById(scopedCompanyId);
          setUsers((Array.isArray(company.user) ? company.user : []).map(user => ({
            id: user.id,
            username: user.username,
            surname: user.surname,
            email: user.email,
            createdAt: user.createdAt ?? "",
            role: user.role
              ? {
                  id: user.role.id,
                  name: user.role.name,
                  description: user.role.description ?? "",
                  createdAt: user.role.createdAt ?? "",
                }
              : null,
            company: {
              id: company.id,
              name: company.name,
              description: company.description,
              address: company.address,
              createdAt: company.createdAt,
            },
          })));
        } else {
          const list = await getAllUsers();
          setUsers(Array.isArray(list) ? list : []);
        }
      } catch {
        setUsers([]);
      }
    })();
  }, [scopedCompanyId]);

  useEffect(() => {
    void loadLabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, scopedCompanyId]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleSave = async (payload: LaboratoryPayload) => {
    if (!modal || (modal.type !== "add" && modal.type !== "edit")) return;

    setSaving(true);
    try {
      if (modal.type === "add") {
        await addLaboratory({
          ...payload,
          ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
        });
        pushToast(`${payload.name} qo'shildi`);
        setModal(null);
        setPage(1);
        await loadLabs({ page: 1 });
      } else {
        await updateLaboratory(modal.lab.id, {
          ...payload,
          ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
        });
        pushToast(`${payload.name} yangilandi`);
        setModal(null);
        await loadLabs({ page });
      }
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteLaboratory(modal.lab.id, scopedCompanyId);
      pushToast(`${modal.lab.name} o'chirildi`, "error");
      setModal(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadLabs({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAttach = async (assistantId: number) => {
    if (modal?.type !== "assistants") return;
    setSaving(true);
    try {
      await attachLabAssistant(modal.lab.id, assistantId);
      pushToast("Assistent biriktirildi");
      await refreshLabModal(modal.lab.id, "assistants");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Biriktirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDetach = async (assistantId: number) => {
    if (modal?.type !== "assistants") return;
    setSaving(true);
    try {
      await detachLabAssistant(modal.lab.id, assistantId);
      pushToast("Assistent olib tashlandi");
      await refreshLabModal(modal.lab.id, "assistants");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Olib tashlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignDirector = async (directorId: number) => {
    if (modal?.type !== "director") return;
    setSaving(true);
    try {
      await updateLaboratory(modal.lab.id, {
        lab_director_id: directorId,
        ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
      });
      pushToast("Direktor biriktirildi");
      await refreshLabModal(modal.lab.id, "director");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Direktor biriktirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDetachDirector = async () => {
    if (modal?.type !== "director") return;
    setSaving(true);
    try {
      await updateLaboratory(modal.lab.id, {
        lab_director_id: null,
        ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
      });
      pushToast("Direktor olib tashlandi");
      await refreshLabModal(modal.lab.id, "director");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Direktorni olib tashlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applySearch(); }}
              placeholder="Laboratoriya nomi bo'yicha qidirish…"
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
            onClick={() => void loadLabs()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setModal({ type: "add" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" />
            Yangi laboratoriya
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
                {["Laboratoriya", "Direktor", "Assistentlar", "Yaratilgan", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : labs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <FlaskConical className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Laboratoriya topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Yangi laboratoriya qo'shing yoki qidiruvni o'zgartiring</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                labs.map(lab => (
                  <tr key={lab.id} className="border-b border-border hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <FlaskConical className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {lab.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">#{lab.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setModal({ type: "director", lab })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors hover:opacity-80 max-w-[180px]"
                        style={{ background: `${primaryColor}15`, color: primaryColor }}
                        title="Direktor biriktirish"
                      >
                        <UserCog className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {lab.lab_director ? assistantLabel(lab.lab_director) : "Biriktirish"}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => setModal({ type: "assistants", lab })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors hover:opacity-80"
                        style={{ background: `${primaryColor}15`, color: primaryColor }}
                      >
                        <Users className="w-3 h-3" />
                        {lab.lab_assistants?.length ?? 0} ta
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(lab.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: "director", lab })}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-colors"
                          title="Direktor"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "assistants", lab })}
                          className="p-1.5 rounded-lg hover:bg-teal-50 hover:text-teal-600 text-muted-foreground transition-colors"
                          title="Assistentlar"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "edit", lab })}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", lab })}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
              ? "0 ta laboratoriya"
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

      {modal?.type === "add" && (
        <LabFormModal
          mode="add"
          initialName=""
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <LabFormModal
          mode="edit"
          initialName={modal.lab.name}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "assistants" && (
        <AssistantsModal
          lab={modal.lab}
          users={users}
          primaryColor={primaryColor}
          saving={saving}
          onAttach={handleAttach}
          onDetach={handleDetach}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "director" && (
        <DirectorModal
          lab={modal.lab}
          users={users}
          primaryColor={primaryColor}
          saving={saving}
          onAssign={handleAssignDirector}
          onDetach={handleDetachDirector}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">Laboratoriyani o'chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{modal.lab.name}</span>
                {" "}ni o'chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-fade-in pointer-events-auto ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            }
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
