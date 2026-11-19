// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LugandaBetaBanner } from "@/components/feedback/LugandaBetaBanner";
import { DetailSheetProvider } from "@/components/sheet/DetailSheetProvider";
import { usePreferencesStore } from "@/stores/preferencesStore";

describe("LugandaBetaBanner & LugandaFeedbackForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
    usePreferencesStore.setState({
      uiLanguage: "en",
      districtSlug: "kampala",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not render in English mode", () => {
    render(
      <DetailSheetProvider>
        <LugandaBetaBanner />
      </DetailSheetProvider>,
    );

    expect(
      screen.queryByText("Enkyusa y'Oluganda ekyagezesebwa (Beta)"),
    ).toBeNull();
    expect(screen.queryByText("Luganda version is in beta")).toBeNull();
  });

  it("renders the beta notice when switched to Luganda and opens the modern issue reporting form", async () => {
    usePreferencesStore.setState({ uiLanguage: "lg" });

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { accepted: true, reportId: "rep-123" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <DetailSheetProvider>
        <LugandaBetaBanner />
      </DetailSheetProvider>,
    );

    expect(
      await screen.findByText("Enkyusa y'Oluganda ekyagezesebwa (Beta)"),
    ).toBeTruthy();

    const reportButton = screen.getByRole("button", { name: "Loopa ensobi" });
    fireEvent.click(reportButton);

    expect(
      await screen.findByText("Okulongoosa Oluganda", {}, { timeout: 4000 }),
    ).toBeTruthy();

    const detailsInput = screen.getByLabelText("Ennyonnyola y'ensobi");
    fireEvent.change(detailsInput, {
      target: { value: "Ekigambo kino kirina okuwandiikibwa n'akasalako." },
    });

    const submitButton = screen.getByRole("button", { name: "Weereza obubaka" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("Weebale nnyo!")).toBeTruthy();
    expect(screen.getByTestId("feedback-state-sent")).toBeTruthy();
  });

  it("transitions to the failed state with a Lucide failure icon and preserves user input on error", async () => {
    usePreferencesStore.setState({ uiLanguage: "lg" });

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Failed" },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <DetailSheetProvider>
        <LugandaBetaBanner />
      </DetailSheetProvider>,
    );

    const reportButton = await screen.findByRole("button", {
      name: "Loopa ensobi",
    });
    fireEvent.click(reportButton);

    const detailsInput = await screen.findByLabelText("Ennyonnyola y'ensobi");
    fireEvent.change(detailsInput, {
      target: { value: "Ekigambo kino kirina ensobi mu mpandiika." },
    });

    const submitButton = screen.getByRole("button", { name: "Weereza obubaka" });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText("Obubaka tebusobose kugenda"),
    ).toBeTruthy();
    expect(screen.getByTestId("feedback-state-failed")).toBeTruthy();

    // Clicking try again returns to the form with the user's input intact
    const tryAgainButton = screen.getByRole("button", {
      name: "Ddamu ogezeeko",
    });
    fireEvent.click(tryAgainButton);

    const restoredInput = (await screen.findByLabelText(
      "Ennyonnyola y'ensobi",
    )) as HTMLTextAreaElement;
    expect(restoredInput.value).toBe(
      "Ekigambo kino kirina ensobi mu mpandiika.",
    );
  });

  it("re-displays the notice when a user switches from English back to Luganda after dismissing", async () => {
    usePreferencesStore.setState({ uiLanguage: "lg" });

    render(
      <DetailSheetProvider>
        <LugandaBetaBanner />
      </DetailSheetProvider>,
    );

    expect(
      await screen.findByText("Enkyusa y'Oluganda ekyagezesebwa (Beta)"),
    ).toBeTruthy();

    const dismissBtn = screen.getByRole("button", {
      name: "Ggalawo obubaka buno",
    });
    fireEvent.click(dismissBtn);

    expect(
      screen.queryByText("Enkyusa y'Oluganda ekyagezesebwa (Beta)"),
    ).toBeNull();

    // Switch to English then back to Luganda in separate renders
    act(() => {
      usePreferencesStore.getState().setUiLanguage("en");
    });
    act(() => {
      usePreferencesStore.getState().setUiLanguage("lg");
    });

    expect(
      await screen.findByText("Enkyusa y'Oluganda ekyagezesebwa (Beta)"),
    ).toBeTruthy();
  });
});
