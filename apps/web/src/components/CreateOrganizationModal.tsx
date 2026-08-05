//todo: Completely update this modal and update the UI to match SCALE AI design system / functionalityu

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import organizationsService from "@/services/organizations";
import LoadingOverlay from "@/components/LoadingOverlay.tsx";
import slugify from "slugify";
import { useAuth } from "@/context/AuthContext";
import type { Organization } from "@/types/organization";

interface CreateOrganizationModalProps {
  showCreateOrg: boolean;
  setShowCreateOrg: (show: boolean) => void;
}

interface OrganizationFormData {
  name: string;
  slug: string;
  imageUrl?: string;
}

interface MemberFormData {
  firstName: string;
  lastName: string;
  email: string;
}

type ModalStep = "type" | "create" | "complete";

const CreateOrganizationModal: React.FC<CreateOrganizationModalProps> = ({
  showCreateOrg,
  setShowCreateOrg,
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { switchOrganization } = useAuth();
  const [createdOrganization, setCreatedOrganization] =
    useState<Organization | null>(null);
  const [currentStep, setCurrentStep] = useState<ModalStep>("type");
  const [organizationType, setOrganizationType] = useState<
    "individual" | "organization"
  >("organization");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [orgFormData, setOrgFormData] = useState<OrganizationFormData>({
    name: "",
    slug: "",
    imageUrl: "",
  });

  const [memberFormData, setMemberFormData] = useState<MemberFormData>({
    firstName: "",
    lastName: "",
    email: "",
  });

  // Handle organization type selection
  const handleOrganizationTypeSelect = (
    type: "individual" | "organization"
  ) => {
    setOrganizationType(type);
    if (type === "individual") {
      if (user) {
        setMemberFormData({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.primaryEmailAddress?.emailAddress || "",
        });
      }
      setCurrentStep("create");
    } else {
      // Clear member form for organization type
      setMemberFormData({ firstName: "", lastName: "", email: "" });
      setCurrentStep("create");
    }
  };

  // Handle organization creation
  const handleCreateOrganization = async () => {
    try {
      setLoading(true);
      setError(null);
      const organizationName =
        orgFormData.name ||
        `${memberFormData.firstName} ${memberFormData.lastName}`;
      const slug =
        orgFormData.slug ||
        slugify(
          `${memberFormData.firstName}-${memberFormData.lastName}`.toLowerCase()
        );

      const response = await organizationsService.create({
        name: organizationName,
        slug,
        imageUrl: orgFormData.imageUrl || undefined,
        publicMetadata: {
          type: organizationType,
        },
      });

      // Handle the response format from your backend
      const newOrg = response.data || response;

      if (!newOrg.id) {
        setError(newOrg.message);
        return;
      }
      setCreatedOrganization(newOrg);
      setCurrentStep("complete");
    } catch (err: any) {
      console.error("Error creating organization:", err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err.message ||
          "Failed to create organization"
      );
    } finally {
      setLoading(false);
    }
  };

  // Reset modal state
  const handleClose = async () => {
    if (createdOrganization) {
      await switchOrganization(createdOrganization._id);
      navigate("/");
      setShowCreateOrg(false);
    } else {
      setCurrentStep("type");
      setOrganizationType("organization");
      setOrgFormData({ name: "", slug: "", imageUrl: "" });
      setMemberFormData({ firstName: "", lastName: "", email: "" });
      setError(null);
      setShowCreateOrg(false);
    }
  };

  if (!showCreateOrg) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-dark-secondary rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg border-2 border-brand-border/80">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-brand-border">
          <h2 className="text-2xl font-bold text-brand-orange">
            Create Organization
          </h2>
          <button
            onClick={handleClose}
            className="text-text-light hover:text-text-dark text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Organization Type */}
          {currentStep === "type" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-text-dark mb-2">
                  What type of organization are you?
                </h3>
                <p className="text-zinc-300">
                  Choose whether you're creating an organization for your school
                  or just want to get started as an individual.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleOrganizationTypeSelect("organization")}
                  className="p-6 border-2 border-brand-border rounded-lg hover:border-brand-orange hover:bg-brand-dark transition-colors text-left flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="#FF6B00"
                      className="size-6"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.5 2.25a.75.75 0 0 0 0 1.5v16.5h-.75a.75.75 0 0 0 0 1.5h16.5a.75.75 0 0 0 0-1.5h-.75V3.75a.75.75 0 0 0 0-1.5h-15ZM9 6a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H9Zm-.75 3.75A.75.75 0 0 1 9 9h1.5a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75ZM9 12a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H9Zm3.75-5.25A.75.75 0 0 1 13.5 6H15a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75ZM13.5 9a.75.75 0 0 0 0 1.5H15A.75.75 0 0 0 15 9h-1.5Zm-.75 3.75a.75.75 0 0 1 .75-.75H15a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75ZM9 19.5v-2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 9 19.5Z"
                        clipRule="evenodd"
                      />
                    </svg>

                    <h4 className="text-lg font-semibold text-text-dark">
                      Educational Institution
                    </h4>
                  </div>
                  <p className="text-zinc-300 text-sm">
                    Create an organization to manage classrooms, students, and
                    get your first ScaleAI challenges set up
                  </p>
                </button>

                <button
                  onClick={() => handleOrganizationTypeSelect("individual")}
                  className="p-6 border-2 border-brand-border rounded-lg hover:border-brand-orange hover:bg-brand-dark transition-colors text-left flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="#FF6B00"
                      className="size-6"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <h4 className="text-lg font-semibold text-text-dark">
                      Individual
                    </h4>
                  </div>
                  <p className="text-zinc-300 text-sm">
                    Get started as an individual and create your first ScaleAI
                    challenge.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Create Organization */}
          {currentStep === "create" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-text-dark mb-2">
                  {organizationType === "individual"
                    ? "Verify Your Information"
                    : "Create Your Organization"}
                </h3>
                <p className="text-zinc-300">
                  {organizationType === "individual"
                    ? "Your information has been pre-filled from your account. Review and update as needed to create your personal workspace."
                    : "Set up your organization with a name and unique identifier."}
                </p>
              </div>

              <div className="space-y-4">
                {organizationType === "organization" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">
                        Organization Name
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={orgFormData.name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setOrgFormData({
                            ...orgFormData,
                            name: newName,
                            slug: newName
                              ? slugify(newName, { lower: true, strict: true })
                              : "",
                          });
                        }}
                        className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-text-dark focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                        placeholder={"Enter organization name"}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">
                        Organization Slug
                      </label>
                      <input
                        type="text"
                        value={orgFormData.slug}
                        disabled
                        onChange={(e) =>
                          setOrgFormData({
                            ...orgFormData,
                            slug: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-text-dark focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                        placeholder="your-organization-name"
                      />
                      <p className="text-xs text-text-muted mt-1">
                        This will be auto-generated from the organization name.
                      </p>
                    </div>
                  </>
                )}

                {organizationType === "individual" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={memberFormData.firstName}
                          onChange={(e) =>
                            setMemberFormData({
                              ...memberFormData,
                              firstName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-text-dark focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={memberFormData.lastName}
                          onChange={(e) =>
                            setMemberFormData({
                              ...memberFormData,
                              lastName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-text-dark focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={memberFormData.email}
                        onChange={(e) =>
                          setMemberFormData({
                            ...memberFormData,
                            email: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-brand-dark border border-brand-border rounded-md text-text-dark focus:ring-2 focus:ring-brand-orange focus:border-transparent"
                        placeholder="Enter email address"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateOrganization}
                  disabled={
                    loading ||
                    (organizationType === "organization" &&
                      !orgFormData.name.trim()) ||
                    (organizationType === "individual" &&
                      (!memberFormData.firstName.trim() ||
                        !memberFormData.lastName.trim() ||
                        !memberFormData.email.trim()))
                  }
                  className="px-4 py-2 bg-brand-orange text-text-dark rounded-md hover:bg-brand-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Creating..."
                    : organizationType === "individual"
                    ? "Create Personal Workspace"
                    : "Create Organization"}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Completion */}
          {currentStep === "complete" && (
            <div className="space-y-6 text-center">
              <h3 className="text-2xl font-semibold text-text-brand">
                Welcome to ScaleAI!
              </h3>
              <p className="text-zinc-300">
                {organizationType === "individual"
                  ? "Your personal workspace is ready! Start creating by creating a new classroom."
                  : "Your organization has been created successfully! You're now ready to start creating classrooms and managing your students."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <button
                  onClick={() => {
                    navigate("/classrooms");
                  }}
                  className="p-6 border-2 border-brand-orange rounded-lg hover:border-brand-orange hover:bg-brand-dark transition-colors text-left flex flex-col"
                >
                  <div className="ml-2 flex items-center gap-2 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="#FF6B00"
                      className="size-6"
                    >
                      <path
                        fillRule="evenodd"
                        d="M1.5 6.375c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v3.026a.75.75 0 0 1-.375.65 2.249 2.249 0 0 0 0 3.898.75.75 0 0 1 .375.65v3.026c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 17.625v-3.026a.75.75 0 0 1 .374-.65 2.249 2.249 0 0 0 0-3.898.75.75 0 0 1-.374-.65V6.375Zm15-1.125a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm.75 4.5a.75.75 0 0 0-1.5 0v.75a.75.75 0 0 0 1.5 0v-.75Zm-.75 3a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-1.5 0v-.75a.75.75 0 0 1 .75-.75Zm.75 4.5a.75.75 0 0 0-1.5 0V18a.75.75 0 0 0 1.5 0v-.75ZM6 12a.75.75 0 0 1 .75-.75H12a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 12Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <h4 className="font-semibold">
                      Create Your First Classroom
                    </h4>
                  </div>
                  <p className="text-sm text-zinc-300">
                    Start planning and organizing your first classroom
                  </p>
                </button>

                <button
                  onClick={() => {
                    handleClose();
                  }}
                  className="p-6 border-2 border-brand-border rounded-lg  hover:bg-brand-dark transition-colors text-left flex flex-col"
                >
                  <div className="ml-2 flex items-center gap-2 mb-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="#FF6B00"
                      className="size-6"
                    >
                      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
                      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
                    </svg>
                    <h4 className="font-semibold">Explore Dashboard</h4>
                  </div>
                  <p className="text-sm text-zinc-300">
                    Check out your new workspace
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <LoadingOverlay loading={loading} />
    </div>
  );
};

export default CreateOrganizationModal;
