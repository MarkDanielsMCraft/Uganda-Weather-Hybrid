import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addListenerMock, registerMock, unregisterMock } = vi.hoisted(() => ({
  addListenerMock: vi.fn(),
  registerMock: vi.fn(),
  unregisterMock: vi.fn(),
}));

vi.mock("./platform", () => ({
  isNativeApp: vi.fn().mockResolvedValue(true),
  nativePlatform: vi.fn().mockResolvedValue("android"),
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    addListener: addListenerMock,
    checkPermissions: vi.fn().mockResolvedValue({ receive: "granted" }),
    register: registerMock,
    unregister: unregisterMock,
  },
}));

import { registerPushNotifications, unregisterPushNotifications } from "./push";

describe("native push registration lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addListenerMock.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps native registration intact when server cleanup fails", async () => {
    unregisterMock.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(unregisterPushNotifications("device-token")).rejects.toThrow(
      "Push token removal failed with status 503",
    );

    expect(unregisterMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/push/register",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("reports native unregister failure after removing the server token", async () => {
    unregisterMock.mockRejectedValue(new Error("native unregister failed"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(unregisterPushNotifications("device-token")).resolves.toBe(false);

    expect(fetch).toHaveBeenCalledOnce();
    expect(unregisterMock).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("fails registration explicitly when the native plugin rejects", async () => {
    registerMock.mockRejectedValue(new Error("native registration failed"));

    await expect(registerPushNotifications("kampala")).resolves.toEqual({
      ok: false,
      reason: "registration_failed",
    });

    expect(addListenerMock).toHaveBeenCalledTimes(2);
  });
});
