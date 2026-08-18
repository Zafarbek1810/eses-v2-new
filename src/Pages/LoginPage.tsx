import * as React from "react";
import { useState } from "react";
import {
  Shield, Eye, EyeOff, Check, Globe, Building2, Activity,
  CheckCircle, ExternalLink, AlertCircle,
} from "lucide-react";
import {
  login as loginApi,
  saveSession,
  setStoredUser,
  ApiError,
  type AuthUser,
} from "@/api/auth";
import { getUserById } from "@/api/user";
import {
  clearPdfTemplatesStorage,
  fetchPdfTemplatesFromApi,
} from "@/lib/pdfTemplate";

async function resolveUserWithRole(user: AuthUser): Promise<AuthUser> {
  if (user.role?.name) return user;
  try {
    const full = await getUserById(user.id);
    return {
      ...user,
      role: full.role ?? user.role ?? null,
      company: full.company ?? user.company ?? null,
    };
  } catch {
    return user;
  }
}

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left: `${(i * 4.3 + 3) % 100}%`,
  delay: `${(i * 0.7) % 12}s`,
  duration: `${14 + (i * 1.05) % 14}s`,
  size: `${3 + (i * 1.8) % 7}px`,
  opacity: 0.1 + (i * 0.02) % 0.22,
}));

const QUICK_LINKS = [
  {
    icon: Globe,
    label: "Malaka oshirish",
    desc: "study.sanepid.uz",
    url: "https://study.sanepid.uz",
  },
  {
    icon: Activity,
    label: "Raqamli laboratoriya tizimi",
    desc: "labaratoriya.tris.uz",
    url: "https://labaratoriya.tris.uz",
  },
  {
    icon: Building2,
    label: "YKEM — epidemiologik monitoring",
    desc: "ykem.sanepid.uz",
    url: "https://ykem.sanepid.uz",
  },
  {
    icon: CheckCircle,
    label: "Gepatit axborot tizimi",
    desc: "gepatit.sanepid.uz",
    url: "https://gepatit.sanepid.uz",
  },
];

export const LoginPage = ({ onLogin }: { onLogin: (user: AuthUser) => void }) => {
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email va parolni kiriting");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setError("To'g'ri email kiriting");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await loginApi({ email: trimmedEmail, password });
      clearPdfTemplatesStorage();
      saveSession(data, remember);
      const { password: _pw, ...baseUser } = data.user;
      const user = await resolveUserWithRole(baseUser);
      setStoredUser(user);
      const companyId = user.company?.id ?? data.user.company?.id;
      void fetchPdfTemplatesFromApi(companyId).catch(() => {
        /* shablonlar keyinroq yuklanadi */
      });
      onLogin(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError("Serverga ulanib bo'lmadi. Backend ishlayotganini tekshiring.");
      } else {
        setError("Kirish muvaffaqiyatsiz. Qayta urinib ko'ring.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) void handleLogin();
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Form */}
      <div className="w-full lg:w-[46%] relative flex items-center justify-center bg-[#F7FAF9] px-6 py-12 lg:px-14 order-2 lg:order-1">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(13,148,136,0.07) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative z-10 w-full max-w-[400px]">
          <div className="flex items-center gap-3 mb-9">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: "linear-gradient(145deg, #0F766E, #14B8A6)",
                boxShadow: "0 10px 28px rgba(13,148,136,0.35)",
              }}
            >
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[#0C1F1C] font-bold text-[15px] leading-tight tracking-tight">
                SES Platformasi <span className="text-teal-600/70 font-semibold">v2</span>
              </div>
              <div className="text-[#5A736E] text-xs">O&apos;zbekiston Respublikasi</div>
            </div>
          </div>

          <h1 className="text-[34px] font-extrabold text-[#0C1F1C] mb-2 leading-[1.12] tracking-tight">
            Tizimga kirish
          </h1>
          <p className="text-[#5A736E] text-sm mb-8 leading-relaxed">
            Sanitariya-epidemiologiya xizmati boshqaruv platformasi. Sessiyalar shifrlangan.
          </p>

          <div className="bg-white rounded-2xl border border-[#DDE6E3] p-6 shadow-[0_12px_40px_rgba(12,31,28,0.06)] space-y-4">
            <div>
              <label className="block text-[#1A3A35] text-[11px] font-bold uppercase tracking-[0.1em] mb-2">
                Elektron pochta
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                onKeyDown={handleKey}
                placeholder="adx@gmail.com"
                className="w-full bg-[#F2F5F4] border border-[#DDE6E3] rounded-lg px-4 py-3 text-[#0C1F1C] placeholder-[#8AA89F] text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-[#1A3A35] text-[11px] font-bold uppercase tracking-[0.1em] mb-2">
                Parol
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={handleKey}
                  placeholder="Parolingizni kiriting"
                  className="w-full bg-[#F2F5F4] border border-[#DDE6E3] rounded-lg px-4 py-3 pr-12 text-[#0C1F1C] placeholder-[#8AA89F] text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8AA89F] hover:text-teal-700 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-red-700 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRemember(!remember)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                  remember
                    ? "bg-teal-600 border-teal-600"
                    : "border-[#B8C9C4] hover:border-teal-500"
                }`}
              >
                {remember && <Check className="w-2.5 h-2.5 text-white" />}
              </button>
              <span
                className="text-[#5A736E] text-sm select-none cursor-pointer"
                onClick={() => setRemember(!remember)}
              >
                Meni ushbu qurilmada eslab qol
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="w-full font-semibold py-3 rounded-lg text-sm text-white transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-80 mt-2"
              style={{
                background: "linear-gradient(135deg, #0F766E 0%, #0D9488 55%, #14B8A6 100%)",
                boxShadow: "0 8px 24px rgba(13,148,136,0.35)",
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Kirilmoqda…
                </>
              ) : (
                "Tizimga kirish"
              )}
            </button>
          </div>

          <p className="mt-8 text-center text-[11px] text-[#8AA89F]">
            © {new Date().getFullYear()} SES Platform · Versiya 2
          </p>
        </div>
      </div>

      {/* Brand */}
      <div
        className="w-full lg:w-[54%] relative flex items-center justify-center overflow-hidden order-1 lg:order-2 min-h-[280px] lg:min-h-0"
        style={{
          background: "linear-gradient(155deg, #042F2E 0%, #0F766E 42%, #0D9488 78%, #2DD4BF 100%)",
        }}
      >
        <div className="ses-blob ses-blob-1" />
        <div className="ses-blob ses-blob-2" />
        <div className="ses-blob ses-blob-3" />

        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full bg-white"
              style={{
                left: p.left,
                bottom: "-20px",
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                animation: `sesParticle ${p.duration} ${p.delay} infinite linear`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-[440px] px-8 lg:px-12 py-10 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-semibold tracking-wide mb-7 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-200 animate-pulse" />
            SES Platform v2
          </div>

          <h2 className="text-[32px] lg:text-[40px] font-extrabold leading-[1.1] tracking-tight mb-4">
            Sanitariya-<br />Epidemiologiya<br />Xizmati
          </h2>
          <p className="text-white/65 text-sm leading-relaxed mb-10 max-w-sm">
            Laboratoriya tekshiruvlari, kassa va natijalar uchun yagona raqamli platforma.
          </p>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.14em] mb-3">
              Tezkor havolalar
            </p>
            {QUICK_LINKS.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.07] border border-white/10 hover:bg-white/[0.12] hover:border-white/20 transition-all group backdrop-blur-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
                  <link.icon className="w-4 h-4 text-teal-100" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white leading-tight">{link.label}</div>
                  <div className="text-[11px] text-white/45">{link.desc}</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
