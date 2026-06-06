import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  useAuth as useClerkAuth,
  useUser,
  useOrganization,
  useClerk,
} from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import authService from "../services/auth";
import TokenHandler from "../services/base";
import type { Classroom } from "../types/classroom";
import type { BillingSummary } from "../types/licensing";
import { CLERK_JWT_TEMPLATE } from "../config";

type ClerkOrganizationLike = { id?: string; name?: string | null };
type ClerkOrganizationMembershipLike = {
  role?: string;
  organization?: ClerkOrganizationLike;
  organizationId?: string;
};
type ClerkUserLike = {
  imageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  organizationMemberships?: ClerkOrganizationMembershipLike[];
  publicMetadata?: {
    activeClassroom?: ClerkActiveClassroom;
    [k: string]: unknown;
  };
  reload?: () => Promise<unknown>;
};

export interface ClerkActiveClassroom {
  classroomId: string;
  classroomName: string;
  role: "admin" | "member";
  setAt: string;
}

type BackendRouteNode = {
  key: string;
  pageKey?: string;
  route?: string;
  collapse?: BackendRouteNode[];
  [k: string]: unknown;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: ClerkUserLike | null | undefined;
  routes: BackendRouteNode[];
  organization: ClerkOrganizationLike | null | undefined;
  userRole: string | null;
  activeClassroom: Classroom | null;
  setNewActiveClassroom: (classroom: Classroom) => Promise<void>;
  clearActiveClassroom: () => Promise<void>;
  logout: () => Promise<void>;
  refetchMe: () => Promise<
    | { activeClassroom: Classroom | null; routes: BackendRouteNode[] }
    | undefined
  >;
  switchOrganization: (organizationId: string) => Promise<void>;
  hasAccess: boolean;
  authError: string | null;
  billing: BillingSummary | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<BackendRouteNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeClassroom, setActiveClassroom] = useState<Classroom | null>(
    null
  );
  const [billing, setBilling] = useState<BillingSummary | null>(null);

  const isOrgResolved =
    user &&
    user.organizationMemberships &&
    user.organizationMemberships.length > 0 &&
    organization;

  // ---------------------------------------------------------------------------
  // Ensure Clerk "active organization" is set (prevents RootRedirect infinite loading)
  // ---------------------------------------------------------------------------
  const didAutoSetOrgRef = React.useRef(false);
  useEffect(() => {
    if (!isSignedIn) return;
    if (organization?.id) return;
    if (!user || !Array.isArray(user.organizationMemberships)) return;
    if (user.organizationMemberships.length === 0) return;
    if (didAutoSetOrgRef.current) return;

    const first = user.organizationMemberships[0];
    const orgId = first?.organization?.id;
    if (!orgId) return;

    didAutoSetOrgRef.current = true;
    void clerk.setActive({ organization: orgId }).catch((e) => {
      // allow retry if it failed (e.g., transient)
      didAutoSetOrgRef.current = false;
      console.error("Failed to auto-set active organization:", e);
    });
  }, [clerk, isSignedIn, organization?.id, user]);

  // ---------------------------------------------------------------------------
  // Token bridge (replaces ClerkAuthProvider)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    TokenHandler.setTokenGetter(async () => {
      try {
        if (CLERK_JWT_TEMPLATE) {
          return await getToken({ template: CLERK_JWT_TEMPLATE });
        }
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  // ---------------------------------------------------------------------------
  // Fetch /auth/me
  // ---------------------------------------------------------------------------
  const fetchMe = useCallback(
    async (opts?: {
      silent?: boolean;
    }): Promise<
      | { activeClassroom: Classroom | null; routes: BackendRouteNode[] }
      | undefined
    > => {
      if (!isSignedIn) return undefined;

      const silent = opts?.silent ?? true;
      if (!silent) {
        setIsLoading(true);
      }
      setAuthError(null);
      try {
        // If Clerk can't give us a token, don't spam the backend with a guaranteed 401.
        const token = await TokenHandler.getToken();
        if (!token) {
          setAuthError(
            "Missing auth token from Clerk. If your backend requires a JWT template, set VITE_CLERK_JWT_TEMPLATE."
          );
          await clerk.signOut();
          return undefined;
        }
        const data = await authService.getMe();
        const classroom = data?.activeClassroom || null;
        const routesData = data?.routes || [];
        setRoutes(routesData);
        setActiveClassroom(classroom);
        setBilling(data?.billing || null);
        return { activeClassroom: classroom, routes: routesData };
      } catch (err) {
        console.error("Failed to fetch auth context:", err);
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;

        if (status === 401) {
          setAuthError(
            "Unauthorized (401) while calling /v1/auth/me. This usually means the Clerk token is missing/invalid for the backend."
          );
          await clerk.signOut();
          return undefined;
        }

        setAuthError("Failed to load auth context. Please try again.");
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [clerk, isSignedIn]
  );

  useEffect(() => {
    if (isSignedIn) {
      fetchMe();
    } else {
      setRoutes([]);
      setBilling(null);
      setIsLoading(false);
    }
  }, [isSignedIn, organization?.id, fetchMe]);

  // ---------------------------------------------------------------------------
  // Classroom setters
  // ---------------------------------------------------------------------------
  const setNewActiveClassroom = async (classroom: Classroom) => {
    try {
      // Call backend API to update user metadata
      await authService.setActiveClassroom(classroom._id);

      // Force Clerk to refresh user data
      await user?.reload();

      // Refetch routes since backend returns different routes with active classroom
      await fetchMe();

      // Navigate to dashboard now that routes include it
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Failed to set active classroom:", error);
      throw error;
    }
  };

  const clearActiveClassroom = async () => {
    try {
      // Call backend API to clear (send null)
      await authService.setActiveClassroom(null);

      // Force Clerk to refresh user data
      await user?.reload();

      // Refetch routes to get classroom-less routes
      await fetchMe();

      // Navigate back to classrooms
      navigate("/classrooms", { replace: true });
    } catch (error) {
      console.error("Failed to clear active classroom:", error);
      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = async () => {
    try {
      setRoutes([]);
      setActiveClassroom(null);
      await clerk.signOut();
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // Compute user role based on current organization
  // ---------------------------------------------------------------------------
  const userRole = React.useMemo(() => {
    if (!user || !organization) return null;

    const memberships: ClerkOrganizationMembershipLike[] =
      user.organizationMemberships || [];

    // Try to match by Clerk organization ID
    const membership = memberships.find((m) => {
      // Match by Clerk ID: organization.id === membership.organization.id
      if (organization.id && m.organization?.id === organization.id) {
        return true;
      }

      // Fallback: Match by MongoDB ObjectId if available
      // organization._id === membership.organizationId
      const orgWithId = organization as unknown as { _id?: string };
      if (orgWithId._id && m.organizationId === orgWithId._id) {
        return true;
      }

      return false;
    });

    return membership?.role || null;
  }, [user, organization]);

  const switchOrganization = async (organizationId: string) => {
    if (!clerk) return;

    try {
      await clerk.setActive({ organization: organizationId });
      setRoutes([]); // Reset route fetch status to trigger a refetch
      // The organization change will be detected by the useEffect and trigger a page refresh
      await fetchMe();
    } catch (error) {
      console.error("Failed to switch organization:", error);
      throw error;
    }
  };

  // ---------------------------------------------------------------------------
  // Organization membership guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSignedIn || isLoading || !isOrgResolved) return;

    const hasOrganization = user.organizationMemberships.length > 0;

    const params = new URLSearchParams(window.location.search);
    const hasJoinParams = !!params.get("orgId") && !!params.get("classroomId");

    const isJoinFlow =
      hasJoinParams ||
      window.location.pathname === "/join" ||
      window.location.pathname === "/join-organization" ||
      window.location.pathname.startsWith("/classrooms/");

    if (!hasOrganization && !isJoinFlow) {
      navigate("/join-organization", { replace: true });
      return;
    }

    const isTeacher = userRole === "org:admin";
    const targetPath = isTeacher ? "/dashboard" : "/classrooms";

    if (
      hasOrganization &&
      !activeClassroom &&
      window.location.pathname !== targetPath &&
      window.location.pathname !== "/classrooms" &&
      window.location.pathname !== "/join" &&
      window.location.pathname !== "/join-organization" &&
      !hasJoinParams &&
      window.location.pathname !== "/profile"
    ) {
      navigate(targetPath, { replace: true });
    }
  }, [isSignedIn, isLoading, isOrgResolved, user, activeClassroom, navigate, userRole]);

  //todo: add a proper access control system
  const hasAccess = true;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!isSignedIn,
        isLoading,
        user,
        routes,
        organization,
        userRole,
        activeClassroom,
        switchOrganization,
        setNewActiveClassroom,
        clearActiveClassroom,
        logout,
        refetchMe: () => fetchMe({ silent: true }),
        hasAccess,
        authError,
        billing,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
