import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestNativeAppPermissions } from "./startup-permissions";
import { usePreferencesStore } from "@/stores/preferencesStore";

const isNativeAppMock = vi.fn();
const checkLocationMock = vi.fn();
const requestLocationMock = vi.fn();
const checkPushMock = vi.fn();
const requestPushMock = vi.fn();
const registerPushNotificationsMock = vi.fn();

vi.mock("./platform", () => ({
  isNativeApp: () => isNativeAppMock(),
}));

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    checkPermissions: () => checkLocationMock(),
    requestPermissions: () => requestLocationMock(),
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: () => checkPushMock(),
    requestPermissions: () => requestPushMock(),
  },
}));

vi.mock("./push", () => ({
  registerPushNotifications: (slug: string) => registerPushNotificationsMock(slug),
}));

describe("requestNativeAppPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.setState({ pushAlerts: false, pushDeviceToken: null });
  });

  it("returns unsupported when running in standard web browser", async () => {
    isNativeAppMock.mockResolvedValue(false);
    const result = await requestNativeAppPermissions("kampala");

    expect(result).toEqual({ location: "unsupported", notifications: "unsupported" });
    expect(checkLocationMock).not.toHaveBeenCalled();
    expect(checkPushMock).not.toHaveBeenCalled();
  });

  it("prompts for location and notifications when undecided on native", async () => {
    isNativeAppMock.mockResolvedValue(true);
    checkLocationMock.mockResolvedValue({ location: "prompt" });
    requestLocationMock.mockResolvedValue({ location: "granted" });
    checkPushMock.mockResolvedValue({ receive: "prompt" });
    requestPushMock.mockResolvedValue({ receive: "granted" });
    registerPushNotificationsMock.mockResolvedValue({ ok: true, token: "token-abc" });

    const result = await requestNativeAppPermissions("kampala");

    expect(result).toEqual({ location: "granted", notifications: "granted" });
    expect(requestLocationMock).toHaveBeenCalledTimes(1);
    expect(requestPushMock).toHaveBeenCalledTimes(1);
    expect(registerPushNotificationsMock).toHaveBeenCalledWith("kampala");
  });

  it("requests notifications when the platform recommends showing a rationale", async () => {
    isNativeAppMock.mockResolvedValue(true);
    checkLocationMock.mockResolvedValue({ location: "granted" });
    checkPushMock.mockResolvedValue({ receive: "prompt-with-rationale" });
    requestPushMock.mockResolvedValue({ receive: "granted" });
    registerPushNotificationsMock.mockResolvedValue({ ok: true, token: "token-abc" });

    const result = await requestNativeAppPermissions("kampala");

    expect(result.notifications).toBe("granted");
    expect(requestPushMock).toHaveBeenCalledTimes(1);
    expect(registerPushNotificationsMock).toHaveBeenCalledWith("kampala");
  });

  it("shares one permission request across concurrent startup calls", async () => {
    isNativeAppMock.mockResolvedValue(true);
    checkLocationMock.mockResolvedValue({ location: "prompt" });
    requestLocationMock.mockResolvedValue({ location: "granted" });
    checkPushMock.mockResolvedValue({ receive: "prompt" });
    requestPushMock.mockResolvedValue({ receive: "denied" });

    const [first, second] = await Promise.all([
      requestNativeAppPermissions("kampala"),
      requestNativeAppPermissions("kampala"),
    ]);

    expect(first).toEqual(second);
    expect(checkLocationMock).toHaveBeenCalledTimes(1);
    expect(checkPushMock).toHaveBeenCalledTimes(1);
  });

  it("does not mark push alerts enabled if device registration fails", async () => {
    isNativeAppMock.mockResolvedValue(true);
    checkLocationMock.mockResolvedValue({ location: "granted" });
    checkPushMock.mockResolvedValue({ receive: "prompt" });
    requestPushMock.mockResolvedValue({ receive: "granted" });
    registerPushNotificationsMock.mockResolvedValue({
      ok: false,
      reason: "registration_failed",
    });
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await requestNativeAppPermissions("kampala");

    expect(result.notifications).toBe("granted");
    expect(usePreferencesStore.getState().pushAlerts).toBe(false);
    expect(usePreferencesStore.getState().pushDeviceToken).toBeNull();
    expect(warningSpy).toHaveBeenCalled();
    warningSpy.mockRestore();
  });

  it("does not re-prompt if permissions are already granted", async () => {
    isNativeAppMock.mockResolvedValue(true);
    checkLocationMock.mockResolvedValue({ location: "granted" });
    checkPushMock.mockResolvedValue({ receive: "granted" });

    const result = await requestNativeAppPermissions("entebbe");

    expect(result).toEqual({ location: "granted", notifications: "granted" });
    expect(requestLocationMock).not.toHaveBeenCalled();
    expect(requestPushMock).not.toHaveBeenCalled();
  });

  it("handles denial gracefully without throwing", async () => {
    isNativeAppMock.mockResolvedValue(true);
    checkLocationMock.mockResolvedValue({ location: "prompt" });
    requestLocationMock.mockResolvedValue({ location: "denied" });
    checkPushMock.mockResolvedValue({ receive: "prompt" });
    requestPushMock.mockResolvedValue({ receive: "denied" });

    const result = await requestNativeAppPermissions("kampala");

    expect(result).toEqual({ location: "denied", notifications: "denied" });
    expect(usePreferencesStore.getState().pushAlerts).toBe(false);
  });
});
