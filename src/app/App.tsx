import * as React from "react";
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard, Users, Settings as SettingsIcon, Settings, ChevronLeft, ChevronDown,
  Sun, Moon, Monitor, Globe, LogOut, User, Edit3, X, Check, ImageOff,
  Bell, HelpCircle, UserPlus, Wallet, ClipboardList, FileBarChart2, Building2, MapPin,
  Package, WalletCards, History, FlaskConical, TestTube2, FileType,
} from "lucide-react";
import {
  clearSession,
  isAuthenticated,
  getStoredUser,
  setStoredUser,
  type AuthUser,
} from "@/api/auth";
import { getUserById } from "@/api/user";
import { clearPdfTemplatesStorage } from "@/lib/pdfTemplate";
import {
  canAccessNav,
  getAllowedNavIds,
  getDefaultNavId,
  normalizeRoleName,
} from "@/lib/roles";
import {
  LoginPage,
  DashboardPage,
  EmployeesPage,
  ManagementPage,
  CompaniesPage,
  SuperAdminCompaniesPage,
  SuperAdminRegionsPage,
  SuperAdminCompanyManagementPage,
  AdminCompanyManagementPage,
  SuperAdminGlobalDataPage,
  PlansPage,
  SubscriptionsPage,
  HistoryPage,
  PatientsPage,
  OrderPage,
  OrdersPage,
  ResultsPage,
  ShowResultPage,
  ProfilePage,
  EditProfilePage,
  SettingsPage,
} from "@/Pages";
import type { Company } from "@/api/company";
import {
  isShowResultRoute,
  parseShowResultParams,
} from "@/lib/showResultLink";
import {
  WALLPAPERS,
  WALLPAPER_KEY,
  WALLPAPER_NONE,
  DEFAULT_WALLPAPER,
  getStoredWallpaper,
  wallpaperSrc,
  type WallpaperId,
} from "@/lib/wallpapers";
import sesLogo from "@/images/ses.jpg";
import { DashboardParticles } from "@/components/DashboardParticles";

/** User-menu pages — available to every authenticated role. */
const USER_PAGE_IDS = ["profile", "edit-profile", "settings"] as const;
type UserPageId = (typeof USER_PAGE_IDS)[number];

function isUserPage(id: string): id is UserPageId {
  return (USER_PAGE_IDS as readonly string[]).includes(id);
}

const USER_PAGE_LABELS: Record<UserPageId, string> = {
  profile: "Mening profilim",
  "edit-profile": "Profilni tahrirlash",
  settings: "Sozlamalar",
};

// ─── Persistence ──────────────────────────────────────────────────────────────

const PRIMARY_COLOR_KEY = "ses-primary-color";
const DEFAULT_PRIMARY_COLOR = "#0D9488";
const LEGACY_PRIMARY_COLOR = "#0EA5E9";
const DARK_MODE_KEY = "ses-dark-mode";
const DEFAULT_DARK_MODE: DarkMode = "dark";

type DarkMode = "light" | "dark" | "system";

function getStoredDarkMode(): DarkMode {
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_DARK_MODE;
}

function getStoredPrimaryColor(): string {
  try {
    const stored = localStorage.getItem(PRIMARY_COLOR_KEY);
    if (stored && stored.toLowerCase() === LEGACY_PRIMARY_COLOR.toLowerCase()) {
      return DEFAULT_PRIMARY_COLOR;
    }
    if (stored && /^#[0-9A-Fa-f]{6}$/.test(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_PRIMARY_COLOR;
}

// ─── Data ────────────────────────────────────────────────────────────────────

type NavChild = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: "main" | "system";
  children?: readonly NavChild[];
};

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Bosh sahifa", icon: LayoutDashboard, section: "main" },
  { id: "management", label: "Boshqaruv", icon: SettingsIcon, section: "main" },
  { id: "region-admins", label: "Viloyat adminlari", icon: MapPin, section: "main" },
  { id: "companies", label: "Tashkilot yaratish", icon: Building2, section: "main" },
  { id: "plans", label: "Tariflar", icon: Package, section: "main" },
  { id: "subscriptions", label: "Obunalar", icon: WalletCards, section: "main" },
  { id: "patients", label: "Ro'yxatga olish", icon: UserPlus, section: "main" },
  { id: "kassa", label: "Kassa", icon: Wallet, section: "main" },
  { id: "orders", label: "Laborant mudiri", icon: ClipboardList, section: "main" },
  { id: "results", label: "Natijalar", icon: FileBarChart2, section: "main" },
  { id: "history", label: "Tarix", icon: History, section: "main" },
  {
    id: "global-data",
    label: "Global ma'lumotlar",
    icon: Globe,
    section: "main",
    children: [
      { id: "global-laboratories", label: "Global Labaratoriyalar", icon: FlaskConical },
      { id: "global-analyses", label: "Global Analizlar", icon: TestTube2 },
      { id: "global-templates", label: "Global shablonlar", icon: FileType },
    ],
  },
  // { id: "employees", label: "Employees", icon: Users, section: "main" },
];

