/** Format ISO date as dd.mm.yyyy with hh:mm on the next line */
export function formatDate(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year}\n${hours}:${minutes}`;
  } catch {
    return String(iso);
  }
}
