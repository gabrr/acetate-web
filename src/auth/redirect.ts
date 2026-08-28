const DEFAULT_AUTH_DESTINATION = "/dashboard";
const AUTH_DESTINATION_ORIGIN = "https://acetate.local";

export function safeAuthDestination(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_AUTH_DESTINATION;
  }

  try {
    const destination = new URL(value, AUTH_DESTINATION_ORIGIN);
    if (
      destination.origin !== AUTH_DESTINATION_ORIGIN ||
      destination.pathname === "/auth/confirm"
    ) {
      return DEFAULT_AUTH_DESTINATION;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}
