import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog } from "primereact/dialog";
import {
  UserProfile,
  OrganizationProfile,
  useOrganizationList,
  useOrganization,
} from "@clerk/clerk-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import ClassroomSwitcher from "@/components/ClassroomSwitcher";

export default function Header() {
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [openMobileMenu, setOpenMobileMenu] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showOrganizationDialog, setShowOrganizationDialog] = useState(false);
  const [showSwitchOrganizationDialog, setShowSwitchOrganizationDialog] =
    useState(false);
  const {
    user,
    logout,
    organization,
    activeClassroom,
    userRole,
    switchOrganization,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Get organization list from Clerk
  const { userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization: currentOrg } = useOrganization();

  // Get all memberships and check if multiple exist
  const allMemberships = useMemo(() => {
    return userMemberships?.data ?? [];
  }, [userMemberships]);

  const hasMultipleOrgs = allMemberships.length > 1;

  // Refs for menu containers
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setOpenUserMenu(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setOpenMobileMenu(false);
      }
    };

    if (openUserMenu || openMobileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openUserMenu, openMobileMenu]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand-blue border-b border-ui-border">
      <div className="container mx-auto px-4 py-1">
        {/* First Row - Logo and Hamburger (Mobile) / Logo, Classroom Switcher, User Menu (Desktop) */}
        <div className="flex items-center justify-between h-16 gap-4">
          {/* LEFT — Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white text-2xl font-bold">SCALE</span>
          </Link>

          {/* CENTER — Classroom Switcher (Desktop only) */}
          <div className="hidden md:flex flex-1 justify-center">
            <ClassroomSwitcher />
          </div>

          {/* RIGHT — Hamburger (Mobile) / Theme Toggle & User Profile (Desktop) */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Hamburger Menu (Mobile only) */}
            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setOpenMobileMenu(!openMobileMenu)}
                className="p-2 rounded-md hover:bg-white/10 transition text-white"
                aria-label="Toggle menu"
              >
                <i className="pi pi-bars text-xl" />
              </button>

              {/* Mobile Menu Dropdown */}
              {openMobileMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-ui-surface border border-ui-border shadow-md overflow-hidden z-50">
                  {activeClassroom && (
                    <>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          navigate("/challenges");
                          setOpenMobileMenu(false);
                        }}
                      >
                        Challenges
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          navigate("/vault");
                          setOpenMobileMenu(false);
                        }}
                      >
                        {userRole === "org:admin" ? "Classroom Vault" : "File Vault"}
                      </button>

                      {userRole === "org:admin" && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                          onClick={() => {
                            navigate("/students");
                            setOpenMobileMenu(false);
                          }}
                        >
                          Students
                        </button>
                      )}
                      {userRole === "org:member" && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                          onClick={() => {
                            navigate("/profile");
                            setOpenMobileMenu(false);
                          }}
                        >
                          Profile
                        </button>
                      )}

                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          navigate("/settings");
                          setOpenMobileMenu(false);
                        }}
                      >
                        Settings
                      </button>
                    </>
                  )}
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                    onClick={() => {
                      setShowProfileDialog(true);
                      setOpenMobileMenu(false);
                    }}
                  >
                    Profile
                  </button>

                  {userRole === "org:admin" && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                      onClick={() => {
                        setShowOrganizationDialog(true);
                        setOpenMobileMenu(false);
                      }}
                    >
                      Organization
                    </button>
                  )}

                  {hasMultipleOrgs && (
                    <>
                      <div className="border-t border-ui-border my-1" />
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          setOpenMobileMenu(false);
                          setShowSwitchOrganizationDialog(true);
                        }}
                      >
                        Switch Organization
                      </button>
                    </>
                  )}
                  <div className="border-t border-ui-border my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                    onClick={toggleTheme}
                  >
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-ui-muted"
                    onClick={() => {
                      setOpenMobileMenu(false);
                      logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle (Desktop only) */}
            <button
              onClick={toggleTheme}
              className="hidden md:flex p-2 rounded-md hover:bg-white/10 transition text-white"
              aria-label="Toggle theme"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <i className="pi pi-sun text-xl" />
              ) : (
                <i className="pi pi-moon text-xl" />
              )}
            </button>

            {/* User Profile (Desktop only) */}
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                onClick={() => setOpenUserMenu(!openUserMenu)}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-white/10 transition"
              >
                {/* Avatar */}
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-ui-muted text-text-secondary">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                )}

                {/* Name */}
                <div className="flex flex-col items-start justify-start">
                  <span className="font-medium text-sm text-white overflow-hidden text-ellipsis whitespace-nowrap">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="text-xs text-white overflow-hidden text-ellipsis whitespace-nowrap">
                    {organization?.name}
                  </span>
                </div>

                {/* Caret */}
                <svg
                  className={`w-4 h-4 text-text-secondary transition-transform ${openUserMenu ? "rotate-180" : ""
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown */}
              {openUserMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-ui-surface border border-ui-border shadow-md overflow-hidden">
                  {activeClassroom && (
                    <>
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          navigate("/challenges");
                          setOpenUserMenu(false);
                        }}
                      >
                        Challenges
                      </button>

                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          navigate("/vault");
                          setOpenUserMenu(false);
                        }}
                      >
                        {userRole === "org:admin" ? "Classroom Vault" : "File Vault"}
                      </button>

                      {userRole === "org:admin" && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                          onClick={() => {
                            navigate("/students");
                            setOpenUserMenu(false);
                          }}
                        >
                          Students
                        </button>
                      )}
                      {userRole === "org:member" && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                          onClick={() => {
                            navigate("/profile");
                            setOpenUserMenu(false);
                          }}
                        >
                          Profile
                        </button>
                      )}

                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          navigate("/settings");
                          setOpenUserMenu(false);
                        }}
                      >
                        Settings
                      </button>
                    </>
                  )}
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                    onClick={() => {
                      setShowProfileDialog(true);
                      setOpenUserMenu(false);
                    }}
                  >
                    Profile
                  </button>

                  {userRole === "org:admin" && (
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                      onClick={() => {
                        setShowOrganizationDialog(true);
                        setOpenUserMenu(false);
                      }}
                    >
                      Organization
                    </button>
                  )}

                  {hasMultipleOrgs && (
                    <>
                      <div className="border-t border-ui-border my-1" />
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-ui-muted"
                        onClick={() => {
                          setOpenUserMenu(false);
                          setShowSwitchOrganizationDialog(true);
                        }}
                      >
                        Switch Organization
                      </button>
                    </>
                  )}
                  <div className="border-t border-ui-border my-1" />
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-ui-muted"
                    onClick={() => {
                      setOpenUserMenu(false);
                      logout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Second Row - Classroom Switcher (Mobile only) */}
        <div className="md:hidden pb-2 w-full">
          <ClassroomSwitcher />
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog
        header="Profile"
        headerClassName="modal-header"
        visible={showProfileDialog}
        onHide={() => setShowProfileDialog(false)}
        modal
        className="modal w-full max-w-4xl"
        maskClassName="modal-mask"
        contentClassName="p-0"
        style={{ width: "90vw", maxWidth: "900px" }}
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
      >
        <div className="flex justify-center">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-ui-surface border-noneshadow-md",
                cardBox: "w-full border-none",
                scrollBody: "p-0 border-none",
                headerTitle: "text-text-primary",
                headerSubtitle: "text-text-secondary",
                formButtonPrimary:
                  "bg-brand-teal text-text-primary hover:opacity-90",
                formFieldInput:
                  "bg-ui-surface border-ui-border text-text-primary",
                formFieldLabel: "text-text-secondary",
                navbarButton: "hidden",
                navbarButtonActive: "hidden",
                identityPreview: "bg-ui-muted border-ui-border",
                identityPreviewText: "text-text-primary",
                identityPreviewEditButton: "text-brand-teal hover:bg-ui-muted",
                tableHead: "bg-ui-muted text-text-secondary",
                tableRow: "border-ui-border",
                tableCell: "text-text-primary",
                badge: "bg-brand-teal text-text-primary",
                button: "bg-brand-teal text-text-primary hover:opacity-90",
                buttonDestructive: "bg-red-500 text-white hover:bg-red-600",
                input: "bg-ui-surface border-ui-border text-text-primary",
                selectButton:
                  "bg-ui-surface border-ui-border text-text-primary",
                modalContent: "bg-ui-surface border-ui-border",
                modalContentHeaderTitle: "text-text-primary",
                alertText: "text-text-primary",
                alertTextDanger: "text-red-500",
              },
              variables: {
                colorPrimary: "#78cfc4",
                colorText: "#111827",
                colorTextSecondary: "#4b5563",
                colorBackground: "#ffffff",
                colorInputBackground: "#ffffff",
                colorInputText: "#111827",
                borderRadius: "10px",
              },
            }}
          />
        </div>
      </Dialog>

      {/* Organization Dialog */}
      {userRole === "org:admin" && (
        <Dialog
          header="Organization"
          visible={showOrganizationDialog}
          onHide={() => setShowOrganizationDialog(false)}
          modal
          className="modal w-full max-w-4xl"
          maskClassName="modal-mask"
          headerClassName="modal-header"
          contentClassName="p-0"
          pt={{
            headerTitle: { className: "modal-title" },
            footer: { className: "modal-footer" },
          }}
          style={{ width: "90vw", maxWidth: "900px" }}
        >
          <div className="flex justify-center">
            <OrganizationProfile
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-ui-surface border-noneshadow-md",
                  cardBox: "w-full border-none",
                  scrollBody: "p-0 border-none",
                  headerTitle: "text-text-primary",
                  headerSubtitle: "text-text-secondary",
                  formButtonPrimary:
                    "bg-brand-teal text-text-primary hover:opacity-90",
                  formFieldInput:
                    "bg-ui-surface border-ui-border text-text-primary",
                  formFieldLabel: "text-text-secondary",
                  navbarButton: "text-text-secondary hover:bg-ui-muted",
                  navbarButtonActive: "bg-ui-muted text-text-primary",
                  identityPreview: "bg-ui-muted border-ui-border",
                  identityPreviewText: "text-text-primary",
                  identityPreviewEditButton:
                    "text-brand-teal hover:bg-ui-muted",
                  tableHead: "bg-ui-muted text-text-secondary",
                  tableRow: "border-ui-border",
                  tableCell: "text-text-primary",
                  badge: "bg-brand-teal text-text-primary",
                  button: "bg-brand-teal text-text-primary hover:opacity-90",
                  buttonDestructive: "bg-red-500 text-white hover:bg-red-600",
                  input: "bg-ui-surface border-ui-border text-text-primary",
                  selectButton:
                    "bg-ui-surface border-ui-border text-text-primary",
                  modalContent: "bg-ui-surface border-ui-border",
                  modalContentHeaderTitle: "text-text-primary",
                  alertText: "text-text-primary",
                  alertTextDanger: "text-red-500",
                },
                variables: {
                  colorPrimary: "#78cfc4",
                  colorText: "#111827",
                  colorTextSecondary: "#4b5563",
                  colorBackground: "#ffffff",
                  colorInputBackground: "#ffffff",
                  colorInputText: "#111827",
                  borderRadius: "10px",
                },
              }}
            />
          </div>
        </Dialog>
      )}

      {/* Switch Organization Dialog */}
      <Dialog
        header="Switch Organization"
        headerClassName="modal-header"
        visible={showSwitchOrganizationDialog}
        onHide={() => setShowSwitchOrganizationDialog(false)}
        modal
        className="modal w-full max-w-2xl"
        maskClassName="modal-mask"
        contentClassName="p-0"
        pt={{
          headerTitle: { className: "modal-title" },
          footer: { className: "modal-footer" },
        }}
      >
        <div className="p-6">
          {!isOrgListLoaded ? (
            <div className="text-center py-8 text-text-muted">
              Loading organizations...
            </div>
          ) : allMemberships.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              No organizations found
            </div>
          ) : (
            <ul className="space-y-3">
              {allMemberships.map((membership) => {
                const org = membership.organization;
                const orgId = org.id;
                const orgName = org.name;
                const orgSlug = org.slug;
                const imageUrl = org.imageUrl;
                const role = membership.role;
                const roleDisplay = role === "org:admin" ? "Admin" : "Member";
                const isActive = currentOrg?.id === orgId;

                return (
                  <li key={orgId}>
                    <button
                      type="button"
                      className={`w-full text-left rounded-lg border transition-all flex items-start gap-4 p-4 ${isActive
                          ? "bg-ui-muted border-brand-orange border-2"
                          : "border-ui-border hover:bg-ui-muted hover:border-ui-border"
                        }`}
                      onClick={async () => {
                        if (!isActive && orgId) {
                          try {
                            await switchOrganization(orgId);
                            setShowSwitchOrganizationDialog(false);
                            navigate("/");
                          } catch (error) {
                            console.error(
                              "Failed to switch organization:",
                              error
                            );
                          }
                        }
                      }}
                      disabled={isActive}
                    >
                      {/* Organization Image */}
                      <div className="flex-shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={orgName || "Organization"}
                            className="w-12 h-12 rounded-lg object-cover border border-ui-border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-ui-muted border border-ui-border flex items-center justify-center text-lg font-semibold text-text-primary">
                            {orgName?.charAt(0)?.toUpperCase() || "O"}
                          </div>
                        )}
                      </div>

                      {/* Organization Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h3
                              className={`font-semibold text-base truncate ${isActive
                                  ? "text-brand-orange"
                                  : "text-text-primary"
                                }`}
                            >
                              {orgName}
                            </h3>
                            {orgSlug && (
                              <p className="text-sm text-text-muted mt-0.5">
                                @{orgSlug}
                              </p>
                            )}
                            <p className="text-xs text-text-muted mt-1">
                              {roleDisplay}
                            </p>
                          </div>
                          {isActive && (
                            <div className="flex-shrink-0">
                              <svg
                                className="w-5 h-5 text-brand-orange"
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
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <p className="text-xs text-brand-orange font-medium mt-1">
                            Currently active
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Dialog>
    </header>
  );
}
