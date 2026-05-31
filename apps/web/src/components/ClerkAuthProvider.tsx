import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import TokenHandler from "../services/base";

/**
 * ClerkAuthProvider bridges Clerk's React hooks with the service layer.
 * Since services can't use React hooks directly, this provider sets up
 * the token getter function that TokenHandler uses.
 *
 * Note: This is only needed if you want to use Clerk's useAuth hook.
 * If ClerkProvider is at the top level, Clerk should be available globally.
 */
export const ClerkAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { getToken } = useAuth();

  useEffect(() => {
    // Set up the token getter function for TokenHandler
    TokenHandler.setTokenGetter(async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error("Error getting token:", error);
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
};
