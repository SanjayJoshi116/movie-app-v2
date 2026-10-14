import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { confirmPasswordReset, requestPasswordReset } from "../../api/userApi";
import { CONNECTION_ERROR } from "../../utils/apiError";
import ResetPasswordPage from "../ResetPasswordPage";
import ForgotPasswordPage from "../ForgotPasswordPage";
import RegisterPage from "../RegisterPage";

jest.mock("../../api/userApi", () => ({ __esModule: true, confirmPasswordReset: jest.fn(), requestPasswordReset: jest.fn() }));
const mockRegister = jest.fn();
jest.mock("../../context/AuthContext", () => ({ useAuth: () => ({ register: mockRegister }) }));

beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((() => ({
    matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia);
});
beforeEach(() => jest.clearAllMocks());

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const noResponse = () => new AxiosError("Network Error", "ERR_NETWORK", config);
const withResponse = (status: number, data: unknown) =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, undefined, { status, statusText: "", headers: {}, config, data });

const at = (path: string, route: string, element: React.ReactElement) =>
  render(
    <App>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={route} element={element} /></Routes>
      </MemoryRouter>
    </App>,
  );

const PASSWORD = "Xk9#mQ2vTz8p";

async function submitReset() {
  at("/reset-password/u/t", "/reset-password/:uid/:token", <ResetPasswordPage />);
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: PASSWORD } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole("button", { name: /reset/i }));
  await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalled());
}

it("reset with no response says the server can't be reached", async () => {
  (confirmPasswordReset as jest.Mock).mockRejectedValue(noResponse());
  await submitReset();
  expect(await screen.findByText(CONNECTION_ERROR)).toBeInTheDocument();
  expect(screen.queryByText("Invalid or expired reset link.")).toBeNull();
});

it("reset with an HTML 502 doesn't claim the link expired", async () => {
  (confirmPasswordReset as jest.Mock).mockRejectedValue(withResponse(502, "<html>Bad Gateway</html>"));
  await submitReset();
  expect(await screen.findByText("Couldn't reset your password. The link may have expired.")).toBeInTheDocument();
  expect(screen.queryByText("Invalid or expired reset link.")).toBeNull();
});

it("reset keeps the server's own message", async () => {
  (confirmPasswordReset as jest.Mock).mockRejectedValue(withResponse(400, { detail: "Invalid or expired reset link." }));
  await submitReset();
  expect(await screen.findByText("Invalid or expired reset link.")).toBeInTheDocument();
});

it("forgot password offline says the server can't be reached, without mentioning the backend", async () => {
  (requestPasswordReset as jest.Mock).mockRejectedValue(noResponse());
  at("/forgot-password", "/forgot-password", <ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(await screen.findByText(CONNECTION_ERROR)).toBeInTheDocument();
  expect(screen.queryByText(/backend/i)).toBeNull();
});

it("register with a nested error body never shows [object Object]", async () => {
  mockRegister.mockRejectedValue(withResponse(400, { profile: { nested: ["bad"] } }));
  at("/register", "/register", <RegisterPage />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newuser" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole("button", { name: /create account|register|sign up/i }));
  expect(await screen.findByText("Registration failed.")).toBeInTheDocument();
  expect(screen.queryByText(/\[object Object\]/)).toBeNull();
});
