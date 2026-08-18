import { apiRequest } from "./client";

export type District = {
  id: number;
  name: string;
  createdAt: string;
};

export type RegionCompany = {
  id: number;
  name: string;
  description?: string;
  address?: string;
  phone?: string | null;
  active?: boolean;
  createdAt: string;
};

export type Region = {
  id: number;
  name: string;
  createdAt: string;
  district: District[];
  company?: RegionCompany[];
};

export function getAllRegions() {
  return apiRequest<Region[]>("/region/getallregion", {
    method: "GET",
    fallbackError: "Viloyatlarni yuklab bo'lmadi",
  });
}
