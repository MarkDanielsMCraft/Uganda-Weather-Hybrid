// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHideOnScrollDown } from "@/hooks/useHideOnScrollDown";

function makeScroller(scrollHeight = 2000, clientHeight = 500): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  document.body.appendChild(el);
  return el;
}

function scrollTo(el: HTMLElement, top: number) {
  act(() => {
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll"));
  });
}

describe("useHideOnScrollDown", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hides when the user scrolls down and shows again when they scroll up", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useHideOnScrollDown(true));

    scrollTo(el, 100);
    scrollTo(el, 200);
    expect(result.current.hidden).toBe(true);

    scrollTo(el, 150);
    expect(result.current.hidden).toBe(false);
  });

  it("ignores tiny movements so the button does not flicker", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useHideOnScrollDown(true));

    scrollTo(el, 100);
    scrollTo(el, 108);
    expect(result.current.hidden).toBe(false);
  });

  it("always shows near the top and the bottom of the page", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useHideOnScrollDown(true));

    scrollTo(el, 100);
    scrollTo(el, 400);
    expect(result.current.hidden).toBe(true);

    scrollTo(el, 1490);
    expect(result.current.hidden).toBe(false);
  });

  it("stays visible while disabled, for example when the panel is open", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useHideOnScrollDown(false));

    scrollTo(el, 100);
    scrollTo(el, 400);
    expect(result.current.hidden).toBe(false);
  });

  it("reveal brings the button back, for keyboard users who tab to it", () => {
    const el = makeScroller();
    const { result } = renderHook(() => useHideOnScrollDown(true));

    scrollTo(el, 100);
    scrollTo(el, 400);
    act(() => result.current.reveal());
    expect(result.current.hidden).toBe(false);
  });
});
