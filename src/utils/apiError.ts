import type { AxiosError } from "axios";

export function getApiError(error: unknown, fallback = "An unexpected error occurred."): string {
  if (!error) return fallback;
  const axiosError = error as AxiosError<Record<string, unknown>>;
  const data = axiosError.response?.data;
  if (!data) {
    if (axiosError.message) return axiosError.message;
    return fallback;
  }
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.non_field_errors === "string") return data.non_field_errors;
  if (Array.isArray(data.non_field_errors)) return (data.non_field_errors as string[]).join(" ");
  const firstField = Object.values(data)[0];
  if (Array.isArray(firstField)) return (firstField as string[]).join(" ");
  if (typeof firstField === "string") return firstField;
  return fallback;
}
