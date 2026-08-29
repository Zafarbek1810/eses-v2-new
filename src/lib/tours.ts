import type { AppRole, NavId } from "@/lib/roles";
import { getAllowedNavIds, normalizeRoleName } from "@/lib/roles";

export type TourStep = {
  /** CSS selector or `null` for centered welcome/finish steps */
  target: string | null;
  title: string;
  description: string;
  /** Expand sidebar before highlighting (for nav items) */
  ensureSidebarOpen?: boolean;
};

const NAV_DESCRIPTIONS: Record<NavId, string> = {
  dashboard:
    "Bosh sahifada tizim statistikasi, tezkor ko'rsatkichlar va umumiy holatni kuzatishingiz mumkin.",
  management:
    "Tashkilot boshqaruvi: rollar, foydalanuvchilar, laboratoriyalar, analizlar va PDF shablonlarni sozlash.",
  "region-admins":
    "Viloyat adminlarini yaratish, tahrirlash va ularning tashkilotlarini boshqarish.",
  companies:
    "Tashkilotlar ro'yxati. Yangi tashkilot ochish yoki mavjud tashkilot ichidagi sozlamalarni boshqarish.",
  plans:
    "Tarif rejalari — tizim obunalari va narxlar bilan ishlash.",
  subscriptions:
    "Faol obunalar, to'lov holati va obuna tarixini ko'rish.",
  patients:
    "Bemorlarni ro'yxatga olish, ma'lumotlarini tahrirlash va yangi bemor qo'shish.",
  kassa:
    "Kassa bo'limi — bemor buyurtmalarini qabul qilish, analizlar tanlash va to'lov.",
  orders:
    "Laboratoriya buyurtmalari — kassadan kelgan buyurtmalarni ko'rish va boshqarish.",
  results:
    "Tahlil natijalarini ko'rish, tasdiqlash va PDF shaklida chiqarish.",
  history:
    "Tizimdagi barcha harakatlar va o'zgarishlar tarixi.",
  "global-data":
    "Global ma'lumotlar — barcha tashkilotlar uchun umumiy laboratoriyalar, analizlar va shablonlar.",
  "global-laboratories":
    "Global laboratoriyalar katalogi — barcha tashkilotlar uchun umumiy lab ro'yxati.",
  "global-analyses":
    "Global analizlar — tizimga kiritilgan barcha tahlil turlari.",
  "global-templates":
    "Global PDF shablonlar — natija blankalarini boshqarish.",
  hr:
    "HR dasturini ochish — xodimlar va davomat tizimi alohida oynada ishga tushadi.",
  "ai-demo":
    "Sun'iy intellekt demo — tizim imkoniyatlarini sinab ko'rish uchun AI yordamchi.",
  employees: "Xodimlar bo'limi.",
};

const COMMON_HEADER_STEPS: TourStep[] = [
  {
    target: '[data-tour="header-title"]',
    title: "Sahifa sarlavhasi",
    description:
      "Bu yerda joriy ochiq bo'lim nomi va navigatsiya yo'li ko'rsatiladi.",
  },
  {
    target: '[data-tour="header-notifications"]',
    title: "Bildirishnomalar",
    description:
      "Yangi buyurtmalar, natijalar va tizim xabarlari haqida bildirishnomalarni shu yerda ko'rasiz.",
  },
  {
    target: '[data-tour="header-theme"]',
    title: "Mavzu",
    description:
      "Qorong'u va yorug' rejim o'rtasida almashtirish uchun bosing.",
  },
  {
    target: '[data-tour="header-settings"]',
    title: "Tez sozlamalar",
    description:
      "Asosiy rang, fon rasmi va ko'rinish sozlamalarini tezda ochish.",
  },
  {
    target: '[data-tour="header-user-menu"]',
    title: "Foydalanuvchi menyusi",
    description:
      "Profil, profilni tahrirlash, sozlamalar va tizimdan chiqish shu menyu orqali.",
  },
];

