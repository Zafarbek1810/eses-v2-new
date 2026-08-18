import * as React from "react";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, Check, CheckCircle } from "lucide-react";

const PRESET_COLORS = [
  "#0D9488", "#0F766E", "#059669", "#0E7490",
  "#0369A1", "#B45309", "#DC2626", "#4F46E5",
];

const DEFAULT_PRIMARY_COLOR = "#0D9488";

type SettingsPageProps = {
  primaryColor: string;
  onColorChange: (c: string) => void;
  darkMode: "light" | "dark" | "system";
  onDarkModeChange: (m: "light" | "dark" | "system") => void;
};

export function SettingsPage({
  primaryColor,
  onColorChange,
  darkMode,
  onDarkModeChange,
}: SettingsPageProps) {
  const [localColor, setLocalColor] = useState(primaryColor);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalColor(primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [saved]);

  const modes = [
    { id: "light" as const, icon: Sun, label: "Yorug'" },
    { id: "dark" as const, icon: Moon, label: "Qorong'u" },
    { id: "system" as const, icon: Monitor, label: "Tizim" },
  ];

  const handleSave = () => {
    onColorChange(localColor);
    setSaved(true);
  };

  const handleReset = () => {
    setLocalColor(DEFAULT_PRIMARY_COLOR);
    onColorChange(DEFAULT_PRIMARY_COLOR);
    onDarkModeChange("dark");
    setSaved(true);
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      {saved && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm text-white bg-emerald-600">
          <CheckCircle className="w-4 h-4" />
          Sozlamalar saqlandi
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-foreground tracking-tight">Sozlamalar</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Interfeys va ko&apos;rinishni sozlang · SES v2</p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] p-6 max-w-xl space-y-6">
        <div>
          <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.12em] mb-3">
            Ko'rinish rejimi
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {modes.map(m => {
              const active = darkMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onDarkModeChange(m.id)}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-medium"
                  style={
                    active
                      ? { background: localColor, borderColor: localColor, color: "#fff" }
                      : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                  }
                >
                  <m.icon className="w-5 h-5" />
                  <span className="text-xs">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
            Asosiy rang
          </h3>
          <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl mb-4">
            <div className="w-10 h-10 rounded-xl shadow-sm shrink-0" style={{ background: localColor }} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Tanlangan rang</div>
              <div className="text-xs text-muted-foreground font-mono">{localColor.toUpperCase()}</div>
            </div>
            <label className="relative cursor-pointer">
              <input
                type="color"
                value={localColor}
                onChange={e => setLocalColor(e.target.value)}
                className="sr-only"
              />
              <div
                className="w-8 h-8 rounded-lg border-2 border-white/30 shadow"
                style={{ background: localColor }}
              />
            </label>
          </div>

          <div className="grid grid-cols-8 gap-2">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setLocalColor(color)}
                className="aspect-square rounded-xl transition-all hover:scale-110 relative shadow-sm"
                style={{ background: color }}
              >
                {localColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
            Jonli ko'rinish
          </h3>
          <div className="p-4 bg-secondary rounded-xl space-y-3">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                style={{ background: localColor }}
              >
                Asosiy tugma
              </button>
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold border-2"
                style={{ borderColor: localColor, color: localColor }}
              >
                Kontur
              </button>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full w-3/5 rounded-full transition-all" style={{ background: localColor }} />
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-5 rounded-full p-0.5 flex items-center justify-end"
                style={{ background: localColor }}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
              <span className="text-xs text-muted-foreground">Faol o'tkazgich</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Standartga qaytarish
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: localColor }}
          >
            Saqlash
          </button>
        </div>
      </div>
    </main>
  );
}
