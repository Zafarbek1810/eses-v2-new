import * as React from "react";
import { useState } from "react";
import {
  Users, Search, Plus, Download, X, Edit3, Trash2, ChevronLeft,
  ChevronDown, ChevronUp, Mail, MapPin, Briefcase, Phone,
  ChevronsLeft, ChevronsRight, UserCheck, UserX, Clock, User,
  Calendar, CheckCircle, AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/formatDate";

const DEPARTMENTS = ["Inspection", "Laboratory", "Administration", "Certification", "Analytics", "IT Support"] as const;
const REGIONS = ["Tashkent", "Samarkand", "Fergana", "Andijan", "Namangan", "Bukhara", "Qashqadaryo"] as const;
const EMP_STATUSES = ["Active", "Inactive", "On Leave"] as const;

type Department = typeof DEPARTMENTS[number];
type EmpStatus  = typeof EMP_STATUSES[number];

type Employee = {
  id: string;
  name: string;
  position: string;
  department: Department;
  phone: string;
  email: string;
  status: EmpStatus;
  joinDate: string;
  region: string;
};

type EmployeeForm = Omit<Employee, "id">;

const INITIAL_EMPLOYEES: Employee[] = [
  { id: "EMP-001", name: "Aziz Karimov",      position: "Senior Inspector",        department: "Inspection",     phone: "+998 90 123 45 67", email: "a.karimov@ses.gov.uz",      status: "Active",   joinDate: "2019-03-12", region: "Tashkent"    },
  { id: "EMP-002", name: "Barno Toshmatova",   position: "Laboratory Specialist",   department: "Laboratory",     phone: "+998 91 234 56 78", email: "b.toshmatova@ses.gov.uz",   status: "Active",   joinDate: "2020-07-08", region: "Samarkand"   },
  { id: "EMP-003", name: "Dilshod Yusupov",    position: "Certification Officer",   department: "Certification",  phone: "+998 93 345 67 89", email: "d.yusupov@ses.gov.uz",      status: "Active",   joinDate: "2018-11-20", region: "Tashkent"    },
  { id: "EMP-004", name: "Sarvar Rakhimov",    position: "Chief Inspector",         department: "Inspection",     phone: "+998 94 456 78 90", email: "s.rakhimov@ses.gov.uz",     status: "On Leave", joinDate: "2016-05-14", region: "Fergana"     },
  { id: "EMP-005", name: "Nodira Mirzaeva",    position: "Lab Technician",          department: "Laboratory",     phone: "+998 95 567 89 01", email: "n.mirzaeva@ses.gov.uz",     status: "Active",   joinDate: "2021-02-28", region: "Andijan"     },
  { id: "EMP-006", name: "Jasur Nazarov",      position: "Data Analyst",            department: "Analytics",      phone: "+998 97 678 90 12", email: "j.nazarov@ses.gov.uz",      status: "Active",   joinDate: "2022-09-05", region: "Tashkent"    },
  { id: "EMP-007", name: "Mohira Sultanova",   position: "Administrative Manager",  department: "Administration", phone: "+998 99 789 01 23", email: "m.sultanova@ses.gov.uz",    status: "Active",   joinDate: "2017-04-19", region: "Namangan"    },
  { id: "EMP-008", name: "Otabek Xolmatov",   position: "IT Administrator",         department: "IT Support",     phone: "+998 90 890 12 34", email: "o.xolmatov@ses.gov.uz",     status: "Inactive", joinDate: "2020-12-01", region: "Tashkent"    },
  { id: "EMP-009", name: "Zulfiya Ergasheva",  position: "Inspector",               department: "Inspection",     phone: "+998 91 901 23 45", email: "z.ergasheva@ses.gov.uz",    status: "Active",   joinDate: "2021-06-15", region: "Bukhara"     },
  { id: "EMP-010", name: "Firdavs Abdullayev", position: "Senior Lab Specialist",   department: "Laboratory",     phone: "+998 93 012 34 56", email: "f.abdullayev@ses.gov.uz",   status: "Active",   joinDate: "2019-08-22", region: "Samarkand"   },
  { id: "EMP-011", name: "Kamola Hasanova",    position: "Certification Analyst",   department: "Certification",  phone: "+998 94 123 45 67", email: "k.hasanova@ses.gov.uz",     status: "Active",   joinDate: "2023-01-10", region: "Qashqadaryo" },
  { id: "EMP-012", name: "Ravshan Tursunov",   position: "Regional Inspector",      department: "Inspection",     phone: "+998 95 234 56 78", email: "r.tursunov@ses.gov.uz",     status: "On Leave", joinDate: "2015-09-30", region: "Fergana"     },
  { id: "EMP-013", name: "Gulnora Yoldosheva", position: "Lab Analyst",             department: "Laboratory",     phone: "+998 97 345 67 89", email: "g.yoldosheva@ses.gov.uz",   status: "Active",   joinDate: "2022-03-17", region: "Andijan"     },
  { id: "EMP-014", name: "Sherzod Baxtiyorov", position: "System Administrator",    department: "IT Support",     phone: "+998 99 456 78 90", email: "sh.baxtiyorov@ses.gov.uz",  status: "Active",   joinDate: "2021-11-08", region: "Tashkent"    },
  { id: "EMP-015", name: "Nozima Qodirov",    position: "Senior Analyst",           department: "Analytics",      phone: "+998 90 567 89 01", email: "n.qodirov@ses.gov.uz",      status: "Active",   joinDate: "2020-05-25", region: "Namangan"    },
];

const DEPT_COLORS: Record<Department, { bg: string; text: string; dot: string }> = {
  Inspection:     { bg: "#EFF6FF", text: "#2563EB", dot: "#3B82F6" },
  Laboratory:     { bg: "#F0FDF4", text: "#16A34A", dot: "#22C55E" },
  Administration: { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  Certification:  { bg: "#F5F3FF", text: "#7C3AED", dot: "#8B5CF6" },
  Analytics:      { bg: "#ECFEFF", text: "#0E7490", dot: "#06B6D4" },
  "IT Support":   { bg: "#FDF2F8", text: "#BE185D", dot: "#EC4899" },
};

const AVATAR_PALETTE = ["#0D9488","#0F766E","#059669","#0E7490","#0369A1","#B45309","#DC2626","#4F46E5","#D97706","#14B8A6"];
const avatarColor = (name: string) => AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

const nextId = (employees: Employee[]) => {
  const max = employees.reduce((m, e) => Math.max(m, parseInt(e.id.split("-")[1])), 0);
  return `EMP-${String(max + 1).padStart(3, "0")}`;
};

const EMPTY_FORM: EmployeeForm = {
  name: "", position: "", department: "Inspection", phone: "",
  email: "", status: "Active", joinDate: "", region: "Tashkent",
};

// ─── Employee Form Modal (Add / Edit) ────────────────────────────────────────

type EmpModalProps = {
  mode: "add" | "edit";
  initial: EmployeeForm;
  primaryColor: string;
  onSave: (data: EmployeeForm) => void;
  onClose: () => void;
};

const EmployeeFormModal = ({ mode, initial, primaryColor, onSave, onClose }: EmpModalProps) => {
  const [form, setForm] = useState<EmployeeForm>({ ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeForm, string>>>({});

  const set = (k: keyof EmployeeForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Kamida 2 ta belgi kiriting";
    if (!form.position.trim()) e.position = "Lavozim kiritilishi shart";
    if (!form.phone.trim()) e.phone = "Telefon raqami kiritilishi shart";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "To'g'ri email kiriting";
    if (!form.joinDate) e.joinDate = "Ishga kirish sanasi kiritilishi shart";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => { if (validate()) onSave(form); };

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none transition-all ${
      err ? "border-red-400 focus:border-red-500" : "border-border focus:border-[var(--primary)]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">
              {mode === "add" ? "Yangi xodim qo'shish" : "Xodimni tahrirlash"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "add" ? "Barcha majburiy maydonlarni to'ldiring" : "Ma'lumotlarni yangilang"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto ses-scrollbar p-6 space-y-4">
          {/* Row: Name + Position */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="To'liq ism *" error={errors.name}>
              <input
                type="text" value={form.name} placeholder="Familiya Ism"
                onChange={e => set("name", e.target.value)}
                className={inputCls(errors.name)}
              />
            </Field>
            <Field label="Lavozim *" error={errors.position}>
              <input
                type="text" value={form.position} placeholder="Masalan: Bosh inspektor"
                onChange={e => set("position", e.target.value)}
                className={inputCls(errors.position)}
              />
            </Field>
          </div>

          {/* Row: Department + Region */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bo'lim *" error={errors.department}>
              <select value={form.department} onChange={e => set("department", e.target.value)} className={inputCls()}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Viloyat *" error={errors.region}>
              <select value={form.region} onChange={e => set("region", e.target.value)} className={inputCls()}>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          {/* Row: Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefon *" error={errors.phone}>
              <input
                type="tel" value={form.phone} placeholder="+998 90 123 45 67"
                onChange={e => set("phone", e.target.value)}
                className={inputCls(errors.phone)}
              />
            </Field>
            <Field label="Email *" error={errors.email}>
              <input
                type="email" value={form.email} placeholder="ism@ses.gov.uz"
                onChange={e => set("email", e.target.value)}
                className={inputCls(errors.email)}
              />
            </Field>
          </div>

          {/* Row: Join Date + Status */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ishga kirish sanasi *" error={errors.joinDate}>
              <input
                type="date" value={form.joinDate}
                onChange={e => set("joinDate", e.target.value)}
                className={inputCls(errors.joinDate)}
              />
            </Field>
            <Field label="Holat *">
              <div className="flex gap-2 pt-0.5">
                {EMP_STATUSES.map(s => {
                  const active = form.status === s;
                  const colors: Record<EmpStatus, string> = {
                    Active: "#10B981", Inactive: "#EF4444", "On Leave": "#F59E0B",
                  };
                  return (
                    <button
                      key={s} type="button"
                      onClick={() => set("status", s)}
                      className="flex-1 py-2 rounded-xl text-[11px] font-semibold border-2 transition-all"
                      style={active
                        ? { background: `${colors[s as EmpStatus]}18`, borderColor: colors[s as EmpStatus], color: colors[s as EmpStatus] }
                        : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors">
            Bekor qilish
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            {mode === "add" ? "Qo'shish" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Employee View Modal ──────────────────────────────────────────────────────

const EmployeeViewModal = ({ emp, primaryColor, onEdit, onClose }: {
  emp: Employee; primaryColor: string;
  onEdit: () => void; onClose: () => void;
}) => {
  const statusColors: Record<EmpStatus, { bg: string; text: string; icon: React.ElementType }> = {
    Active:     { bg: "#F0FDF4", text: "#16A34A", icon: UserCheck },
    Inactive:   { bg: "#FEF2F2", text: "#DC2626", icon: UserX },
    "On Leave": { bg: "#FFFBEB", text: "#D97706", icon: Clock },
  };
  const sc = statusColors[emp.status];
  const dc = DEPT_COLORS[emp.department];
  const color = avatarColor(emp.name);

  const yrs = ((Date.now() - new Date(emp.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        {/* Hero */}
        <div className="relative px-6 pt-6 pb-5" style={{ background: `${color}12` }}>
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-black/5 transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg" style={{ background: color }}>
              {getInitials(emp.name)}
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-foreground leading-tight">{emp.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{emp.position}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: dc.bg, color: dc.text }}>
                  <Briefcase className="w-3 h-3" />{emp.department}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: sc.bg, color: sc.text }}>
                  <sc.icon className="w-3 h-3" />{emp.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {[
            { icon: Mail,      label: "Email",          value: emp.email },
            { icon: Phone,     label: "Telefon",        value: emp.phone },
            { icon: MapPin,    label: "Viloyat",        value: emp.region },
            { icon: Calendar,  label: "Ishga kirgan",   value: formatDate(emp.joinDate) },
          ].map(row => (
            <div key={row.label} className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <row.icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{row.label}</div>
                <div className="text-[13px] text-foreground font-medium mt-0.5 leading-tight break-all whitespace-pre-line">{row.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div className="mx-6 mb-5 p-4 bg-secondary rounded-2xl grid grid-cols-3 divide-x divide-border">
          {[
            { label: "Xodim ID", value: emp.id },
            { label: "Staj", value: `${yrs} yil` },
            { label: "Bo'lim", value: emp.department.split(" ")[0] },
          ].map(s => (
            <div key={s.label} className="px-4 text-center first:pl-0 last:pr-0">
              <div className="text-[15px] font-bold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors">
            Yopish
          </button>
          <button
            onClick={onEdit}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: primaryColor }}
          >
            Tahrirlash
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

const DeleteConfirmModal = ({ emp, onConfirm, onClose }: {
  emp: Employee; onConfirm: () => void; onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
      <div className="p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-[16px] font-bold text-foreground mb-2">Xodimni o'chirish</h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">{emp.name}</span> — xodimini o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.
        </p>
      </div>
      <div className="flex gap-3 px-6 pb-6">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors">
          Bekor qilish
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]">
          Ha, o'chirish
        </button>
      </div>
    </div>
  </div>
);

// ─── Toast Notification ───────────────────────────────────────────────────────

type ToastMsg = { id: number; text: string; type: "success" | "error" };

const Toast = ({ toast }: { toast: ToastMsg }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-fade-in ${
    toast.type === "success"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
      : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
  }`}>
    {toast.type === "success"
      ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
      : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
    }
    {toast.text}
  </div>
);

// ─── Employees Page ───────────────────────────────────────────────────────────

type SortKey = "name" | "department" | "joinDate" | "status" | "region";

export const EmployeesPage = ({ primaryColor }: { primaryColor: string }) => {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit"; emp: Employee }
    | { type: "view"; emp: Employee }
    | { type: "delete"; emp: Employee }
    | null
  >(null);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  // ── Filtering + Sorting ──
  const filtered = employees
    .filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.position.toLowerCase().includes(q);
      const matchDept   = filterDept === "All" || e.department === filterDept;
      const matchStatus = filterStatus === "All" || e.status === filterStatus;
      return matchSearch && matchDept && matchStatus;
    })
    .sort((a, b) => {
      const v = (e: Employee) => e[sort.key];
      const cmp = v(a).localeCompare(v(b));
      return sort.dir === "asc" ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageEmployees = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key === k
      ? sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
      : <span className="w-3 inline-block ml-0.5" />;

  // ── CRUD handlers ──
  const handleAdd = (form: EmployeeForm) => {
    setEmployees(prev => [...prev, { id: nextId(prev), ...form }]);
    setModal(null);
    pushToast(`${form.name} muvaffaqiyatli qo'shildi`);
    setPage(1);
  };

  const handleEdit = (form: EmployeeForm) => {
    if (modal?.type !== "edit") return;
    setEmployees(prev => prev.map(e => e.id === modal.emp.id ? { ...e, ...form } : e));
    setModal(null);
    pushToast(`${form.name} ma'lumotlari yangilandi`);
  };

  const handleDelete = () => {
    if (modal?.type !== "delete") return;
    const name = modal.emp.name;
    setEmployees(prev => prev.filter(e => e.id !== modal.emp.id));
    setModal(null);
    pushToast(`${name} o'chirildi`, "error");
    if (page > Math.ceil((filtered.length - 1) / PER_PAGE)) setPage(p => Math.max(1, p - 1));
  };

  // ── Stats ──
  const total   = employees.length;
  const active  = employees.filter(e => e.status === "Active").length;
  const onLeave = employees.filter(e => e.status === "On Leave").length;
  const deptCount = new Set(employees.map(e => e.department)).size;

  const empStats = [
    { label: "Jami xodimlar", value: total, icon: Users,     bg: "#EFF6FF", color: "#3B82F6" },
    { label: "Faol",          value: active, icon: UserCheck, bg: "#F0FDF4", color: "#10B981" },
    { label: "Ta'tilda",      value: onLeave, icon: Clock,   bg: "#FFFBEB", color: "#F59E0B" },
    { label: "Bo'limlar",     value: deptCount, icon: Briefcase, bg: "#F5F3FF", color: "#8B5CF6" },
  ];

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-4">
        {empStats.map((s, i) => (
          <div key={i} className="bg-card rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
              <s.icon className="w-5 h-5" style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-[22px] font-bold text-foreground leading-none">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Ism, email yoki lavozim bo'yicha qidiring…"
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dept filter */}
          <select
            value={filterDept}
            onChange={e => { setFilterDept(e.target.value); setPage(1); }}
            className="bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none cursor-pointer"
          >
            <option value="All">Barcha bo'limlar</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none cursor-pointer"
          >
            <option value="All">Barcha holatlar</option>
            {EMP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground" title="Eksport">
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setModal({ type: "add" })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
              style={{ background: primaryColor }}
            >
              <Plus className="w-4 h-4" />
              Yangi xodim
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {([
                  { k: "name" as SortKey,       label: "Xodim" },
                  { k: "department" as SortKey, label: "Bo'lim" },
                  { k: "region" as SortKey,     label: "Viloyat" },
                  { k: null,                    label: "Aloqa" },
                  { k: "joinDate" as SortKey,   label: "Kirgan sana" },
                  { k: "status" as SortKey,     label: "Holat" },
                  { k: null,                    label: "" },
                ] as { k: SortKey | null; label: string }[]).map((col, i) => (
                  <th
                    key={i}
                    onClick={col.k ? () => toggleSort(col.k!) : undefined}
                    className={`text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap ${col.k ? "cursor-pointer select-none hover:text-foreground transition-colors" : ""}`}
                  >
                    {col.label}
                    {col.k && <SortIcon k={col.k} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Xodim topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Qidiruvni o'zgartiring yoki filtrlarni olib tashlang</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : pageEmployees.map((emp, idx) => {
                const dc = DEPT_COLORS[emp.department];
                const sc: Record<EmpStatus, { bg: string; text: string }> = {
                  Active:     { bg: "#F0FDF4", text: "#16A34A" },
                  Inactive:   { bg: "#FEF2F2", text: "#DC2626" },
                  "On Leave": { bg: "#FFFBEB", text: "#D97706" },
                };
                const color = avatarColor(emp.name);
                return (
                  <tr
                    key={emp.id}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors group ${idx % 2 === 0 ? "" : ""}`}
                  >
                    {/* Employee */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm"
                          style={{ background: color }}
                        >
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">{emp.name}</div>
                          <div className="text-[11px] text-muted-foreground">{emp.position}</div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: dc.bg, color: dc.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: dc.dot }} />
                        {emp.department}
                      </span>
                    </td>

                    {/* Region */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-foreground">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {emp.region}
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3.5 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{emp.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        {emp.phone}
                      </div>
                    </td>

                    {/* Join date */}
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(emp.joinDate)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: sc[emp.status].bg, color: sc[emp.status].text }}>
                        {emp.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: "view", emp })}
                          className="p-1.5 rounded-lg hover:bg-teal-50 hover:text-teal-600 text-muted-foreground transition-colors"
                          title="Ko'rish"
                        >
                          <User className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "edit", emp })}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", emp })}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {filtered.length === 0
              ? "0 ta xodim"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, filtered.length)} / ${filtered.length} ta xodim`}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
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
                      className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                      }
                    >
                      {p}
                    </button>
                  )
              )
            }
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal?.type === "add" && (
        <EmployeeFormModal mode="add" initial={EMPTY_FORM} primaryColor={primaryColor} onSave={handleAdd} onClose={() => setModal(null)} />
      )}
      {modal?.type === "edit" && (
        <EmployeeFormModal
          mode="edit"
          initial={{ name: modal.emp.name, position: modal.emp.position, department: modal.emp.department, phone: modal.emp.phone, email: modal.emp.email, status: modal.emp.status, joinDate: modal.emp.joinDate, region: modal.emp.region }}
          primaryColor={primaryColor}
          onSave={handleEdit}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "view" && (
        <EmployeeViewModal
          emp={modal.emp}
          primaryColor={primaryColor}
          onEdit={() => setModal({ type: "edit", emp: modal.emp })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteConfirmModal emp={modal.emp} onConfirm={handleDelete} onClose={() => setModal(null)} />
      )}

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => <Toast key={t.id} toast={t} />)}
      </div>
    </main>
  );
};
