import { apiRequest } from "./client";

export type PatientDistrict = {
  id: number;
  name: string;
  createdAt?: string;
  region?: {
    id: number;
    name: string;
    createdAt?: string;
  };
};

export type Patient = {
  id: number;
  first_name: string;
  last_name: string;
  birth_day: string;
  phone: string;
  sex: number;
  village: string;
  street: string;
  description: string;
  district_id?: number;
  district?: PatientDistrict | null;
  createdAt?: string;
};

export type PatientPayload = {
  first_name: string;
  last_name: string;
  birth_day: string;
  phone: string;
  sex: number;
  village: string;
  street: string;
  description: string;
  district_id: number;
  owner_id: number;
};

export type PatientsFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PatientsFullResponse = {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
};

function normalizeFullResponse(
  raw: unknown,
  params: PatientsFullParams,
): PatientsFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Patient[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.patients ?? obj.items ?? obj.result) as
      | Patient[]
      | undefined;
    const total =
      typeof obj.total === "number"
        ? obj.total
        : typeof obj.count === "number"
          ? obj.count
          : typeof obj.totalCount === "number"
            ? obj.totalCount
            : Array.isArray(data)
              ? data.length
              : 0;
    const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;

    return {
      data: Array.isArray(data) ? data : [],
      total: typeof meta?.total === "number" ? meta.total : total,
      page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
      limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export function getAllPatients() {
  return apiRequest<Patient[]>("/patient/getall", {
    method: "GET",
    fallbackError: "Bemorlarni yuklab bo'lmadi",
  });
}

export async function getPatientsFull(
  params: PatientsFullParams = {},
): Promise<PatientsFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/patient/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Bemorlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getPatientById(id: number) {
  return apiRequest<Patient>(`/patient/getby/${id}`, {
    method: "GET",
    fallbackError: "Bemorni yuklab bo'lmadi",
  });
}

export function addPatient(payload: PatientPayload) {
  return apiRequest<Patient>("/patient/add", {
    method: "POST",
    body: payload,
    fallbackError: "Bemorni qo'shib bo'lmadi",
  });
}

export function updatePatient(id: number, payload: PatientPayload) {
  return apiRequest<Patient>(`/patient/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Bemorni yangilab bo'lmadi",
  });
}

export function deletePatient(id: number) {
  return apiRequest<unknown>(`/patient/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Bemorni o'chirib bo'lmadi",
  });
}
