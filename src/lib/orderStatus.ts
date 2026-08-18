/** API status kodlarining UI uchun o'zbekcha matnlari */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  partially_completed: "Qisman yakunlangan",
  completed: "Yakunlangan",
  canceled: "Bekor qilingan",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  paid: "To'langan",
  refunded: "Qaytarilgan",
};

export const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  in_progress: "Jarayonda",
  completed: "Yakunlangan",
  canceled: "Bekor qilingan",
};

/** Umumiy holatlar (order / payment / item) */
const ALL_STATUS_LABELS: Record<string, string> = {
  ...ORDER_STATUS_LABELS,
  ...PAYMENT_STATUS_LABELS,
  ...ITEM_STATUS_LABELS,
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ALL_STATUS_LABELS[status] ?? status;
}
