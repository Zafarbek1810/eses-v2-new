import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { getAllPatients, type Patient } from "@/api/patient";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/app/components/ui/command";

export function ReportPatientSelect({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    // Use the existing authenticated patient list; access scope is enforced by the backend.
    getAllPatients().then(data => {
      if (active) setPatients(data);
    }).catch(() => {
      if (active) setError("Bemorlarni yuklab bo‘lmadi.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const selected = patients.find(patient => String(patient.id) === value);
  const name = (patient: Patient) => `${patient.last_name} ${patient.first_name}`.trim();
  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div>
      <label htmlFor="report-patient" className="block text-xs font-semibold text-foreground">Bemor</label>
      <Popover open={open && !disabled} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button id="report-patient" type="button" role="combobox" aria-expanded={open} disabled={disabled}
            className="mt-1.5 flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <span className="truncate">{selected ? `${name(selected)} · #${selected.id}` : value ? `Bemor #${value}` : "Barcha bemorlar"}</span>
            {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput aria-label="Bemor qidiruvi" placeholder="Ism, familiya, telefon yoki ID bo‘yicha qidirish…" />
            <CommandList>
              <CommandEmpty>{loading ? "Bemorlar yuklanmoqda…" : error || "Bemor topilmadi"}</CommandEmpty>
              <CommandGroup>
                <CommandItem value="all-patients" forceMount onSelect={() => select("")}>
                  <Check className={value === "" ? "opacity-100" : "opacity-0"} /> Barcha bemorlar
                </CommandItem>
                {!loading && !error && patients.map(patient => (
                  <CommandItem key={patient.id} value={String(patient.id)} keywords={[patient.first_name, patient.last_name, patient.phone]} onSelect={() => select(String(patient.id))}>
                    <Check className={value === String(patient.id) ? "opacity-100" : "opacity-0"} />
                    <div className="min-w-0">
                      <div className="truncate">{name(patient)}</div>
                      <div className="text-xs text-muted-foreground">#{patient.id}{patient.phone ? ` · ${patient.phone}` : ""}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <div role="alert" className="mt-2 text-xs text-destructive">{error} <button type="button" disabled={disabled} onClick={() => setAttempt(n => n + 1)} className="font-semibold underline">Qayta urinish</button></div>}
    </div>
  );
}