const COMMON_SIDEBAR_FOOTER_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-language"]',
    title: "Til",
    description: "Interfeys tilini Lotin, Kirill yoki Rus tiliga o'zgartirish.",
    ensureSidebarOpen: true,
  },
  {
    target: '[data-tour="sidebar-support"]',
    title: "Texnik yordam",
    description:
      "Muammo yuzaga kelganda Telegram orqali texnik yordam yoki telefon raqam orqali bog'lanish.",
    ensureSidebarOpen: true,
  },
];

function navStep(navId: NavId, label: string): TourStep {
  return {
    target: `[data-tour="nav-${navId}"]`,
    title: label,
    description: NAV_DESCRIPTIONS[navId] ?? label,
    ensureSidebarOpen: true,
  };
}

const NAV_LABELS: Record<NavId, string> = {
  dashboard: "Bosh sahifa",
  management: "Boshqaruv",
  "region-admins": "Viloyat adminlari",
  companies: "Tashkilotlar",
  plans: "Tariflar",
  subscriptions: "Obunalar",
  patients: "Ro'yxatga olish",
  kassa: "Kassa",
  orders: "Laboratoriya mudiri",
  results: "Natijalar",
  history: "Tarix",
  "global-data": "Global ma'lumotlar",
  "global-laboratories": "Global laboratoriyalar",
  "global-analyses": "Global analizlar",
  "global-templates": "Global shablonlar",
  hr: "HR",
  "ai-demo": "Sun'iy intellekt (demo)",
  employees: "Xodimlar",
};

/** Admin roli uchun companies label */
function navLabelForRole(navId: NavId, role: AppRole): string {
  if (navId === "companies" && role === "admin") return "Tashkilotlar";
  return NAV_LABELS[navId] ?? navId;
}

export function buildTourSteps(roleName: string | null | undefined): TourStep[] {
  const role = normalizeRoleName(roleName);
  if (!role) return [];

  const allowed = getAllowedNavIds(roleName);
  const steps: TourStep[] = [
    {
      target: null,
      title: "SES platformasiga xush kelibsiz!",
      description:
        "Bu qisqa yo'riqnoma sizga menyu, sidebar va header funksiyalarini tanishtiradi. «Keyingi» tugmasi bilan davom eting yoki «To'xtatish» orqali o'tkazib yuboring.",
    },
    {
      target: '[data-tour="sidebar-toggle"]',
      title: "Sidebar",
      description:
        "Chap panelni yig'ish yoki kengaytirish. Yig'ilgan holatda menyu belgilarini ko'rasiz.",
      ensureSidebarOpen: true,
    },
  ];

  for (const navId of allowed) {
    if (navId === "global-data") {
      steps.push(navStep("global-data", NAV_LABELS["global-data"]));
      steps.push(navStep("global-laboratories", NAV_LABELS["global-laboratories"]));
      steps.push(navStep("global-analyses", NAV_LABELS["global-analyses"]));
      steps.push(navStep("global-templates", NAV_LABELS["global-templates"]));
    } else {
      steps.push(navStep(navId, navLabelForRole(navId, role)));
    }
  }

  steps.push(...COMMON_SIDEBAR_FOOTER_STEPS);
  steps.push(...COMMON_HEADER_STEPS);
  steps.push({
    target: null,
    title: "Tayyor!",
    description:
      "Yo'riqnoma yakunlandi. Endi tizimdan to'liq foydalanishingiz mumkin. Omad!",
  });

  return steps;
}

const TOUR_STORAGE_PREFIX = "ses_tour_completed_v1";

export function getTourStorageKey(userId: number, roleName: string | null | undefined): string {
  const role = normalizeRoleName(roleName) ?? "unknown";
  return `${TOUR_STORAGE_PREFIX}_${userId}_${role}`;
}

export function isTourCompleted(userId: number, roleName: string | null | undefined): boolean {
  try {
    return localStorage.getItem(getTourStorageKey(userId, roleName)) === "1";
  } catch {
    return false;
  }
}

export function markTourCompleted(userId: number, roleName: string | null | undefined): void {
  try {
    localStorage.setItem(getTourStorageKey(userId, roleName), "1");
  } catch {
    /* ignore */
  }
}

export function clearTourCompleted(userId: number, roleName: string | null | undefined): void {
  try {
    localStorage.removeItem(getTourStorageKey(userId, roleName));
  } catch {
    /* ignore */
  }
}