function findNavItem(id: string): NavItem | NavChild | undefined {
  for (const item of NAV_ITEMS) {
    if (item.id === id) return item;
    const child = item.children?.find(c => c.id === id);
    if (child) return child;
  }
  return undefined;
}

function navItemLabel(id: string, roleName: string | null | undefined, fallback: string): string {
  if (id === "companies" && normalizeRoleName(roleName) === "admin") {
    return "Tashkilotlar";
  }
  return fallback;
}

const PRESET_COLORS = [
  "#0D9488", "#0F766E", "#059669", "#0E7490",
  "#0369A1", "#B45309", "#DC2626", "#4F46E5",
];

const NOTIFICATIONS = [
  { id: 1, text: "Yangi buyurtma kassadan yuborildi", time: "2 daqiqa oldin", unread: true },
  { id: 2, text: "Laboratoriya natijasi tasdiqlashni kutmoqda", time: "1 soat oldin", unread: true },
  { id: 3, text: "PDF shablon yangilandi", time: "3 soat oldin", unread: false },
];

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    * { font-family: 'Plus Jakarta Sans', 'IBM Plex Sans', system-ui, sans-serif; }
    .pdf-times, .pdf-times * { font-family: "Times New Roman", Times, serif !important; }

    @keyframes sesBlob {
      0%   { transform: translate(0px, 0px) scale(1); }
      33%  { transform: translate(45px, -65px) scale(1.12); }
      66%  { transform: translate(-35px, 35px) scale(0.88); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes sesParticle {
      0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
      8%   { opacity: 0.7; }
      92%  { opacity: 0.7; }
      100% { transform: translateY(-105vh) rotate(680deg); opacity: 0; }
    }
    @keyframes sesPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeInUp 0.28s ease-out both; }

    .ses-blob { border-radius: 50%; filter: blur(70px); position: absolute; pointer-events: none; }
    .ses-blob-1 { width: 420px; height: 420px; top: -140px; left: -120px; background: rgba(13,148,136,0.28); animation: sesBlob 18s ease-in-out infinite; }
    .ses-blob-2 { width: 320px; height: 320px; top: 45%; right: -100px; background: rgba(14,116,144,0.22); animation: sesBlob 24s ease-in-out infinite reverse; }
    .ses-blob-3 { width: 280px; height: 280px; bottom: -100px; left: 40%; background: rgba(5,150,105,0.18); animation: sesBlob 20s ease-in-out infinite 4s; }

    .ses-app-bg {
      background-color: var(--background);
      background-image:
        radial-gradient(ellipse 80% 50% at 100% -20%, rgba(13,148,136,0.08), transparent 55%),
        radial-gradient(circle at 1px 1px, var(--pattern-dot) 1px, transparent 0);
      background-size: auto, 22px 22px;
    }
    .dark .ses-app-bg {
      background-image:
        radial-gradient(ellipse 80% 50% at 100% -20%, rgba(20,184,166,0.1), transparent 55%),
        radial-gradient(circle at 1px 1px, var(--pattern-dot) 1px, transparent 0);
      background-size: auto, 22px 22px;
    }

    .ses-scrollbar::-webkit-scrollbar { width: 5px; }
    .ses-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .ses-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.35); border-radius: 999px; }
    .ses-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(13, 148, 136, 0.45); }
    .ses-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(100, 116, 139, 0.35) transparent; }

    .ses-nav-scroll::-webkit-scrollbar { display: none; }
    .ses-nav-scroll { scrollbar-width: none; }

    .ses-glass-ui {
      --card: color-mix(in srgb, #ffffff 85%, transparent);
      --secondary: color-mix(in srgb, #e8efed 62%, transparent);
      --input-background: color-mix(in srgb, #e8efed 70%, transparent);
      --surface-elevated: color-mix(in srgb, #ffffff 85%, transparent);
    }
    .dark .ses-glass-ui {
      --card: color-mix(in srgb, #0d221e 85%, transparent);
      --secondary: color-mix(in srgb, #14332e 58%, transparent);
      --input-background: color-mix(in srgb, #14332e 68%, transparent);
      --surface-elevated: color-mix(in srgb, #0d221e 85%, transparent);
    }
    .ses-glass-ui.ses-glass-ui--photo {
      --card: color-mix(in srgb, #ffffff 65%, transparent);
      --secondary: color-mix(in srgb, #e8efed 48%, transparent);
      --input-background: color-mix(in srgb, #e8efed 55%, transparent);
      --surface-elevated: color-mix(in srgb, #ffffff 65%, transparent);
    }
    .dark .ses-glass-ui.ses-glass-ui--photo {
      --card: color-mix(in srgb, #0d221e 65%, transparent);
      --secondary: color-mix(in srgb, #14332e 45%, transparent);
      --input-background: color-mix(in srgb, #14332e 52%, transparent);
      --surface-elevated: color-mix(in srgb, #0d221e 65%, transparent);
    }
    .ses-glass-ui .bg-card,
    .ses-glass-ui [class*="bg-card"],
    .ses-glass-ui table {
      backdrop-filter: blur(14px) saturate(1.25);
      -webkit-backdrop-filter: blur(14px) saturate(1.25);
    }
    .ses-glass-ui.ses-glass-ui--photo .bg-card,
    .ses-glass-ui.ses-glass-ui--photo [class*="bg-card"],
    .ses-glass-ui.ses-glass-ui--photo table {
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
    }
    .ses-glass-ui table {
      background-color: transparent;
    }
    .ses-overlay-panel {
      --card: #ffffff;
      --secondary: #e8efed;
      --muted: #dde6e3;
      background-color: #ffffff !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .dark .ses-overlay-panel {
      --card: #0d221e;
      --secondary: #14332e;
      --muted: #14332e;
      background-color: #0d221e !important;
    }

    body { overflow: hidden; }
  `}</style>
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type SidebarProps = {
  collapsed: boolean;
  onSidebarToggle: () => void;
  activeNav: string;
  onNavChange: (id: string) => void;
  primaryColor: string;
  allowedNavIds: readonly string[];
  roleName?: string | null;
};

const Sidebar = ({
  collapsed, onSidebarToggle, activeNav, onNavChange, primaryColor, allowedNavIds, roleName,
}: SidebarProps) => {
  const [lang, setLang] = useState("Lotin");
  const langs = [
    { id: "Lotin",   short: "Lat" },
    { id: "Кирилл", short: "Кир" },
    { id: "Русский", short: "Рус" },
  ];

  const allowed = new Set(allowedNavIds);
  // ROLE_NAV tartibini saqlaymiz (masalan admin: Tashkilotlar → Tariflar)
  const mainItems = allowedNavIds
    .map(id => NAV_ITEMS.find(n => n.id === id && n.section === "main" && allowed.has(n.id)))
    .filter((n): n is (typeof NAV_ITEMS)[number] => n != null)
    .map(item => ({
      ...item,
      label: navItemLabel(item.id, roleName, item.label),
    }));

  return (
    <aside
      className="relative flex flex-col h-full shrink-0 overflow-hidden bg-card border-r border-border"
      style={{
        width: collapsed ? "84px" : "260px",
        transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Soft primary wash */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-44 opacity-90"
        style={{
          background: `linear-gradient(180deg, ${primaryColor}1A 0%, transparent 100%)`,
        }}
      />

      {/* Brand + collapse toggle */}
      <div className={`relative z-[1] p-3 ${collapsed ? "px-2.5" : ""}`}>
        <div
          className={`rounded-2xl border border-border bg-card/90 backdrop-blur-sm flex items-center gap-3 ${
            collapsed ? "flex-col justify-center p-2.5" : "p-3"
          }`}
        >
          <div className={`flex items-center gap-3 min-w-0 ${collapsed ? "" : "flex-1"}`}>
            <img
              src={sesLogo}
              alt="SES"
              className="w-10 h-10 rounded-full object-cover shrink-0 shadow-md bg-white"
            />
            {!collapsed && (
              <div className="overflow-hidden min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground font-extrabold text-[15px] leading-tight tracking-tight">SES</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white leading-none"
                    style={{ background: primaryColor }}
                  >
                    v2
                  </span>
                </div>
                <div className="text-muted-foreground text-[10px] mt-0.5 whitespace-nowrap">Boshqaruv paneli</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onSidebarToggle}
            title={collapsed ? "Sidebarni ochish" : "Sidebarni yopish"}
            className="p-2 rounded-xl border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft
              className="w-4 h-4 transition-transform duration-300"
              style={{ transform: collapsed ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-[1] flex-1 px-2.5 py-2 overflow-y-auto ses-nav-scroll space-y-0.5">
        {mainItems.map(item => (
          item.children?.length ? (
            <SidebarGroup
              key={item.id}
              item={item}
              collapsed={collapsed}
              activeNav={activeNav}
              primaryColor={primaryColor}
              onNavChange={onNavChange}
            />
          ) : (
            <SidebarItem key={item.id} item={item} collapsed={collapsed} active={activeNav === item.id} primaryColor={primaryColor} onNavChange={onNavChange} />
          )
        ))}

        {/* <div className={collapsed ? "my-2 mx-3 border-t border-border" : ""} />
        {!collapsed && (
          <p className="text-muted-foreground text-[9px] font-bold uppercase tracking-widest px-3 py-2 mt-3">System</p>
        )}
        {NAV_ITEMS.filter(n => n.section === "system").map(item => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} active={activeNav === item.id} primaryColor={primaryColor} onNavChange={onNavChange} />
        ))} */}
      </nav>

      {/* Bottom */}
      <div className="relative z-[1] px-2.5 pb-3 pt-2 space-y-2">
        {!collapsed ? (
          <>
            <div className="rounded-2xl border border-border bg-card/80 p-2.5">
              <div className="flex gap-1">
                {langs.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLang(l.id)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                    style={l.id === lang
                      ? { background: primaryColor, color: "#fff" }
                      : { color: "var(--muted-foreground)" }
                    }
                  >
                    {l.short}
                  </button>
                ))}
              </div>
            </div>
            <a
              href="#"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-border hover:bg-secondary/50 transition-colors group"
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">Texnik yordam</span>
            </a>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-border hover:bg-secondary/60 transition-colors"
              title="Language"
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
            </button>
            <a
              href="#"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-border hover:bg-secondary/60 transition-colors"
              title="Texnik yordam"
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        )}
      </div>
    </aside>
  );
};

const SidebarGroup = ({ item, collapsed, activeNav, primaryColor, onNavChange }: {
  item: NavItem; collapsed: boolean; activeNav: string;
  primaryColor: string; onNavChange: (id: string) => void;
}) => {
  const children = item.children ?? [];
  const childActive = children.some(child => child.id === activeNav);
  const [open, setOpen] = useState(childActive);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (childActive && !collapsed) setOpen(true);
  }, [childActive, collapsed]);

  useEffect(() => {
    if (!open || !collapsed) return;
    const handler = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, collapsed]);

  const Icon = item.icon;
  const parentActive = childActive;

  return (
    <div className="relative" ref={groupRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={collapsed ? item.label : undefined}
        className={`relative w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
          parentActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/55"
        } ${collapsed ? "justify-center px-1.5" : ""}`}
        style={parentActive ? {
          background: `${primaryColor}14`,
          boxShadow: `inset 0 0 0 1px ${primaryColor}59`,
        } : {}}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
          style={parentActive
            ? {
                background: primaryColor,
                color: "#fff",
                boxShadow: `0 6px 16px ${primaryColor}55`,
              }
            : { background: "hsl(var(--secondary))" }
          }
        >
          <Icon className="w-4 h-4" style={parentActive ? { color: "#fff" } : undefined} />
        </div>
        {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
        {!collapsed && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && !collapsed && (
        <div className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-2">
          {children.map(child => {
            const ChildIcon = child.icon;
            const active = activeNav === child.id;
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => onNavChange(child.id)}
                className={`relative w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-[12px] font-medium transition-all ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/55"
                }`}
                style={active ? {
                  background: `${primaryColor}14`,
                  boxShadow: `inset 0 0 0 1px ${primaryColor}40`,
                } : {}}
              >
                <ChildIcon className="w-3.5 h-3.5 shrink-0" style={active ? { color: primaryColor } : undefined} />
                <span className="flex-1 text-left truncate">{child.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && collapsed && (
        <div className="absolute left-full top-0 z-50 ml-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </p>
          {children.map(child => {
            const ChildIcon = child.icon;
            const active = activeNav === child.id;
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => {
                  onNavChange(child.id);
                  setOpen(false);
                }}
                className={`relative w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/55"
                }`}
                style={active ? {
                  background: `${primaryColor}14`,
                  boxShadow: `inset 0 0 0 1px ${primaryColor}40`,
                } : {}}
              >
                <ChildIcon className="w-3.5 h-3.5 shrink-0" style={active ? { color: primaryColor } : undefined} />
                <span className="flex-1 text-left truncate">{child.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ item, collapsed, active, primaryColor, onNavChange }: {
  item: NavItem; collapsed: boolean; active: boolean;
  primaryColor: string; onNavChange: (id: string) => void;
}) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavChange(item.id)}
      title={collapsed ? item.label : undefined}
      className={`relative w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-all ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/55"
      } ${collapsed ? "justify-center px-1.5" : ""}`}
      style={active ? {
        background: `${primaryColor}14`,
        boxShadow: `inset 0 0 0 1px ${primaryColor}59`,
      } : {}}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
        style={active
          ? {
              background: primaryColor,
              color: "#fff",
              boxShadow: `0 6px 16px ${primaryColor}55`,
            }
          : { background: "hsl(var(--secondary))" }
        }
      >
        <Icon className="w-4 h-4" style={active ? { color: "#fff" } : undefined} />
      </div>
      {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
      {!collapsed && active && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: primaryColor }}
        />
      )}
    </button>
  );
};

// ─── Header ───────────────────────────────────────────────────────────────────

type HeaderProps = {
  activeNav: string;
  navLabelOverride?: string;
  isDark: boolean;
  onDarkToggle: () => void;
  onSettingsOpen: () => void;
  onUserNav: (id: UserPageId) => void;
  primaryColor: string;
  wallpaperId: WallpaperId | null;
  user: AuthUser | null;
  onLogout: () => void;
};

const Header = ({
  activeNav, navLabelOverride, isDark, onDarkToggle, onSettingsOpen, onUserNav,
  primaryColor, wallpaperId, user, onLogout,
}: HeaderProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = user
    ? [user.username, user.surname].filter(Boolean).join(" ")
    : "User";
  const shortName = user?.username
    ? user.username.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
    : "U";
  const roleLabel = user?.role?.name ?? "Foydalanuvchi";

  const navLabel =
    navLabelOverride ??
    (isUserPage(activeNav) ? USER_PAGE_LABELS[activeNav] : undefined) ??
    (() => {
      const item = findNavItem(activeNav);
      return item ? navItemLabel(item.id, user?.role?.name, item.label) : undefined;
    })() ??
    "Dashboard";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`sticky top-0 px-4 pt-3 pb-1 shrink-0 ${showNotif || showUserMenu ? "z-40" : "z-[2]"}`}>
      <header className={`h-[58px] flex items-center px-3 gap-3 rounded-2xl border border-border shadow-sm backdrop-blur-md ${wallpaperId ? "bg-card/70" : "bg-card/90"}`}>
        {/* Page title */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${primaryColor}18`, color: primaryColor }}
          >
            <LayoutDashboard className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[15px] font-extrabold text-foreground leading-tight truncate">{navLabel}</h1>
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-white shrink-0"
                style={{ background: primaryColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
              <span>SES Platform</span>
              <span className="text-border">›</span>
              <span style={{ color: primaryColor }}>{navLabel}</span>
            </div>
          </div>
        </div>

        {/* Action cluster */}
        <div className="flex items-center gap-0.5 p-1 rounded-2xl border border-border bg-secondary/40">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
              className="relative p-2 rounded-xl hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
            >
              <Bell className="w-[18px] h-[18px]" />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-card"
                style={{ background: primaryColor }}
              />
            </button>

            {showNotif && (
              <div className="ses-overlay-panel absolute right-0 top-12 w-80 rounded-2xl border border-border shadow-xl overflow-hidden z-50">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <span className="font-semibold text-foreground text-sm">Bildirishnomalar</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full text-white font-medium" style={{ background: primaryColor }}>
                    2 yangi
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {NOTIFICATIONS.map(n => (
                    <div key={n.id} className="px-5 py-3.5 hover:bg-secondary/40 cursor-pointer transition-colors">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: n.unread ? primaryColor : "var(--muted)" }}
                        />
                        <div>
                          <p className="text-[13px] text-foreground leading-snug">{n.text}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-border text-center">
                  <button className="text-xs font-semibold" style={{ color: primaryColor }}>
                    Barcha bildirishnomalar
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onDarkToggle}
            className="p-2 rounded-xl hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          <button
            onClick={onSettingsOpen}
            className="p-2 rounded-xl hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* User chip */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
            className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-2xl border border-border hover:bg-secondary/50 transition-colors"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}AA)` }}
            >
              {shortName}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-[13px] font-semibold text-foreground leading-tight truncate max-w-[140px]">{displayName}</div>
              <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{roleLabel}</div>
            </div>
            <ChevronDown
              className="w-3.5 h-3.5 text-muted-foreground transition-transform"
              style={{ transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {showUserMenu && (
            <div className="ses-overlay-panel absolute right-0 top-12 w-56 rounded-2xl border border-border shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[13px] font-semibold text-foreground truncate">{displayName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{user?.email ?? ""}</div>
              </div>
              {([
                { id: "profile" as const, icon: User, label: "Mening profilim" },
                { id: "edit-profile" as const, icon: Edit3, label: "Profilni tahrirlash" },
                { id: "settings" as const, icon: Settings, label: "Sozlamalar" },
              ]).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onUserNav(item.id);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-foreground hover:bg-secondary transition-colors"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
              <div className="border-t border-border">
                <button
                  type="button"
                  onClick={() => { setShowUserMenu(false); onLogout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
};

// ─── Settings Modal ───────────────────────────────────────────────────────────

type SettingsModalProps = {
  isOpen: boolean; onClose: () => void;
  primaryColor: string; onColorChange: (c: string) => void;
  darkMode: DarkMode;
  onDarkModeChange: (m: DarkMode) => void;
  wallpaperId: WallpaperId | null;
  onWallpaperChange: (id: WallpaperId | null) => void;
};

const SettingsModal = ({
  isOpen, onClose, primaryColor, onColorChange, darkMode, onDarkModeChange,
  wallpaperId, onWallpaperChange,
}: SettingsModalProps) => {
  const [localColor, setLocalColor] = useState(primaryColor);

  useEffect(() => { setLocalColor(primaryColor); }, [primaryColor]);

  if (!isOpen) return null;

  const modes = [
    { id: "light" as const, icon: Sun, label: "Light" },
    { id: "dark" as const, icon: Moon, label: "Dark" },
    { id: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ses-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">Ko&apos;rinish sozlamalari</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ish maydonini shaxsiylashtiring</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme Mode */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Rejim</h3>
            <div className="grid grid-cols-3 gap-2">
              {modes.map(m => {
                const active = darkMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onDarkModeChange(m.id)}
                    className="flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all text-sm font-medium"
                    style={active
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

          {/* Primary Color */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Asosiy rang</h3>

            {/* Preview strip */}
            <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-2xl mb-4">
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

            {/* Preset grid */}
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
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

          {/* Wallpaper */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Orqa fon</h3>
            <p className="text-xs text-muted-foreground mb-3">Tabiat rasmini tanlang yoki standart qoldiring</p>
            <button
              type="button"
              onClick={() => onWallpaperChange(null)}
              className="mb-2 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 bg-secondary/60 transition-all"
              style={{
                borderColor: wallpaperId == null ? localColor : "var(--border)",
              }}
            >
              <ImageOff className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-left text-[12px] font-semibold text-foreground">Standart fon</span>
              {wallpaperId == null && (
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ background: localColor }}
                >
                  <Check className="w-3 h-3" />
                </span>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2">
              {WALLPAPERS.map(w => {
                const active = wallpaperId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onWallpaperChange(active ? null : w.id)}
                    className="relative aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all hover:opacity-95"
                    style={{
                      borderColor: active ? localColor : "transparent",
                      boxShadow: active ? `0 0 0 1px ${localColor}` : undefined,
                    }}
                  >
                    <img src={w.src} alt={w.label} className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5 text-left">
                      <span className="text-[11px] font-semibold text-white drop-shadow">{w.label}</span>
                    </span>
                    {active && (
                      <span
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                        style={{ background: localColor }}
                      >
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Jonli ko&apos;rinish</h3>
            <div className="p-4 bg-secondary rounded-2xl space-y-3">
              <div className="flex gap-2">
                <button
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                  style={{ background: localColor }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold border-2"
                  style={{ borderColor: localColor, color: localColor }}
                >
                  Outline
                </button>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full w-3/5 rounded-full transition-all" style={{ background: localColor }} />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-5 rounded-full p-0.5 flex items-center justify-end" style={{ background: localColor }}>
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
                <span className="text-xs text-muted-foreground">Toggle active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: localColor, background: localColor }} />
                <div className="w-3 h-3 rounded-full border-2 border-muted" />
                <span className="text-xs text-muted-foreground ml-1">Radio selection</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => {
              setLocalColor(DEFAULT_PRIMARY_COLOR);
              onColorChange(DEFAULT_PRIMARY_COLOR);
              onDarkModeChange(DEFAULT_DARK_MODE);
              onWallpaperChange(DEFAULT_WALLPAPER);
            }}
            className="flex-1 py-2.5 rounded-2xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Standart
          </button>
          <button
            onClick={() => { onColorChange(localColor); onClose(); }}
            className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: localColor }}
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard Layout ─────────────────────────────────────────────────────────

type DashboardProps = {
  primaryColor: string;
  isDark: boolean;
  onDarkToggle: () => void;
  onSettingsOpen: () => void;
  onColorChange: (c: string) => void;
  darkMode: DarkMode;
  onDarkModeChange: (m: DarkMode) => void;
  user: AuthUser | null;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
  wallpaperId: WallpaperId | null;
};

const Dashboard = ({
  primaryColor, isDark, onDarkToggle, onSettingsOpen,
  onColorChange, darkMode, onDarkModeChange,
  user, onUserUpdated, onLogout, wallpaperId,
}: DashboardProps) => {
  const roleName = user?.role?.name ?? null;
  const allowedNavIds = useMemo(() => getAllowedNavIds(roleName), [roleName]);
  const defaultNav = useMemo(() => getDefaultNavId(roleName), [roleName]);

  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState<string>(defaultNav);
  const [orderPatientId, setOrderPatientId] = useState<number | null>(null);
  const [editPatientId, setEditPatientId] = useState<number | null>(null);
  const [companiesRegionId, setCompaniesRegionId] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const activeWallpaper = wallpaperSrc(wallpaperId);

  useEffect(() => {
    if (isUserPage(activeNav)) return;
    const hasScopedCompaniesAccess =
      activeNav === "companies"
      && companiesRegionId != null
      && canAccessNav(roleName, "region-admins");
    if (!canAccessNav(roleName, activeNav) && !hasScopedCompaniesAccess) {
      setActiveNav(defaultNav);
      setOrderPatientId(null);
      setEditPatientId(null);
      setCompaniesRegionId(null);
    }
  }, [roleName, activeNav, defaultNav, companiesRegionId]);

  const handleNavChange = (id: string) => {
    if (!canAccessNav(roleName, id)) return;
    setSelectedCompany(null);
    setActiveNav(id);
    if (id !== "kassa") setOrderPatientId(null);
    if (id !== "patients") setEditPatientId(null);
    if (id !== "companies") setCompaniesRegionId(null);
  };

  const handleUserNav = (id: UserPageId) => {
    setOrderPatientId(null);
    setEditPatientId(null);
    setCompaniesRegionId(null);
    setSelectedCompany(null);
    setActiveNav(id);
  };

  const handleGoToOrder = (patientId: number) => {
    if (!canAccessNav(roleName, "kassa")) return;
    setEditPatientId(null);
    setOrderPatientId(patientId);
    setActiveNav("kassa");
  };

  const handleEditPatient = (patientId: number) => {
    if (!canAccessNav(roleName, "patients")) return;
    setOrderPatientId(null);
    setEditPatientId(patientId);
    setActiveNav("patients");
  };

  const handleOpenRegionCompanies = (regionId: number) => {
    if (!canAccessNav(roleName, "region-admins")) return;
    setCompaniesRegionId(regionId);
    setSelectedCompany(null);
    setActiveNav("companies");
  };

  const handleBackToRegionAdmins = () => {
    setSelectedCompany(null);
    setCompaniesRegionId(null);
    setActiveNav("region-admins");
  };

  const renderPage = () => {
    if (activeNav === "profile") {
      return (
        <ProfilePage
          primaryColor={primaryColor}
          user={user}
          onEditProfile={() => setActiveNav("edit-profile")}
        />
      );
    }
    if (activeNav === "edit-profile") {
      return (
        <EditProfilePage
          primaryColor={primaryColor}
          user={user}
          onUserUpdated={onUserUpdated}
          onBackToProfile={() => setActiveNav("profile")}
        />
      );
    }
    if (activeNav === "settings") {
      return (
        <SettingsPage
          primaryColor={primaryColor}
          onColorChange={onColorChange}
          darkMode={darkMode}
          onDarkModeChange={onDarkModeChange}
        />
      );
    }

    const hasScopedCompaniesAccess =
      activeNav === "companies"
      && companiesRegionId != null
      && canAccessNav(roleName, "region-admins");
    if (!canAccessNav(roleName, activeNav) && !hasScopedCompaniesAccess) return null;
    if (activeNav === "kassa") {
      return (
        <OrderPage
          primaryColor={primaryColor}
          patientId={orderPatientId}
          onPatientChange={setOrderPatientId}
          onEditPatient={handleEditPatient}
        />
      );
    }
    if (activeNav === "orders") return <OrdersPage primaryColor={primaryColor} />;
    if (activeNav === "results") return <ResultsPage primaryColor={primaryColor} />;
    if (activeNav === "patients") {
      return (
        <PatientsPage
          primaryColor={primaryColor}
          onGoToOrder={handleGoToOrder}
          initialPatientId={editPatientId}
          onInitialPatientConsumed={() => setEditPatientId(null)}
        />
      );
    }
    if (activeNav === "employees") return <EmployeesPage primaryColor={primaryColor} />;
    if (activeNav === "management") return <ManagementPage primaryColor={primaryColor} />;
    if (activeNav === "companies") {
      const normalizedRole = normalizeRoleName(roleName);
      if (selectedCompany && normalizedRole === "super_admin") {
        return (
          <SuperAdminCompanyManagementPage
            companyId={selectedCompany.id}
            companyName={selectedCompany.name}
            primaryColor={primaryColor}
            onBack={() => setSelectedCompany(null)}
          />
        );
      }
      if (selectedCompany && normalizedRole === "admin") {
        return (
          <AdminCompanyManagementPage
            companyId={selectedCompany.id}
            companyName={selectedCompany.name}
            primaryColor={primaryColor}
            onBack={() => setSelectedCompany(null)}
          />
        );
      }
      if (normalizedRole === "super_admin" && companiesRegionId != null) {
        return (
          <SuperAdminCompaniesPage
            primaryColor={primaryColor}
            scopedRegionId={companiesRegionId}
            onBack={handleBackToRegionAdmins}
            onOpenCompany={company => setSelectedCompany(company)}
          />
        );
      }
      return (
        <CompaniesPage
          primaryColor={primaryColor}
          onOpenCompany={company => setSelectedCompany(company)}
        />
      );
    }
    if (activeNav === "region-admins") {
      return (
        <SuperAdminRegionsPage
          primaryColor={primaryColor}
          onOpenRegionCompanies={handleOpenRegionCompanies}
        />
      );
    }
    if (activeNav === "plans") return <PlansPage primaryColor={primaryColor} />;
    if (activeNav === "subscriptions") return <SubscriptionsPage primaryColor={primaryColor} />;
    if (activeNav === "history") return <HistoryPage />;
    if (activeNav === "global-laboratories") {
      return <SuperAdminGlobalDataPage primaryColor={primaryColor} section="laboratories" />;
    }
    if (activeNav === "global-analyses") {
      return <SuperAdminGlobalDataPage primaryColor={primaryColor} section="analyses" />;
    }
    if (activeNav === "global-templates") {
      return <SuperAdminGlobalDataPage primaryColor={primaryColor} section="templates" />;
    }
    if (activeNav === "dashboard") return <DashboardPage primaryColor={primaryColor} />;
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden ses-app-bg">
      <Sidebar
        collapsed={collapsed}
        onSidebarToggle={() => setCollapsed(c => !c)}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        primaryColor={primaryColor}
        allowedNavIds={allowedNavIds}
        roleName={roleName}
      />
      <div className={`relative flex flex-col flex-1 overflow-hidden min-w-0 ses-glass-ui${activeWallpaper ? " ses-glass-ui--photo" : ""}`}>
        {activeWallpaper && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
            <img
              src={activeWallpaper}
              alt=""
              className="absolute inset-0 h-full w-full object-cover scale-105"
            />
            <div className="absolute inset-0 bg-background/28 dark:bg-background/40" />
          </div>
        )}
        <DashboardParticles primaryColor={primaryColor} />
        <Header
          activeNav={activeNav}
          navLabelOverride={selectedCompany ? `${selectedCompany.name} boshqaruvi` : undefined}
          isDark={isDark}
          onDarkToggle={onDarkToggle}
          onSettingsOpen={onSettingsOpen}
          onUserNav={handleUserNav}
          primaryColor={primaryColor}
          wallpaperId={wallpaperId}
          user={user}
          onLogout={onLogout}
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const showResultParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!isShowResultRoute()) return null;
    return parseShowResultParams();
  }, []);

  const [page, setPage] = useState<"login" | "dashboard">(() =>
    isAuthenticated() ? "dashboard" : "login",
  );
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [primaryColor, setPrimaryColor] = useState(getStoredPrimaryColor);
  const [darkMode, setDarkMode] = useState<DarkMode>(getStoredDarkMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wallpaperId, setWallpaperId] = useState<WallpaperId | null>(getStoredWallpaper);

  useEffect(() => {
    try {
      localStorage.setItem(WALLPAPER_KEY, wallpaperId ?? WALLPAPER_NONE);
    } catch {
      /* ignore */
    }
  }, [wallpaperId]);

  useEffect(() => {
    try {
      localStorage.setItem(DARK_MODE_KEY, darkMode);
    } catch {
      /* ignore */
    }
  }, [darkMode]);

  // Ensure role is present for already-authenticated sessions
  useEffect(() => {
    if (page !== "dashboard" || !user?.id || user.role?.name) return;
    let cancelled = false;
    void getUserById(user.id)
      .then(full => {
        if (cancelled) return;
        const next: AuthUser = {
          ...user,
          role: full.role ?? user.role ?? null,
          company: full.company ?? user.company ?? null,
        };
        setStoredUser(next);
        setUser(next);
      })
      .catch(() => {
        /* role keyinroq yuklanishi mumkin */
      });
    return () => {
      cancelled = true;
    };
  }, [page, user]);

  const isDark = useMemo(() => {
    if (darkMode === "dark") return true;
    if (darkMode === "light") return false;
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [darkMode]);

  // Sync primary color CSS var + persist
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", primaryColor);
    document.documentElement.style.setProperty("--primary-foreground", "#ffffff");
    document.documentElement.style.setProperty("--ring", primaryColor);
    try {
      localStorage.setItem(PRIMARY_COLOR_KEY, primaryColor);
    } catch {
      /* ignore */
    }
  }, [primaryColor]);

  // Sync dark mode class
  useLayoutEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleLogin = (nextUser: AuthUser) => {
    setUser(nextUser);
    setPage("dashboard");
  };

  const handleLogout = () => {
    clearSession();
    clearPdfTemplatesStorage();
    setUser(null);
    setPage("login");
  };

  const onShowResultRoute = isShowResultRoute();

  if (onShowResultRoute && showResultParams) {
    return (
      <>
        <GlobalStyles />
        <ShowResultPage params={showResultParams} />
      </>
    );
  }

  if (onShowResultRoute && !showResultParams) {
    return (
      <>
        <GlobalStyles />
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">Noto&apos;g&apos;ri havola</p>
            <p className="mt-2 text-sm text-slate-600">
              Format: /?orderId={"{id}"}&analysisId={"{id}"}&storageId={"{id}"}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      {page === "login" ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Dashboard
          primaryColor={primaryColor}
          isDark={isDark}
          onDarkToggle={() => setDarkMode(isDark ? "light" : "dark")}
          onSettingsOpen={() => setSettingsOpen(true)}
          onColorChange={setPrimaryColor}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
          user={user}
          onUserUpdated={setUser}
          onLogout={handleLogout}
          wallpaperId={wallpaperId}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        primaryColor={primaryColor}
        onColorChange={setPrimaryColor}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        wallpaperId={wallpaperId}
        onWallpaperChange={setWallpaperId}
      />
    </>
  );
}
