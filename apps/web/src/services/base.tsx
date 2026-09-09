import type { IOrganization } from "../types/organization";

// ClerkTokenHandler for Clerk authentication
class ClerkTokenHandler {
  private tokenGetter: ((options?: { skipCache?: boolean }) => Promise<string | null>) | null = null;

  // ---------------------------------------------------------------------------
  // Token handling
  // ---------------------------------------------------------------------------

  // Set the token getter function (called from ClerkAuthProvider)
  setTokenGetter(getter: (options?: { skipCache?: boolean }) => Promise<string | null>) {
    this.tokenGetter = getter;
  }

  // Get token from Clerk
  async getToken(options?: { skipCache?: boolean }): Promise<string | null> {
    // Let network failures propagate so they are not mistaken for sign-out.
    if (this.tokenGetter) return this.tokenGetter(options);

    if (typeof window === "undefined") return null;
    const clerk = (window as Window & {
      Clerk?: { session?: { getToken: (options?: { skipCache?: boolean }) => Promise<string | null> } };
    }).Clerk;
    return clerk?.session ? clerk.session.getToken(options) : null;
  }

  // ---------------------------------------------------------------------------
  // Organization helpers
  // ---------------------------------------------------------------------------

  getCurrentOrganization(): IOrganization | null {
    const item = localStorage.getItem("currentOrganization");
    if (!item || item === "undefined") return null;

    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }

  setCurrentOrganization(organization: IOrganization) {
    localStorage.setItem("currentOrganization", JSON.stringify(organization));
  }

  removeCurrentOrganization() {
    localStorage.removeItem("currentOrganization");
  }

  // ---------------------------------------------------------------------------
  // Headers (Organization context)
  // ---------------------------------------------------------------------------

  async getHeaders(options?: { skipCache?: boolean }): Promise<Record<string, string>> {
    const token = await this.getToken(options);

    const currentOrganization = this.getCurrentOrganization();

    interface OrganizationWithRole extends IOrganization {
      role?: string;
    }

    const orgWithRole = currentOrganization as OrganizationWithRole | null;

    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",

      // Organization context
      ...(currentOrganization?.id && {
        "X-Organization": currentOrganization.id,
        ...(orgWithRole?.role
          ? { "X-Organization-Role": orgWithRole.role }
          : {}),
      }),
    };
  }
}

const clerkTokenHandler = new ClerkTokenHandler();
export default clerkTokenHandler;
