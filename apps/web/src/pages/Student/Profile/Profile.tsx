import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import profileService from "../../../services/profile";
import profileTypeService from "../../../services/profileType";
import { useAuth } from "../../../context/AuthContext";
import VariablesForm from "../../../components/VariablesForm";
import VariablesDisplay from "../../../components/VariablesDisplay";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import type { StoreWithVariables } from "../../../types/profile";
import type { VariableDefinitionWithValue } from "../../../types/decision";
import type { ProfileType as StoreTypeModel } from "../../../types/profileType";
import { Dropdown } from "primereact/dropdown";
import { useGlobalContext } from "../../../context/GlobalContext";
import { unwrap, formatCurrency } from "../../../components/dashboard/utils";
import { getErrorMessage } from "../../../utils";
import AITextField from "../../../components/AIComponents/AITextField";
import Image from "../../../components/AIComponents/Image/Image";
import LoadingOverlay from "@/components/LoadingOverlay";
import Alert from "../../../components/Alert";

const STORE_FIELD_MAX = {
  studentId: 20,
  shopName: 80,
  storeLocation: 80,
  storeDescription: 500,
} as const;

const Profile: React.FC = () => {
  const { activeClassroom } = useAuth();
  const globalContext = useGlobalContext();
  const navigate = useNavigate();
  const [profile, setStore] = useState<StoreWithVariables | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [storeVariableDefinitions, setStoreVariableDefinitions] = useState<
    VariableDefinitionWithValue[]
  >([]);
  const [storeTypeVariableDefinitions, setStoreTypeVariableDefinitions] =
    useState<VariableDefinitionWithValue[]>([]);
  const [profileTypes, setStoreTypes] = useState<StoreTypeModel[]>([]);
  const [currentStoreType, setCurrentStoreType] =
    useState<StoreTypeModel | null>(null);
  const [showValidationError, setShowValidationError] = useState(false);

  const classroomId = activeClassroom?._id ?? null;

  const form = useForm<{
    studentId: string;
    shopName: string;
    profileType: string;
    storeDescription: string;
    storeLocation: string;
    imageUrl?: string;
    variables: Record<string, unknown>;
  }>({
    defaultValues: {
      studentId: "",
      shopName: "",
      profileType: "",
      storeDescription: "",
      storeLocation: "",
      imageUrl: "",
      variables: {},
    },
    mode: "all",
  });

  // RHF can report `isValid === false` with `errors === {}` when new fields register
  // after an initial validation pass (they are "unvalidated", not "invalid").
  // We use this flag to trigger one extra validation after dynamic variable fields mount.
  const needsPostHydrationValidationRef = useRef(false);

  const watchedImageUrl = useWatch({
    control: form.control,
    name: "imageUrl",
  });

  const fetchStore = useCallback(async () => {
    if (!classroomId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Fetch profile
      const response = await profileService.getStudentStore(classroomId);
      const next = unwrap(response) as StoreWithVariables | null;
      setStore(next);

      // Handle profileType - it may be a string (ID) or a populated object
      let storeTypeId = "";
      let populatedStoreType: StoreTypeModel | null = null;

      if (next?.profileType) {
        if (typeof next.profileType === "string") {
          storeTypeId = next.profileType;
        } else if (
          typeof next.profileType === "object" &&
          next.profileType !== null &&
          "_id" in next.profileType
        ) {
          // ProfileType is populated
          populatedStoreType = next.profileType as StoreTypeModel;
          storeTypeId = populatedStoreType._id;
          setCurrentStoreType(populatedStoreType);
        }
      }

      // Get profile variable definitions from activeClassroom
      const storeDefs = activeClassroom?.variableDefinitions?.profile ?? [];

      // Merge variable definitions with existing profile values
      // This ensures all definitions are shown, even if profile doesn't exist yet or hasn't filled them out
      const storeVariables =
        (next?.variables as Record<string, unknown> | undefined) ?? {};

      // Filter: active defs for creation; active OR key in profile for historical display
      const storeDefsForForm = storeDefs.filter(
        (def) =>
          def.isActive ||
          Object.prototype.hasOwnProperty.call(storeVariables, def.key)
      );
      const variablesWithValues: VariableDefinitionWithValue[] =
        storeDefsForForm.map((def) => ({
          ...def,
          value:
            storeVariables[def.key] ??
            def.defaultValue ??
            (def.dataType === "number" ? 0 : ""),
        }));

      setStoreVariableDefinitions(variablesWithValues);

      // Get profile type variable definitions from activeClassroom
      const storeTypeDefs =
        activeClassroom?.variableDefinitions?.profileType ?? [];

      // Get profile type variables from the populated profileType object
      const storeTypeVariables =
        (populatedStoreType?.variables as
          | Record<string, unknown>
          | undefined) ?? {};

      // Filter: active defs for creation; active OR key in profileType for historical display
      const storeTypeDefsForForm = storeTypeDefs.filter(
        (def) =>
          def.isActive ||
          Object.prototype.hasOwnProperty.call(storeTypeVariables, def.key)
      );
      const storeTypeVariablesWithValues: VariableDefinitionWithValue[] =
        storeTypeDefsForForm.map((def) => ({
          ...def,
          value:
            storeTypeVariables[def.key] ??
            def.defaultValue ??
            (def.dataType === "number" ? 0 : ""),
        }));

      setStoreTypeVariableDefinitions(storeTypeVariablesWithValues);

      // Convert to Record format for form
      const variablesRecord = variablesWithValues.reduce((acc, variable) => {
        acc[variable.key] = variable.value;
        return acc;
      }, {} as Record<string, unknown>);

      form.reset(
        {
          studentId: next?.studentId || "",
          shopName: next?.shopName || "",
          profileType: storeTypeId,
          storeDescription: next?.storeDescription || "",
          storeLocation: next?.storeLocation || "",
          imageUrl: next?.imageUrl || "",
          variables: variablesRecord,
        },
        { keepDirty: false }
      );
      // Trigger validation after dynamic variable fields mount (they register asynchronously
      // because they're driven by state like `storeVariableDefinitions`).
      needsPostHydrationValidationRef.current = true;
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [form, classroomId, activeClassroom]);

  const fetchStoreTypes = useCallback(async () => {
    if (!classroomId) return;
    try {
      const { data } = await profileTypeService.getAll("student", {
        classroomId,
      });
      setStoreTypes(data);
    } catch (err) {
      console.error("Failed to fetch profile types:", err);
    }
  }, [classroomId]);

  useEffect(() => {
    if (classroomId) {
      void fetchStoreTypes();
    }
  }, [classroomId, fetchStoreTypes]);

  useEffect(() => {
    if (classroomId) {
      void fetchStore();
    }
  }, [classroomId, fetchStore]);

  useEffect(() => {
    if (isLoading) return;
    if (!needsPostHydrationValidationRef.current) return;

    // Wait a tick so Controllers in `VariablesForm` have mounted/registered.
    const timeoutId = setTimeout(() => {
      void form.trigger();
      needsPostHydrationValidationRef.current = false;
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    form,
    isLoading,
    storeVariableDefinitions.length,
    storeTypeVariableDefinitions.length,
  ]);

  const errorSummary = useMemo(() => {
    const out: string[] = [];
    const walk = (node: unknown, path: string[]) => {
      if (!node || typeof node !== "object") return;
      // RHF FieldError shape typically includes `message`
      if (
        "message" in (node as Record<string, unknown>) &&
        typeof (node as Record<string, unknown>).message === "string"
      ) {
        const msg = String((node as Record<string, unknown>).message);
        out.push(`${path.join(".")}: ${msg}`);
        return;
      }
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "ref" || k === "type") continue;
        walk(v, [...path, k]);
      }
    };
    walk(form.formState.errors, []);
    return out;
  }, [form.formState.errors]);

  const onSave = form.handleSubmit(
    async (values) => {
      if (!classroomId) return;
      const cid = classroomId;
      if (isSaving) return;

      setIsSaving(true);
      try {
        const profileType = values.profileType.trim();
        if (!profileType) {
          globalContext?.showToast?.("Profile type is required", "error");
          return;
        }
        if (profile) {
          // Update existing profile
          await profileService.update(cid, {
            studentId: values.studentId.trim(),
            shopName: values.shopName.trim(),
            profileType,
            storeDescription: values.storeDescription.trim(),
            storeLocation: values.storeLocation.trim(),
            imageUrl: values.imageUrl,
            variables: values.variables ?? {},
          });
          globalContext?.showToast?.("Profile updated successfully", "success");
        } else {
          // Create new profile
          await profileService.create({
            classroomId: cid,
            studentId: values.studentId.trim(),
            shopName: values.shopName.trim(),
            profileType,
            storeDescription: values.storeDescription.trim(),
            storeLocation: values.storeLocation.trim(),
            imageUrl: values.imageUrl,
            variables: values.variables ?? {},
          });
          globalContext?.showToast?.("Profile created successfully", "success");
        }
        await fetchStore();
        // Navigate back to dashboard after successful save
        navigate("/dashboard");
      } catch (e) {
        console.error("Failed to save profile:", e);
        const errorMessage = getErrorMessage(e);
        globalContext?.showToast?.(errorMessage, "error");
      } finally {
        setIsSaving(false);
      }
    },
    () => {
      setShowValidationError(true);
      globalContext?.showToast?.("Please fix the highlighted fields.", "error");
    }
  );

  const disabled = !form.formState.isValid || isSaving;

  if (error && !profile) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-error mb-4">{error}</p>
              <button onClick={fetchStore} className="btn-teal">
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
      <LoadingOverlay loading={isLoading} />
      <div className="page">
        <div className="container">
          <FormProvider {...form}>
            {(errorSummary.length > 0 ||
              (showValidationError && !form.formState.isValid)) && (
              <Alert
                variant="error"
                title="Please fix the form"
                message={
                  errorSummary.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {errorSummary.slice(0, 8).map((m: string) => (
                        <li key={m}>{m}</li>
                      ))}
                      {errorSummary.length > 8 ? (
                        <li>…and {errorSummary.length - 8} more</li>
                      ) : null}
                    </ul>
                  ) : (
                    "Some fields are incomplete. Please review the form and try again."
                  )
                }
              />
            )}
            <div className="flex items-center justify-between mb-4">
              <h1 className="heading-xl">
                {profile ? "Edit Profile" : "Create Profile"}
              </h1>
              <div className="flex gap-2">
                <button
                  className="btn-outline"
                  onClick={() => navigate("/dashboard")}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={`btn-teal ${disabled ? "btn-disabled" : ""}`}
                  onClick={() => {
                    setShowValidationError(false);
                    void onSave();
                  }}
                  type="button"
                  disabled={disabled}
                >
                  {isSaving
                    ? "Saving..."
                    : profile
                    ? "Update Profile"
                    : "Create Profile"}
                </button>
              </div>
            </div>

            {/* Profile Basic Information */}
            <div className="card mb-6">
              <h2 className="heading-md mb-4">Profile Information</h2>
              <div className="flex flex-row gap-4">
                {/* Image on the left */}
                <div className="w-1/4">
                  <Image
                    src={
                      watchedImageUrl ||
                      (profile as { imageUrl?: string })?.imageUrl ||
                      ""
                    }
                    context={`Generate a logo for the profile with the name: ${form.watch(
                      "shopName"
                    )} and the description: ${form.watch("storeDescription")}`}
                    onAccept={(imageUrl) => {
                      form.setValue("imageUrl", imageUrl, {
                        shouldDirty: true,
                      });
                    }}
                  />
                </div>
                {/* Profile Name, Type, and Location stacked on the right */}
                <div className="flex flex-col gap-4 w-3/4">
                  <div className="flex flex-col w-full">
                    <label className="label" htmlFor="student-id">
                      Student ID <span className="text-error">*</span>
                    </label>
                    <Controller
                      name="studentId"
                      control={form.control}
                      rules={{
                        required: "Student ID is required",
                        maxLength: {
                          value: STORE_FIELD_MAX.studentId,
                          message: `Student ID must be ${STORE_FIELD_MAX.studentId} characters or less`,
                        },
                        validate: (v) =>
                          v?.trim().length > 0 || "Student ID is required",
                      }}
                      render={({ field }) => (
                        <input
                          id="student-id"
                          type="text"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          className="input"
                          placeholder="Enter your student ID"
                          maxLength={STORE_FIELD_MAX.studentId}
                        />
                      )}
                    />
                    {form.formState.errors.studentId && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.studentId.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col w-full">
                    <Controller
                      name="shopName"
                      control={form.control}
                      rules={{
                        required: "Shop name is required",
                        maxLength: {
                          value: STORE_FIELD_MAX.shopName,
                          message: `Shop name must be ${STORE_FIELD_MAX.shopName} characters or less`,
                        },
                        validate: (v) =>
                          v?.trim().length > 0 || "Shop name is required",
                      }}
                      render={({ field }) => (
                        <AITextField
                          id="shop-name"
                          label="Shop Name"
                          onChange={field.onChange}
                          value={field.value}
                          prompt="Generate a shop name for the profile"
                          promptMode="modal"
                          maxLength={STORE_FIELD_MAX.shopName}
                        />
                      )}
                    />
                    {form.formState.errors.shopName && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.shopName.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col w-full">
                    <div className="flex flex-row gap-4 w-full">
                      {/* Profile Type Dropdown */}
                      <div className="flex flex-col flex-2">
                        <label className="label" htmlFor="profile-type">
                          Profile Type <span className="text-error">*</span>
                        </label>
                        <Controller
                          name="profileType"
                          control={form.control}
                          rules={{ required: "Profile type is required" }}
                          render={({ field, fieldState }) => {
                            const storeTypeOptions = profileTypes.map((st) => ({
                              label: st.label,
                              value: st._id,
                            }));
                            return (
                              <Dropdown
                                id="profile-type"
                                value={field.value}
                                options={storeTypeOptions}
                                onChange={(e) => {
                                  field.onChange(e.value);
                                  // Update currentStoreType when selection changes
                                  const selectedStoreType = profileTypes.find(
                                    (st) => st._id === e.value
                                  );
                                  setCurrentStoreType(
                                    selectedStoreType || null
                                  );
                                  // Update profile type variables if we have definitions
                                  if (selectedStoreType && activeClassroom) {
                                    const storeTypeDefs =
                                      activeClassroom?.variableDefinitions
                                        ?.profileType ?? [];
                                    const storeTypeVariables =
                                      (selectedStoreType.variables as
                                        | Record<string, unknown>
                                        | undefined) ?? {};
                                    const storeTypeVariablesWithValues: VariableDefinitionWithValue[] =
                                      storeTypeDefs.map((def) => ({
                                        ...def,
                                        value:
                                          storeTypeVariables[def.key] ??
                                          def.defaultValue ??
                                          (def.dataType === "number" ? 0 : ""),
                                      }));
                                    setStoreTypeVariableDefinitions(
                                      storeTypeVariablesWithValues
                                    );
                                  } else {
                                    setStoreTypeVariableDefinitions([]);
                                  }
                                }}
                                className={`p-dropdown ${
                                  fieldState.error ? "p-invalid" : ""
                                }`}
                                placeholder="Select profile type"
                                disabled={
                                  storeTypeOptions.length === 0 ||
                                  (profile?.ledgerEntries?.length ?? 0) > 1
                                }
                              />
                            );
                          }}
                        />
                        {form.formState.errors.profileType && (
                          <p className="text-error text-sm mt-1">
                            {form.formState.errors.profileType.message}
                          </p>
                        )}
                      </div>

                      {/* Starting Balance - Read Only */}
                      <div className="flex flex-col flex-1">
                        <label className="label" htmlFor="starting-balance">
                          Starting Balance
                        </label>
                        <input
                          id="starting-balance"
                          type="text"
                          value={formatCurrency(
                            currentStoreType?.startingBalance ?? 0
                          )}
                          disabled
                          className="input disabled:opacity-50 disabled:cursor-not-allowed"
                          readOnly
                        />
                      </div>

                      {/* Initial Startup Cost - Read Only */}
                      <div className="flex flex-col flex-1">
                        <label className="label" htmlFor="initial-startup-cost">
                          Initial Startup Cost
                        </label>
                        <input
                          id="initial-startup-cost"
                          type="text"
                          value={formatCurrency(
                            currentStoreType?.initialStartupCost ?? 0
                          )}
                          disabled
                          className="input disabled:opacity-50 disabled:cursor-not-allowed"
                          readOnly
                        />
                      </div>
                    </div>
                    {currentStoreType && (
                      <div className="flex flex-col gap-4 w-full">
                        <p className="text-text-muted text-xs font-medium mt-2 pl-2">
                          Profile Type Description: {currentStoreType.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Controller
                      name="storeLocation"
                      control={form.control}
                      rules={{
                        maxLength: {
                          value: STORE_FIELD_MAX.storeLocation,
                          message: `Profile location must be ${STORE_FIELD_MAX.storeLocation} characters or less`,
                        },
                      }}
                      render={({ field }) => (
                        <AITextField
                          id="profile-location"
                          label="Profile Location"
                          onChange={field.onChange}
                          value={field.value}
                          prompt={`Generate a profile location for the profile with this name: ${form.getValues(
                            "shopName"
                          )}`}
                          promptMode="modal"
                          maxLength={STORE_FIELD_MAX.storeLocation}
                        />
                      )}
                    />
                    {form.formState.errors.storeLocation && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.storeLocation.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Controller
                      name="storeDescription"
                      control={form.control}
                      rules={{
                        maxLength: {
                          value: STORE_FIELD_MAX.storeDescription,
                          message: `Profile description must be ${STORE_FIELD_MAX.storeDescription} characters or less`,
                        },
                      }}
                      render={({ field }) => (
                        <AITextField
                          id="profile-description"
                          label="Profile Description"
                          onChange={field.onChange}
                          value={field.value}
                          prompt={`Generate a profile description for the profile with this title: ${form.getValues(
                            "shopName"
                          )}`}
                          promptMode="modal"
                          multiline
                          rows={4}
                          maxLength={STORE_FIELD_MAX.storeDescription}
                        />
                      )}
                    />
                    {form.formState.errors.storeDescription && (
                      <p className="text-error text-sm mt-1">
                        {form.formState.errors.storeDescription.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Type Variables */}
            {currentStoreType && storeTypeVariableDefinitions.length > 0 && (
              <div className="section m-2 mb-6">
                <VariablesDisplay
                  variables={storeTypeVariableDefinitions}
                  title="Profile Type Variables"
                  description={`Variables for ${currentStoreType.label} profile type.`}
                />
              </div>
            )}

            {/* Profile Variables */}
            {storeVariableDefinitions.length > 0 && (
              <div className="section m-2 mb-6">
                <VariablesForm
                  variables={storeVariableDefinitions}
                  readOnly={true}
                  title="Profile Variables"
                  description="Configure the variables used for your profile."
                />
              </div>
            )}

            {profile && (
              <div className="card">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-text-muted text-xs font-medium mb-1">
                      Profile ID
                    </p>
                    <p className="text-text-muted text-sm">{profile._id}</p>
                  </div>
                  {profile.createdDate && (
                    <div>
                      <p className="text-text-muted text-xs font-medium mb-1">
                        Created
                      </p>
                      <p className="text-text-muted text-sm">
                        {new Date(profile.createdDate).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {profile.updatedDate && (
                    <div>
                      <p className="text-text-muted text-xs font-medium mb-1">
                        Last Updated
                      </p>
                      <p className="text-text-muted text-sm">
                        {new Date(profile.updatedDate).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </FormProvider>
        </div>
      </div>
    </BasicLayout>
  );
};

export default Profile;
