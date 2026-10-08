import { act, renderHook, screen } from "@testing-library/react";
import { App } from "antd";
import { ReactNode } from "react";
import { useToast } from "../useToast";

const wrapper = ({ children }: { children: ReactNode }) => <App>{children}</App>;

describe("useToast", () => {
  it("shows one message when the same text is reported twice (deduped double-click)", async () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showSuccess("Added to watchlist");
      result.current.showSuccess("Added to watchlist");
    });
    expect(await screen.findAllByText("Added to watchlist")).toHaveLength(1);
  });

  it("still shows different messages side by side", async () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.showSuccess("Added to watchlist");
      result.current.showError("Failed to update follow status.");
    });
    expect(await screen.findByText("Added to watchlist")).toBeInTheDocument();
    expect(await screen.findByText("Failed to update follow status.")).toBeInTheDocument();
  });
});
