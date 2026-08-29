import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import type { TourStep } from "@/lib/tours";

type AppTourProps = {
  steps: TourStep[];
  primaryColor: string;
  onComplete: () => void;
  onSkip: () => void;
  /** Called when a step needs sidebar expanded */
  onEnsureSidebarOpen?: () => void;
  /** Called before each step is shown (for opening nav groups, etc.) */
  onStepChange?: (stepIndex: number) => void;
};

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 8;
const TOOLTIP_GAP = 14;

function getTargetRect(selector: string | null): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function AppTour({
  steps,
  primaryColor,
  onComplete,
  onSkip,
  onEnsureSidebarOpen,
  onStepChange,
}: AppTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const isCentered = !step?.target;

  const measure = useCallback(() => {
    if (!step) return;
    if (step.ensureSidebarOpen) onEnsureSidebarOpen?.();

    requestAnimationFrame(() => {
      const rect = getTargetRect(step.target);
      setTargetRect(rect);

      if (!rect) {
        setTooltipStyle({
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: "min(420px, calc(100vw - 32px))",
        });
        return;
      }

      const tooltipEl = tooltipRef.current;
      const tw = tooltipEl?.offsetWidth ?? 360;
      const th = tooltipEl?.offsetHeight ?? 180;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top = rect.top + rect.height + TOOLTIP_GAP;
      let left = rect.left + rect.width / 2 - tw / 2;

      if (top + th > vh - 16) {
        top = rect.top - th - TOOLTIP_GAP;
      }
      if (top < 16) top = 16;
      if (left < 16) left = 16;
      if (left + tw > vw - 16) left = vw - tw - 16;

      setTooltipStyle({
        position: "fixed",
        top,
        left,
        maxWidth: "min(420px, calc(100vw - 32px))",
      });
    });
  }, [step, onEnsureSidebarOpen]);

  useLayoutEffect(() => {
    onStepChange?.(stepIndex);
    measure();
  }, [measure, stepIndex, onStepChange]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setStepIndex(i => i + 1);
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!step || steps.length === 0) return null;

  const highlightStyle: CSSProperties | undefined = targetRect
    ? {
        top: targetRect.top - PADDING,
        left: targetRect.left - PADDING,
        width: targetRect.width + PADDING * 2,
        height: targetRect.height + PADDING * 2,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-labelledby="app-tour-title">
      {isCentered && (
        <div className="absolute inset-0 bg-black/55 pointer-events-auto" />
      )}

      {highlightStyle && (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-300 ease-out z-[9999]"
          style={{
            ...highlightStyle,
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px ${primaryColor}, 0 0 24px ${primaryColor}66`,
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="z-[10000] rounded-2xl border border-border bg-card shadow-2xl p-5 pointer-events-auto"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                style={{ background: primaryColor }}
              >
                {stepIndex + 1} / {steps.length}
              </span>
            </div>
            <h2 id="app-tour-title" className="text-base font-bold text-foreground leading-snug">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Yo'riqnomani to'xtatish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{step.description}</p>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
          >
            To&apos;xtatish
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            {isLast ? "Tugatish" : isFirst ? "Boshlash" : "Keyingi"}
          </button>
        </div>
      </div>
    </div>
  );
}
