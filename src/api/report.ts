import { apiRequest } from "./client";

export type ExcelReportFilters = {
  date?: string;
  month?: string;
  type?: "range";
  startDate?: string;
  endDate?: string;
  lab_id?: number;
  min_age?: number;
  max_age?: number;
  patient_id?: number;
  search?: string;
};

export function getExcelReport(filters: ExcelReportFilters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiRequest<Blob>(`/report/excel${query.size ? `?${query}` : ""}`, {
    method: "GET",
    responseType: "blob",
    headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    fallbackError: "Excel hisobotini yuklab bo‘lmadi",
  });
}
