/** A real reachability probe, not a data call: a plain GET against the
    provider's own domain root, with a short timeout. This deliberately
    does not hit a metered/billed endpoint — it only asks "is this host
    answering right now", which is what "connectivity" honestly means
    without spending any provider's quota just to render a status page.
    Any HTTP response at all (even a 4xx) means the server is up and
    reachable; only a network failure or timeout counts as unreachable. */
export async function checkReachable(url: string, timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
