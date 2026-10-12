import { render, screen, fireEvent } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { LoadMoreError } from "../LoadMoreError";

describe("LoadMoreError", () => {
  it("shows the fallback text for a non-API error and retries on click", () => {
    const onRetry = jest.fn();
    render(<LoadMoreError error={new Error("boom")} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load more results.");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the API's message when there is one", () => {
    const err = new AxiosError("429", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 429, statusText: "", headers: {}, config: { headers: new AxiosHeaders() },
      data: { detail: "Request was throttled." },
    });
    render(<LoadMoreError error={err} onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Request was throttled.");
  });
});
