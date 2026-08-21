import type { Laboratory } from "@/api/laboratory";
import type { Order, OrderItem } from "@/api/order";
import { resolveOrderItemAnalysisId } from "@/api/order";

export type LabScope = {
  labIds: Set<number>;
  analysisIds: Set<number>;
};

/** lab_director / lab_asistant — login qilgan user qaysi lab(lar)ga tegishli */
export function resolveUserLabScope(labs: Laboratory[], userId: number): LabScope {
  const labIds = new Set<number>();
  const analysisIds = new Set<number>();

  for (const lab of labs) {
    const isDirector = Number(lab.lab_director?.id) === userId;
    const isAssistant = (lab.lab_assistants ?? []).some(
      a => Number(a.id) === userId,
    );
    if (!isDirector && !isAssistant) continue;

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
