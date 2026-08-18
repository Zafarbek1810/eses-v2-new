import { apiRequest } from "./client";
import type { LoginResponse } from "./session";

export type { AuthUser } from "./session";
export type { LoginResponse } from "./session";

export type LoginPayload = {
  email: string;
  password: string;
};

export {
  saveSession,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setStoredUser,
  getStoredCompanyId,
  isAuthenticated,
} from "./session";

export { ApiError } from "./client";

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/user/login", {
    method: "POST",
    body: payload,
    auth: false,
    fallbackError: "Kirish muvaffaqiyatsiz",
  });
}
