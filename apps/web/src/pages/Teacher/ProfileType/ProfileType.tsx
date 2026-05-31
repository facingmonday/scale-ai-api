import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormProvider, useForm } from "react-hook-form";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import VariablesForm from "../../../components/VariablesForm";
import { useAuth } from "../../../context/AuthContext";
import { useGlobalContext } from "../../../context/GlobalContext";
import profileTypeService from "../../../services/profileType";
import type { ProfileType } from "../../../types/profileType";
import type { VariableDefinitionWithValue } from "../../../types/decision";
import { getErrorMessage } from "../../../utils/error";
import LoadingOverlay from "../../../components/LoadingOverlay";

type FormValues = {
  label: string;
  description: string;
  isActive: boolean;
  startingBalance: string;
  initialStartupCost: string;
  variables: Record<string, unknown>;
};

const StoreTypePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const globalContext = useGlobalContext();
  const { activeClassroom, refetchMe } = useAuth();
  const classroomId = activeClassroom?._id ?? null;
  const returnTo = searchParams.get("returnTo");

  const [profileType, setStoreType] = useState<ProfileType | null>(null);
  const [variableDefinitions, setVariableDefinitions] = useState<
    VariableDefinitionWithValue[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: {
      label: "",
      description: "",
      isActive: true,
      startingBalance: "0",
      initialStartupCost: "0",
      variables: {},
    },
    mode: "onChange",
  });

  const watchedVariables = form.watch("variables");

  const fetchStoreType = useCallback(async () => {
    if (!id) return;
    if (!classroomId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await profileTypeService.getByKey(id, { classroomId });
      const next = (response?.data ?? response) as ProfileType;
      setStoreType(next);

      const defs = activeClassroom?.variableDefinitions?.profileType ?? [];
      const existingVars = (next.variables ?? {}) as Record<string, unknown>;

      // Filter: active defs for creation; active OR key in existing data for historical display
      const defsForForm = defs.filter(
        (d) =>
          d.isActive ||
          Object.prototype.hasOwnProperty.call(existingVars, d.key)
      );
      const variablesWithValues: VariableDefinitionWithValue[] = defsForForm.map(
        (def) => ({
          ...def,
          value:
            existingVars[def.key] ??
            def.defaultValue ??
            (def.dataType === "number" ? 0 : ""),
        })
      );
      setVariableDefinitions(variablesWithValues);

      const variablesRecord = variablesWithValues.reduce((acc, v) => {
        acc[v.key] = v.value;
        return acc;
      }, {} as Record<string, unknown>);

      form.reset(
        {
          label: next.label ?? "",
          description: next.description ?? "",
          isActive: !!next.isActive,
          startingBalance: String(next.startingBalance ?? 0),
          initialStartupCost: String(next.initialStartupCost ?? 0),
          variables: variablesRecord,
        },
        { keepDirty: false }
      );
    } catch (e) {
      console.error("Failed to fetch profile type:", e);
      setError("Failed to load profile type");
    } finally {
      setIsLoading(false);
    }
  }, [id, classroomId, activeClassroom, form]);

  useEffect(() => {
    void fetchStoreType();
  }, [fetchStoreType]);

  const canSave = useMemo(() => {
    return !!id && !isSaving && form.formState.isValid;
  }, [id, isSaving, form.formState.isValid]);

  const onSave = form.handleSubmit(async (values) => {
    if (!id) return;
    if (!classroomId) return;
    if (isSaving) return;

    setIsSaving(true);
    try {
      const currentValues = form.getValues();
      const variablesToSave =
        watchedVariables ?? currentValues.variables ?? values.variables ?? {};

      await profileTypeService.update(
        id,
        {
          label: values.label.trim(),
          description: values.description.trim(),
          isActive: !!values.isActive,
          startingBalance: Number(values.startingBalance || 0),
          initialStartupCost: Number(values.initialStartupCost || 0),
          variables: variablesToSave,
        },
        { classroomId }
      );

      globalContext?.showToast?.("Profile type saved", "success");
      await fetchStoreType();
    } catch (e) {
      console.error("Failed to save profile type:", e);
      globalContext?.showToast?.(getErrorMessage(e), "error");
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  });

  if (error) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => void fetchStoreType()}
                className="btn-teal"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </BasicLayout>
    );
  }

  if (!profileType) {
    return (
      <BasicLayout>
        <div className="page">
          <div className="container">
            <div className="card text-center py-12">
              <h2 className="heading-lg mb-2">Profile Type Not Found</h2>
              <p className="text-text-muted">
                The profile type you're looking for doesn't exist.
              </p>
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
            <div className="flex items-center justify-between mb-6">
              <h1 className="heading-xl">{profileType.label || profileType.key}</h1>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => navigate(returnTo || "/profile-types")}
                  disabled={isSaving}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-teal"
                  onClick={() => void onSave()}
                  disabled={!canSave}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="card">
                <h2 className="heading-md mb-4">Details</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="profile-type-key">
                      Key
                    </label>
                    <InputText id="profile-type-key" value={profileType.key} disabled />
                    <p className="text-text-muted text-xs mt-1">
                      Unique identifier (cannot be changed)
                    </p>
                  </div>

                  <div>
                    <label className="label" htmlFor="profile-type-label">
                      Label
                    </label>
                    <InputText
                      id="profile-type-label"
                      value={form.watch("label")}
                      onChange={(e) =>
                        form.setValue("label", e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="label" htmlFor="profile-type-description">
                      Description
                    </label>
                    <InputTextarea
                      id="profile-type-description"
                      value={form.watch("description")}
                      onChange={(e) =>
                        form.setValue("description", e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      rows={4}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      inputId="profile-type-active"
                      checked={!!form.watch("isActive")}
                      onChange={(e) =>
                        form.setValue("isActive", !!e.checked, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      disabled={isSaving}
                    />
                    <label className="label mb-0" htmlFor="profile-type-active">
                      Active
                    </label>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="heading-md mb-4">Economics</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="profile-type-startingBalance">
                      Starting Balance
                    </label>
                    <InputText
                      id="profile-type-startingBalance"
                      type="number"
                      min={0}
                      value={form.watch("startingBalance")}
                      onChange={(e) =>
                        form.setValue("startingBalance", e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      disabled={isSaving}
                    />
                    <p className="text-text-muted text-xs mt-1">
                      Starting cash balance for new student profiles of this type.
                    </p>
                  </div>

                  <div>
                    <label
                      className="label"
                      htmlFor="profile-type-initialStartupCost"
                    >
                      Initial Startup Cost
                    </label>
                    <InputText
                      id="profile-type-initialStartupCost"
                      type="number"
                      min={0}
                      value={form.watch("initialStartupCost")}
                      onChange={(e) =>
                        form.setValue("initialStartupCost", e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      disabled={isSaving}
                    />
                    <p className="text-text-muted text-xs mt-1">
                      One-time cost applied when a student creates a profile.
                    </p>
                  </div>
                </div>
              </div>

              <VariablesForm
                variables={variableDefinitions}
                title="Profile Type Variables"
                description="Variables for this profile type (driven by class variable definitions)."
                namePrefix="variables"
                defaultAppliesTo="profileType"
                showAddButton={true}
                onSave={async () => {
                  globalContext?.showToast?.(
                    "Variable definition saved",
                    "success"
                  );
                  // Refresh activeClassroom to get the new variable definition
                  await refetchMe();
                  // Then refresh the profile type to show the new variable
                  await fetchStoreType();
                }}
              />
            </div>
          </FormProvider>
        </div>
      </div>
    </BasicLayout>
  );
};

export default StoreTypePage;
