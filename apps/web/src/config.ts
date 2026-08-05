export const API_HOST =
  import.meta.env.VITE_API_HOST || "http://localhost:1337";
export const API_VERSION = "v1";

// Optional: Clerk JWT template name (only needed if your backend expects a specific JWT template)
export const CLERK_JWT_TEMPLATE: string | undefined =
  import.meta.env.VITE_CLERK_JWT_TEMPLATE || undefined;
