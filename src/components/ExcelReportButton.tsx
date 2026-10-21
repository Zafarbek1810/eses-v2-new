import { useEffect, useState, type FormEvent } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { ReportPatientSelect } from "@/components/ReportPatientSelect";
import { getExcelReport, type ExcelReportFilters } from "@/api/report";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/app/components/ui/dialog";

type Period = "today" | "day" | "month" | "range";
const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const labelClass = "block text-xs font-semibold text-foreground";

export function ExcelReportButton({ primaryColor, startDate, endDate }: {
  primaryColor: string; startDate: string; endDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState<Period>("today");
  const [date, setDate] = useState(startDate);
  const [month, setMonth] = useState(startDate.slice(0, 7));
  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(endDate);
  const [lab, setLab] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [patient, setPatient] = useState("");
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labsError, setLabsError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLabsLoading(true);
    setLabsError("");
    getAllLaboratories().then(data => {
      if (active) setLabs(data);
    }).catch(() => {
      if (active) setLabsError("Laboratoriyalar yuklanmadi. Qayta urinish uchun modalni qayta oching.");
    }).finally(() => { if (active) setLabsLoading(false); });
    return () => { active = false; };
  }, [open]);

  function changeOpen(next: boolean) {
    if (busy) return;
    if (next) {
      const today = format(new Date(), "yyyy-MM-dd");
      setPeriod(startDate === endDate ? (startDate === today ? "today" : "day") : "range");
      setDate(startDate);
      setMonth(startDate.slice(0, 7));
      setFrom(startDate);
      setTo(endDate);
      setError("");
    }
    setOpen(next);
  }

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (period === "range" && from > to) {
      setError("Boshlanish sanasi tugash sanasidan keyin bo‘lishi mumkin emas.");
      return;
    }
    if (minAge !== "" && maxAge !== "" && Number(minAge) > Number(maxAge)) {
      setError("Eng kichik yosh eng katta yoshdan oshmasligi kerak.");
      return;
    }
    const filters: ExcelReportFilters = {};
    if (period === "day") filters.date = date;
    if (period === "month") filters.month = month;
    if (period === "range") Object.assign(filters, { type: "range", startDate: from, endDate: to });
    if (lab) filters.lab_id = Number(lab);
    if (minAge !== "") filters.min_age = Number(minAge);
    if (maxAge !== "") filters.max_age = Number(maxAge);
    if (patient) filters.patient_id = Number(patient);
    setBusy(true);
    try {
      const blob = await getExcelReport(filters);
      if (!blob.size) throw new Error("Hisobot fayli bo‘sh. Qayta urinib ko‘ring.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const suffix = period === "range" ? `${from}_${to}` : period === "month" ? month : period === "day" ? date : format(new Date(), "yyyy-MM-dd");
      link.href = url;
      link.download = `hisobot_${suffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Excel hisoboti yuklab olindi");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hisobotni yuklab bo‘lmadi. Qayta urinib ko‘ring.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90" style={{ background: primaryColor }}>
          <FileSpreadsheet className="h-4 w-4" /> Excelga yuklash
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Excel hisoboti</DialogTitle>
          <DialogDescription>Hisobot davri va kerakli filtrlarni tanlang. Qo‘shimcha filtrlarni bo‘sh qoldirish mumkin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={download} className="space-y-5">
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <label className={labelClass}>Hisobot davri
              <select className={inputClass} value={period} onChange={e => setPeriod(e.target.value as Period)}>
                <option value="today">Bugun</option><option value="day">Aniq kun</option>
                <option value="month">Oylik</option><option value="range">Sana oralig‘i</option>
              </select>
            </label>
            {period === "day" && <label className={labelClass}>Sana<input required type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} /></label>}
            {period === "month" && <label className={labelClass}>Oy<input required type="month" className={inputClass} value={month} onChange={e => setMonth(e.target.value)} /></label>}
            {period === "range" && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={labelClass}>Boshlanish sanasi<input required type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} /></label>
              <label className={labelClass}>Tugash sanasi<input required type="date" min={from} className={inputClass} value={to} onChange={e => setTo(e.target.value)} /></label>
            </div>}
            <div className="border-t border-border pt-4">
              <label className={labelClass}>Laboratoriya
                <select disabled={labsLoading || !!labsError} className={inputClass} value={lab} onChange={e => setLab(e.target.value)}>
                  <option value="">{labsLoading ? "Yuklanmoqda…" : "Barcha laboratoriyalar"}</option>
                  {labs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              {labsError && <p role="status" className="mt-2 text-xs text-destructive">{labsError}</p>}
              {lab && <p className="mt-2 text-xs text-muted-foreground">Bitta laboratoriya tanlanganda sanmin va shartnomalar hisobotga kiritilmaydi.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className={labelClass}>Eng kichik yosh<input type="number" min="0" step="1" className={inputClass} placeholder="Cheklanmagan" value={minAge} onChange={e => setMinAge(e.target.value)} /></label>
              <label className={labelClass}>Eng katta yosh<input type="number" min="0" step="1" className={inputClass} placeholder="Cheklanmagan" value={maxAge} onChange={e => setMaxAge(e.target.value)} /></label>
            </div>
            <ReportPatientSelect value={patient} onChange={setPatient} disabled={busy} />
          </fieldset>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" disabled={busy} onClick={() => changeOpen(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-50">Bekor qilish</button>
            <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60" style={{ background: primaryColor }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy ? "Hisobot tayyorlanmoqda…" : "Excelni yuklab olish"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
