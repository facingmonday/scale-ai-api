import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useOrganizationList,
  CreateOrganization,
  useOrganization,
} from "@clerk/clerk-react";
import { Dialog } from "primereact/dialog";

interface OrganizationSwitcherProps {
  afterSelectOrganizationUrl?: string;
  afterCreateOrganizationUrl?: string;
  className?: string;
  variant?: "menu" | "large";
  onSwitched?: () => void;
}

const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  afterSelectOrganizationUrl,
  afterCreateOrganizationUrl,
  className,
  variant = "menu",
  onSwitched,
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { userMemberships, setActive, isLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization } = useOrganization();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showCreateOrg, setShowCreateOrg] = useState<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  const prevOrgIdRef = useRef<string | undefined>(organization?.id);

  const adminMemberships = useMemo(() => {
    const memberships = userMemberships?.data ?? [];
    return memberships.filter((m: any) => m.role === "org:admin");
  }, [userMemberships]);

  // Compute the default orgId
  const defaultOrgId = useMemo(() => {
    if (adminMemberships.length === 0) return "";
    // If there's a currently active organization and it's in our admin list, use it
    if (
      organization?.id &&
      adminMemberships.some((m: any) => m.organization.id === organization.id)
    ) {
      return organization.id;
    }
    // Otherwise, default to the first admin organization
    return adminMemberships[0]?.organization.id ?? "";
  }, [adminMemberships, organization]);

  // Initialize selectedOrgId with computed default
  const [selectedOrgId, setSelectedOrgId] = useState<string>(() => {
    // This will be called once on mount, but defaultOrgId might be empty
    // We'll handle initialization in the effect below
    return "";
  });

  // Initialize selectedOrgId once when data becomes available, or sync when organization changes
  useEffect(() => {
    const orgIdChanged = prevOrgIdRef.current !== organization?.id;
    prevOrgIdRef.current = organization?.id;

    if (!hasInitializedRef.current && defaultOrgId) {
      hasInitializedRef.current = true;
      // Schedule state update for next tick to avoid synchronous setState
      queueMicrotask(() => {
        setSelectedOrgId(defaultOrgId);
      });
    } else if (
      hasInitializedRef.current &&
      defaultOrgId &&
      orgIdChanged &&
      organization?.id === defaultOrgId
    ) {
      // Sync when organization changes externally to match the default
      queueMicrotask(() => {
        setSelectedOrgId(defaultOrgId);
      });
    }
  }, [defaultOrgId, organization?.id]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    try {
      await setActive?.({ organization: orgId });
      const destination = afterSelectOrganizationUrl || pathname;
      if (destination) {
        navigate(destination);
      }
      onSwitched?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to switch organization", err);
    }
  };

  const isBusy = !isLoaded;

  const baseClasses =
    variant === "large"
      ? "w-full h-14 text-lg font-semibold justify-between px-4 bg-[#121212] text-gray-300 hover:bg-[#1a1a1a]"
      : "w-full px-2 py-2 rounded-lg bg-transparent text-gray-300 hover:bg-[#1a1a1a] justify-between";

  if (isBusy) {
    return (
      <div className={className}>
        <div className={`${baseClasses} animate-pulse flex items-center`}>
          Loading organizations...
        </div>
      </div>
    );
  }

  if (!adminMemberships.length) {
    return null;
  }

  const selectedOrgName = adminMemberships.find(
    (m: any) => m.organization.id === selectedOrgId
  )?.organization.name;

  return (
    <div className={className}>
      <div ref={containerRef} className="relative">
        <label className="sr-only" htmlFor="admin-org-switcher-trigger">
          Select organization
        </label>
        <button
          id="admin-org-switcher-trigger"
          type="button"
          className={`${baseClasses} flex items-center w-full`}
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate text-left text-text-primary text-sm">
            {selectedOrgName || "Select organization"}
          </span>
          <svg
            className={`w-5 h-5 ml-2 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>

        {isOpen && (
          <div className="mt-2 w-full rounded-lg bg-ui-surface shadow-xl max-h-[75vh] overflow-hidden flex flex-col">
            <ul
              role="listbox"
              aria-label="Organizations"
              className="flex-1 overflow-auto py-1 max-h-[25vh]"
            >
              {adminMemberships.map((m: any) => {
                const orgId = m.organization.id;
                const isSelected = orgId === selectedOrgId;
                return (
                  <li key={orgId} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between text-text-primary hover:bg-ui-muted ${
                        isSelected ? "text-brand-orange" : ""
                      }`}
                      onClick={() => {
                        setIsOpen(false);
                        handleChange(orgId);
                      }}
                    >
                      <span className="truncate">{m.organization.name}</span>
                      {isSelected && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-ui-border">
              <button
                type="button"
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-text-primary hover:bg-ui-muted"
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateOrg(true);
                }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Create organization</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <Dialog
        visible={showCreateOrg}
        onHide={() => setShowCreateOrg(false)}
        modal
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        headerClassName="modal-header"
        contentClassName="p-0"
      >
        <div className="p-2">
          <CreateOrganization
            appearance={{
              elements: {
                rootBox: {
                  backgroundColor: "#1a1a1a",
                  width: "100%",
                },
                cardBox: {
                  width: "100%",
                  borderRadius: "0px",
                },
              },
            }}
            afterCreateOrganizationUrl={afterCreateOrganizationUrl || pathname}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default OrganizationSwitcher;
