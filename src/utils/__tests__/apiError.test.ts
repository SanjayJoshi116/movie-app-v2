import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { CONNECTION_ERROR, getApiError } from "../apiError";

const FALLBACK = "Failed to save rating.";

function withResponse(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  const response = { status, statusText: String(status), headers: {}, config, data } as AxiosResponse;
  return new AxiosError(`HTTP ${status}`, "ERR_BAD_RESPONSE", config, null, response);
}

describe("getApiError", () => {
  it("uses the call site's message for an HTML error page, not its first character", () => {
    expect(getApiError(withResponse(502, "<html><body>502 Bad Gateway</body></html>"), FALLBACK)).toBe(FALLBACK);
  });

  it("uses the call site's message for an empty-string body", () => {
    expect(getApiError(withResponse(500, "\n"), FALLBACK)).toBe(FALLBACK);
  });

  it("uses the call site's message for an array body", () => {
    expect(getApiError(withResponse(500, ["x"]), FALLBACK)).toBe(FALLBACK);
  });

  it("uses the call site's message for an empty object body", () => {
    expect(getApiError(withResponse(500, {}), FALLBACK)).toBe(FALLBACK);
  });

  it("reads DRF's detail", () => {
    expect(getApiError(withResponse(400, { detail: "Incorrect password." }), FALLBACK)).toBe("Incorrect password.");
  });

  it("joins non_field_errors", () => {
    expect(getApiError(withResponse(400, { non_field_errors: ["Bad.", "Worse."] }), FALLBACK)).toBe("Bad. Worse.");
  });

  it("reads the first field's errors", () => {
    expect(getApiError(withResponse(400, { username: ["This username is already taken."] }), FALLBACK))
      .toBe("This username is already taken.");
  });

  it("ignores a non-string field value", () => {
    expect(getApiError(withResponse(400, { count: 3 }), FALLBACK)).toBe(FALLBACK);
  });

  it("says the server can't be reached on a network error", () => {
    const config = { headers: new AxiosHeaders() };
    expect(getApiError(new AxiosError("Network Error", "ERR_NETWORK", config), FALLBACK)).toBe(CONNECTION_ERROR);
  });

  it("says the server can't be reached on a timeout", () => {
    const config = { headers: new AxiosHeaders() };
    expect(getApiError(new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED", config), FALLBACK))
      .toBe(CONNECTION_ERROR);
  });

  it("never shows a JS runtime error's message", () => {
    expect(getApiError(new TypeError("Cannot read properties of undefined (reading 'id')"), FALLBACK)).toBe(FALLBACK);
  });

  it("falls back on nothing at all", () => {
    expect(getApiError(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
