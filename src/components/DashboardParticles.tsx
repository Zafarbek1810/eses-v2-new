import * as React from "react";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3
    ? raw.split("").map(c => c + c).join("")
    : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 13, g: 148, b: 136 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function particleCount(width: number, height: number): number {
  const area = width * height;
  return Math.max(48, Math.min(110, Math.round(area / 10_500)));
}

export function DashboardParticles({ primaryColor }: { primaryColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: -9999, y: -9999 };
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;
    let lastTs = 0;

    const spawn = () => {
      const count = particleCount(width, height);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        r: 1.8 + Math.random() * 2.8,
      }));
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawn();
    };

    const color = () => {
      const rgb = hexToRgb(primaryColor);
      const dark = document.documentElement.classList.contains("dark");
      return {
        ...rgb,
        node: dark ? 0.88 : 0.72,
        line: dark ? 0.42 : 0.32,
        glow: dark ? 0.55 : 0.4,
      };
    };

    const step = (ts: number) => {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs || 16) / 16;
      lastTs = ts;
      ctx.clearRect(0, 0, width, height);

      const { r, g, b, node, line, glow } = color();
      const linkDist = Math.min(190, Math.max(120, Math.min(width, height) * 0.24));
      const mouseR = 150;

      ctx.lineWidth = 1.15;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const c = particles[j];
          const dx = a.x - c.x;
          const dy = a.y - c.y;
          const dist = Math.hypot(dx, dy);
          if (dist > linkDist) continue;
          ctx.strokeStyle = `rgba(${r},${g},${b},${line * (1 - dist / linkDist)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }

      for (const p of particles) {
        if (!reduceMotion) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < mouseR && dist > 0.001) {
            const force = (1 - dist / mouseR) * 0.07;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.994;
          p.vy *= 0.994;
          if (p.x < -8) p.x = width + 8;
          if (p.x > width + 8) p.x = -8;
          if (p.y < -8) p.y = height + 8;
          if (p.y > height + 8) p.y = -8;
        }

        ctx.beginPath();
        ctx.shadowColor = `rgba(${r},${g},${b},${glow})`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(${r},${g},${b},${node})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${node * 0.55})`;
        ctx.arc(p.x, p.y, Math.max(0.7, p.r * 0.38), 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) {
        mouse.x = -9999;
        mouse.y = -9999;
        return;
      }
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
        return;
      }
      if (reduceMotion) return;
      running = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(step);
    };

    resize();
    lastTs = performance.now();
    if (reduceMotion) {
      step(lastTs);
    } else {
      raf = requestAnimationFrame(step);
    }

    const parent = canvas.parentElement;
    const observer = new ResizeObserver(resize);
    if (parent) observer.observe(parent);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, [primaryColor]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div className="ses-blob ses-blob-1 opacity-70 dark:opacity-45" />
      <div className="ses-blob ses-blob-2 opacity-60 dark:opacity-40" />
      <div className="ses-blob ses-blob-3 opacity-55 dark:opacity-35" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
