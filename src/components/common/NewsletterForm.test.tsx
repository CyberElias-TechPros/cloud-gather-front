import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterForm } from "./NewsletterForm";
import { renderWithProviders } from "@/test/utils";

const subscribeNewsletter = vi.fn();

vi.mock("@/services/system", () => ({
  subscribeNewsletter: (...args: unknown[]) => subscribeNewsletter(...args),
  getConfig: () => Promise.resolve({}),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("NewsletterForm", () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeNewsletter.mockReset();
    subscribeNewsletter.mockResolvedValue({ ok: true, message: "Subscribed" });
  });

  it("rejects an invalid address without calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsletterForm />);

    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(subscribeNewsletter).not.toHaveBeenCalled();
  });

  it("submits a valid address with its source and confirms", async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewsletterForm source="footer" />);

    await user.type(screen.getByLabelText(/email address/i), "reader@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => expect(subscribeNewsletter).toHaveBeenCalledWith("reader@example.com", "footer"));
    expect(await screen.findByText(/subscribed/i)).toBeInTheDocument();
  });

  it("surfaces a server error inline and keeps the form usable", async () => {
    subscribeNewsletter.mockRejectedValue(new Error("Already subscribed"));
    const user = userEvent.setup();
    renderWithProviders(<NewsletterForm />);

    await user.type(screen.getByLabelText(/email address/i), "reader@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(await screen.findByText(/already subscribed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });
});
