export async function getHealth(signal: AbortSignal): Promise<boolean> {
  const response = await fetch("/healthz", {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("API health request failed");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    body.status !== "ok"
  ) {
    throw new Error("API returned an unexpected health response");
  }
  return true;
}
