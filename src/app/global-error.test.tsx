// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("GlobalError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls reset when provided for a regular runtime error", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("Boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reloads the page instead of crashing when reset is missing", () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    render(<GlobalError error={new Error("Root boundary error")} />);

    fireEvent.click(screen.getByRole("button"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads the page on ChunkLoadError even when reset is provided", () => {
    const reset = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    const chunkError = new Error("Loading chunk failed");
    chunkError.name = "ChunkLoadError";

    render(<GlobalError error={chunkError} reset={reset} />);

    fireEvent.click(screen.getByRole("button"));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
