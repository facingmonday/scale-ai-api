export const API_HOST =
  import.meta.env.VITE_API_HOST || "http://localhost:1337";
export const API_VERSION = "v1";

// Optional: Clerk JWT template name (only needed if your backend expects a specific JWT template)
export const CLERK_JWT_TEMPLATE: string | undefined =
  import.meta.env.VITE_CLERK_JWT_TEMPLATE || undefined;

export const HELP_SCOUT_BEACON_ID =
  import.meta.env.VITE_HELP_SCOUT_BEACON_ID ||
  "e48e78fe-0bca-41b2-b7fe-276866039818";
