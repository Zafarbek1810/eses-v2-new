import type { Laboratory } from "@/api/laboratory";
import type { Order, OrderItem } from "@/api/order";
import { resolveOrderItemAnalysisId } from "@/api/order";

export type LabScope = {
  labIds: Set<number>;
  analysisIds: Set<number>;
};

function addUserId(ids: number[], raw: unknown) {
  if (raw == null || raw === "") return;
  if (Array.isArray(raw)) {
    for (const item of raw) addUserId(ids, item);
    return;
  }
  if (typeof raw === "number" || typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) ids.push(n);
    return;
  }
  if (typeof raw === "object" && raw !== null && "id" in raw) {
    const n = Number((raw as { id: unknown }).id);
    if (Number.isFinite(n) && n > 0) ids.push(n);
  }
}

/** lab_director / lab_asistant / kassir_sangig — login qilgan user qaysi lab(lar)ga tegishli */
export function userBelongsToLab(lab: Laboratory, userId: number): boolean {
  if (Number(lab.lab_director?.id) === userId) return true;
  if ((lab.lab_assistants ?? []).some(a => Number(a.id) === userId)) return true;

  const extra = lab as Laboratory & Record<string, unknown>;
  const ids: number[] = [];
  addUserId(ids, extra.kassir_sangig);
  addUserId(ids, extra.kassirSangig);
  addUserId(ids, extra.kassir_sangigs);
  addUserId(ids, extra.kassir_sangig_id);
  addUserId(ids, extra.kassirSangigId);
  addUserId(ids, extra.users);
  addUserId(ids, extra.user);
  return ids.includes(userId);
}

export function resolveUserLabScope(labs: Laboratory[], userId: number): LabScope {
  const labIds = new Set<number>();
  const analysisIds = new Set<number>();

  for (const lab of labs) {
    if (!userBelongsToLab(lab, userId)) continue;

    labIds.add(lab.id);
    for (const raw of lab.analysis ?? []) {
      const id = Number(
        raw && typeof raw === "object" && "id" in raw
          ? (raw as { id?: unknown }).id
          : NaN,
      );
      if (Number.isFinite(id) && id > 0) analysisIds.add(id);
    }
  }

  return { labIds, analysisIds };
}

export function orderItemInLabScope(
  item: OrderItem,
  scope: LabScope,
): boolean {
  const labId = item.laboratory?.id;
  if (labId != null && scope.labIds.has(labId)) return true;
  const analysisId = resolveOrderItemAnalysisId(item);
  if (analysisId != null && scope.analysisIds.has(analysisId)) return true;
  return false;
}

export function matchesLabScope(
  laboratoryId: number | null | undefined,
  analysisId: number | null | undefined,
  scope: LabScope,
): boolean {
  if (laboratoryId != null && scope.labIds.has(laboratoryId)) return true;
  if (analysisId != null && scope.analysisIds.has(analysisId)) return true;
  return false;
}

export function orderTouchesLabScope(order: Order, scope: LabScope): boolean {
  return (order.items ?? []).some(item => orderItemInLabScope(item, scope));
}

export function filterOrderItemsByLabScope(
  items: OrderItem[] | undefined,
  scope: LabScope,
): OrderItem[] {
  return (items ?? []).filter(item => orderItemInLabScope(item, scope));
}
