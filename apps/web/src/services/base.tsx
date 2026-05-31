import type { IOrganization } from "../types/organization";

// ClerkTokenHandler for Clerk authentication
class ClerkTokenHandler {
  private tokenGetter: (() => Promise<string | null>) | null = null;

  // ---------------------------------------------------------------------------
  // Token handling
  // ---------------------------------------------------------------------------

  // Set the token getter function (called from ClerkAuthProvider)
  setTokenGetter(getter: () => Promise<string | null>) {
    this.tokenGetter = getter;
  }

  // Get token from Clerk
  async getToken(): Promise<string | null> {
    try {
      // Preferred method: injected token getter
      if (this.tokenGetter) {
        return await this.tokenGetter();
      }

      // Fallback: Clerk on window
      if (typeof window !== "undefined" && (window as any).Clerk) {
        const clerk = (window as any).Clerk;
        if (clerk.session) {
          return await clerk.session.getToken();
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting token from Clerk session:", error);
      return null;
    }
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

  async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();

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
