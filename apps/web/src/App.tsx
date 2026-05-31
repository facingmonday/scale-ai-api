import { Suspense } from "react";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import * as Pages from "./pages";
import { JoinOrganization } from "./pages/JoinOrganization";
import ClassroomLinkLanding from "./pages/Classrooms/ClassroomLinkLanding";
import AuthPage from "./pages/Auth/Auth";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { GlobalContextProvider } from "./context/GlobalContext";
import TeacherClassroom from "./pages/Teacher/Classroom";
import LoadingOverlay from "./components/LoadingOverlay";
import ScrollToTop from "./components/ScrollToTop";

const LoadingScreen = () => <LoadingOverlay loading={true} />;

const AuthErrorScreen = ({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}) => (
  <div className="page">
    <div className="container">
      <div className="card text-center py-12">
        <h2 className="heading-lg mb-2">Authentication issue</h2>
        <p className="text-text-muted mb-6">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button className="btn-teal" onClick={onRetry}>
            Try Again
          </button>
          <button className="btn-outline" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </div>
);

const RootRedirect = () => {
  const {
    activeClassroom,
    isLoading,
    routes,
    user,
    organization,
    authError,
    refetchMe,
    logout,
  } = useAuth();

  // 1. Hard stop while anything auth-related is still loading
  if (isLoading || !user) {
    return <LoadingOverlay loading={isLoading} />;
  }

  // 2. Wait until Clerk memberships are resolved
  if (!Array.isArray(user.organizationMemberships)) {
    return <LoadingOverlay loading={isLoading} />;
  }

  const hasOrganization = user.organizationMemberships.length > 0;

  // 3. If user has org memberships but Clerk org context not ready yet
  if (hasOrganization && !organization) {
    return <LoadingOverlay loading={isLoading} />;
  }

  // 4. No organization → join flow
  if (!hasOrganization) {
    return <Navigate to="/join-organization" replace />;
  }

  // 5. Has org but no active classroom yet
  if (!activeClassroom) {
    return <Navigate to="/classrooms" replace />;
  }

  // 6. Routes not ready yet
  if (!routes || routes.length === 0) {
    if (authError) {
      return (
        <AuthErrorScreen
          message={authError}
          onRetry={() => void refetchMe()}
          onSignOut={() => void logout()}
        />
      );
    }
    return <LoadingOverlay loading={isLoading} />;
  }

  // 7. Navigate to first available route
  type RouteNode = {
    key: string;
    pageKey?: string;
    route?: string;
    collapse?: RouteNode[];
  };

  const flattenRoutes = (items: RouteNode[]): RouteNode[] =>
    items.flatMap((route: RouteNode) => [
      ...(route.route ? [route] : []),
      ...(route.collapse ? flattenRoutes(route.collapse) : []),
    ]);

  const flatRoutes = flattenRoutes(routes);
  const firstRoute = flatRoutes.find((route) => route.route);

  if (firstRoute?.route) {
    return <Navigate to={firstRoute.route} replace />;
  }

  return <Navigate to="/classrooms" replace />;
};

const RootEntry = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const hasJoinParams = !!params.get("orgId") && !!params.get("classroomId");

  if (hasJoinParams) {
    return <AuthPage />;
  }

  return <RootRedirect />;
};

const JoinPathRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/${location.search}`} replace />;
};

const DynamicRoutes = () => {
  const { routes, isLoading, userRole, authError, refetchMe, logout } =
    useAuth();
  if (isLoading) return <LoadingOverlay loading={isLoading} />;

  if ((!routes || routes.length === 0) && authError) {
    return (
      <AuthErrorScreen
        message={authError}
        onRetry={() => void refetchMe()}
        onSignOut={() => void logout()}
      />
    );
  }

  // Map Clerk roles to app roles
  const appRole = userRole === "org:admin" ? "teacher" : "student";

  type RouteNode = {
    key: string;
    pageKey?: string;
    route?: string;
    collapse?: RouteNode[];
  };

  type FlattenedRoute = {
    path: string;
    pageKey?: string;
    key: string;
  };

  const flattenRoutes = (items: RouteNode[]): FlattenedRoute[] =>
    items.flatMap((r: RouteNode) => [
      ...(r.route ? [{ path: r.route, pageKey: r.pageKey, key: r.key }] : []),
      ...(r.collapse ? flattenRoutes(r.collapse) : []),
    ]);

  const flatRoutes = flattenRoutes(routes);
  return (
    <Routes>
      {flatRoutes.map((route) => {
        const rolePages =
          Pages.rolePages[appRole as keyof typeof Pages.rolePages];
        const PageComponent =
          rolePages?.[route.pageKey as keyof typeof rolePages];

        if (!PageComponent) {
          console.error(
            `Missing pageKey "${route.pageKey}" for role "${appRole}" (userRole: "${userRole}")`
          );
          return null;
        }

        return (
          <Route
            key={route.key}
            path={route.path}
            element={
              <Suspense fallback={<LoadingOverlay loading={true} />}>
                <PageComponent />
              </Suspense>
            }
          />
        );
      })}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <GlobalContextProvider>
      <ThemeProvider>
        <ScrollToTop />
        <div className="h-screen w-full">
          <ClerkLoading>
            <LoadingOverlay loading={true} />
          </ClerkLoading>

          <ClerkLoaded>
            <SignedOut>
              <Routes>
                <Route path="/join" element={<JoinPathRedirect />} />
                <Route path="*" element={<AuthPage />} />
              </Routes>
            </SignedOut>

            <SignedIn>
              <AuthProvider>
                <Routes>
                  <Route path="/" element={<RootEntry />} />
                  <Route path="/join" element={<JoinPathRedirect />} />
                  <Route
                    path="/classrooms/:id"
                    element={
                      <Suspense fallback={<LoadingScreen />}>
                        <ClassroomLinkLanding />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/join-organization"
                    element={
                      <Suspense fallback={<LoadingOverlay loading={true} />}>
                        <JoinOrganization />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/classroom/:id"
                    element={
                      <Suspense fallback={<LoadingOverlay loading={true} />}>
                        <TeacherClassroom />
                      </Suspense>
                    }
                  />
                  <Route path="/*" element={<DynamicRoutes />} />
                </Routes>
              </AuthProvider>
            </SignedIn>
          </ClerkLoaded>
        </div>
      </ThemeProvider>
    </GlobalContextProvider>
  );
}
