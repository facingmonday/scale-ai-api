import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useGlobalContext } from "../../context/GlobalContext";
import BasicLayout from "../../components/Layouts/BasicLayout";
import organizationsService from "../../services/organizations";
import OrganizationCard from "../../components/OrganizationCard";
import { useClerk } from "@clerk/clerk-react";
import type { Organization } from "../../types/organization";

const JoinOrganization = () => {
  const { user, organization, refetchMe } = useAuth();
  const clerk = useClerk();
  const navigate = useNavigate();
  const globalContext = useGlobalContext();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isFetchingOrgs, setIsFetchingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If user already has an organization, redirect to classrooms
  useEffect(() => {
    if (organization) {
      navigate("/classrooms", { replace: true });
    }
  }, [organization, navigate]);

  const loadOrganizationList = async () => {
    const response = await organizationsService.getAll();
    return response.data || response;
  };

  const fetchOrganizations = async () => {
    setIsFetchingOrgs(true);
    setError(null);
    try {
      setOrganizations(await loadOrganizationList());
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(errorMessage || "Failed to load organizations");
    } finally {
      setIsFetchingOrgs(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadOrganizations = async () => {
      try {
        const orgList = await loadOrganizationList();
        if (cancelled) return;
        setOrganizations(orgList);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch organizations:", err);
        const errorMessage =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { message?: string } } }).response
                ?.data?.message
            : undefined;
        setError(errorMessage || "Failed to load organizations");
      } finally {
        if (!cancelled) setIsFetchingOrgs(false);
      }
    };

    void loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleJoinOrganization = async (org: Organization) => {
    try {
      globalContext?.setIsLoading(true);

      // 1. Call backend to join org
      await organizationsService.join(org.id);

      // 2. Reload Clerk user to get new memberships
      if (user?.reload) {
        await user.reload();
      }

      // 3. Explicitly set active organization (THIS IS THE KEY)
      await clerk.setActive({ organization: org.id });

      // 4. Wait until Clerk organization context is ready
      await new Promise<void>((resolve) => {
        const check = () => {
          if (clerk.organization?.id === org.id) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });

      // 5. Fetch routes from backend now that org is active
      await refetchMe();

      globalContext?.setIsLoading(false);

      // 6. Navigate AFTER org context and routes are ready
      navigate("/classrooms", { replace: true });
    } catch (err) {
      console.error("Failed to join organization:", err);
      setError("Failed to join organization. Please try again.");
      globalContext?.setIsLoading(false);
    }
  };

  if (isFetchingOrgs) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <p className="text-text-muted">Loading organizations...</p>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  if (error && organizations.length === 0) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <p className="text-text-muted mb-4">{error}</p>
              <button onClick={fetchOrganizations} className="btn-teal">
                Try Again
              </button>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="heading-xl mb-2">Join an Organization</h1>
            <p className="text-text-muted">
              Select an organization to join as a member
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="card bg-red-50 border-red-200 mb-6">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {organizations.length === 0 ? (
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">No Organizations Available</h2>
              <p className="text-text-muted mb-6">
                There are no organizations available to join at this time.
                Please contact your administrator.
              </p>
              <button onClick={fetchOrganizations} className="btn-teal">
                Refresh List
              </button>
            </div>
          ) : (
            /* Organization Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizations.map((org) => (
                <OrganizationCard
                  key={org._id}
                  organization={org}
                  onClick={() => handleJoinOrganization(org)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default JoinOrganization;
