const ClassroomTemplate = require("./classroomTemplate.model");
const Classroom = require("../classroom/classroom.model");
const StoreType = require("../storeType/storeType.model");
const VariableDefinition = require("../variableDefinition/variableDefinition.model");
const VariableValue = require("../variableDefinition/variableValue.model");

async function buildTemplatePayloadFromClassroom({
  organizationId,
  classroomId,
  includeInactive,
}) {
  const storeTypes = await StoreType.find({
    organization: organizationId,
    classroomId,
    ...(includeInactive === "true" ? {} : { isActive: true }),
  })
    .select("key label description isActive")
    .sort({ label: 1 })
    .lean();

  const defsQuery = {
    organization: organizationId,
    classroomId,
    ...(includeInactive === "true" ? {} : { isActive: true }),
  };
  const definitions = await VariableDefinition.find(defsQuery)
    .sort({ appliesTo: 1, label: 1 })
    .lean();

  const defsByAppliesTo = {
    storeType: [],
    store: [],
    submission: [],
    scenario: [],
  };
  definitions.forEach((d) => {
    if (defsByAppliesTo[d.appliesTo]) defsByAppliesTo[d.appliesTo].push(d);
  });

  const storeTypeValuesByStoreTypeKey = {};
  if (storeTypes.length > 0) {
    const storeTypeIds = storeTypes.map((st) => st._id);
    const values = await VariableValue.find({
      organization: organizationId,
      classroomId,
      appliesTo: "storeType",
      ownerId: { $in: storeTypeIds },
    }).lean();

    const keyByStoreTypeId = new Map();
    storeTypes.forEach((st) => keyByStoreTypeId.set(String(st._id), st.key));

    values.forEach((v) => {
      const stKey = keyByStoreTypeId.get(String(v.ownerId));
      if (!stKey) return;
      if (!storeTypeValuesByStoreTypeKey[stKey]) {
        storeTypeValuesByStoreTypeKey[stKey] = {};
      }
      storeTypeValuesByStoreTypeKey[stKey][v.variableKey] = v.value;
    });

    // ensure keys exist even if no values yet
    storeTypes.forEach((st) => {
      if (!storeTypeValuesByStoreTypeKey[st.key]) {
        storeTypeValuesByStoreTypeKey[st.key] = {};
      }
    });
  }

  return {
    storeTypes: storeTypes.map((st) => ({
      key: st.key,
      label: st.label,
      description: st.description || "",
      isActive: st.isActive !== false,
    })),
    variableDefinitionsByAppliesTo: defsByAppliesTo,
    storeTypeValuesByStoreTypeKey,
  };
}

function validateTemplateVariableDefinition(appliesTo, def) {
  if (!def || typeof def !== "object") {
    throw new Error("definition is required");
  }
  if (!def.key) throw new Error("definition.key is required");
  if (!def.label) throw new Error("definition.label is required");
  if (!def.appliesTo) throw new Error("definition.appliesTo is required");
  if (def.appliesTo !== appliesTo) {
    throw new Error("definition.appliesTo must match appliesTo");
  }
  if (!def.dataType) throw new Error("definition.dataType is required");

  const validAppliesTo = ["store", "scenario", "submission", "storeType"];
  if (!validAppliesTo.includes(appliesTo)) {
    throw new Error(
      "appliesTo must be one of: store, scenario, submission, storeType"
    );
  }

  const validDataTypes = ["number", "string", "boolean", "select"];
  if (!validDataTypes.includes(def.dataType)) {
    throw new Error("dataType must be one of: number, string, boolean, select");
  }

  const validCombinations = {
    number: ["number", "slider", "knob"],
    string: ["text", "dropdown", "selectbutton", "multiple-choice"],
    boolean: ["checkbox", "switch"],
    select: ["dropdown"],
  };

  if (
    def.inputType &&
    validCombinations[def.dataType] &&
    !validCombinations[def.dataType].includes(def.inputType)
  ) {
    throw new Error(
      `Invalid inputType "${def.inputType}" for dataType "${def.dataType}"`
    );
  }

  if (
    (def.dataType === "select" || def.inputType === "dropdown") &&
    (!Array.isArray(def.options) || def.options.length === 0)
  ) {
    throw new Error("Options are required for select/dropdown type");
  }
}

exports.listTemplates = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const { includeInactive } = req.query;

    const query = { organization: organizationId, isActive: true };
    if (includeInactive === "true") delete query.isActive;

    const templates = await ClassroomTemplate.find(query)
      .select("_id key label description version isActive sourceTemplateId")
      .sort({ label: 1 });

    return res.json({ success: true, data: templates });
  } catch (error) {
    console.error("Error listing classroom templates:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getTemplate = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const { templateId } = req.params;

    const template = await ClassroomTemplate.findOne({
      _id: templateId,
      organization: organizationId,
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    return res.json({ success: true, data: template });
  } catch (error) {
    console.error("Error fetching classroom template:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.addVariableDefinition = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { templateId } = req.params;
    const { appliesTo, definition } = req.body;

    if (!appliesTo) {
      return res.status(400).json({ error: "appliesTo is required" });
    }

    validateTemplateVariableDefinition(appliesTo, definition);

    const template = await ClassroomTemplate.findOne({
      _id: templateId,
      organization: organizationId,
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (!template.payload || typeof template.payload !== "object") {
      template.payload = {};
    }
    if (
      !template.payload.variableDefinitionsByAppliesTo ||
      typeof template.payload.variableDefinitionsByAppliesTo !== "object"
    ) {
      template.payload.variableDefinitionsByAppliesTo = {};
    }

    const bucket =
      template.payload.variableDefinitionsByAppliesTo[appliesTo] || [];

    if (bucket.some((d) => d && d.key === definition.key)) {
      return res.status(409).json({
        error: `VariableDefinition with key "${definition.key}" already exists in this template for appliesTo="${appliesTo}"`,
      });
    }

    template.payload.variableDefinitionsByAppliesTo[appliesTo] = [
      ...bucket,
      {
        ...definition,
        isActive: definition.isActive !== false,
      },
    ];

    template.updatedBy = clerkUserId;
    await template.save();

    return res.status(201).json({
      success: true,
      message: "VariableDefinition added to template",
      data: template,
    });
  } catch (error) {
    console.error("Error adding VariableDefinition to template:", error);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Create a new template from a classroom snapshot
 * POST /v1/admin/classroom-templates/from-classroom?classroomId=...
 */
exports.createFromClassroom = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { classroomId, includeInactive } = req.query;
    const { key, label, description, isActive } = req.body || {};

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const classroom = await Classroom.findById(classroomId).select("name");
    const finalKey =
      (key && String(key).trim()) ||
      `template_${classroomId}_${Date.now().toString(36)}`;
    const finalLabel =
      (label && String(label).trim()) ||
      `Template from ${classroom?.name || "Classroom"}`;

    const existingKey = await ClassroomTemplate.findOne({
      organization: organizationId,
      key: finalKey,
    }).select("_id");
    if (existingKey) {
      return res.status(409).json({
        error: `Template with key "${finalKey}" already exists`,
      });
    }

    const payload = await buildTemplatePayloadFromClassroom({
      organizationId,
      classroomId,
      includeInactive,
    });

    const template = new ClassroomTemplate({
      organization: organizationId,
      key: finalKey,
      label: finalLabel,
      description: description || "",
      isActive: isActive !== false,
      version: 1,
      sourceTemplateId: null,
      payload,
      createdBy: clerkUserId,
      updatedBy: clerkUserId,
    });

    await template.save();

    return res.status(201).json({
      success: true,
      message: "Template created from classroom",
      data: template,
    });
  } catch (error) {
    console.error("Error creating template from classroom:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Overwrite an existing org template (by key) from a classroom snapshot
 * PUT /v1/admin/classroom-templates/from-classroom?classroomId=...&key=...
 * If key is omitted, defaults to the org's default_supply_chain_101 template.
 */
exports.overwriteFromClassroom = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { classroomId, includeInactive, key } = req.query;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const templateKey =
      (key && String(key).trim()) || ClassroomTemplate.GLOBAL_DEFAULT_KEY;

    let template = await ClassroomTemplate.findOne({
      organization: organizationId,
      key: templateKey,
    });

    // If missing (older orgs), create the default copy and retry (only for default key).
    if (!template && templateKey === ClassroomTemplate.GLOBAL_DEFAULT_KEY) {
      await ClassroomTemplate.copyGlobalToOrganization(
        organizationId,
        clerkUserId
      );
      template = await ClassroomTemplate.findOne({
        organization: organizationId,
        key: templateKey,
      });
    }

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    template.payload = await buildTemplatePayloadFromClassroom({
      organizationId,
      classroomId,
      includeInactive,
    });
    template.updatedBy = clerkUserId;
    await template.save();

    return res.json({
      success: true,
      message: "Template overwritten from classroom",
      data: template,
    });
  } catch (error) {
    console.error("Error overwriting template from classroom:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.importFromClass = async function (req, res) {
  try {
    const organizationId = req.organization._id;
    const clerkUserId = req.clerkUser.id;
    const { templateId } = req.params;
    const { classroomId } = req.query;
    const { includeInactive } = req.query;

    if (!classroomId) {
      return res
        .status(400)
        .json({ error: "classroomId query parameter is required" });
    }

    await Classroom.validateAdminAccess(
      classroomId,
      clerkUserId,
      organizationId
    );

    const template = await ClassroomTemplate.findOne({
      _id: templateId,
      organization: organizationId,
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    template.payload = await buildTemplatePayloadFromClassroom({
      organizationId,
      classroomId,
      includeInactive,
    });
    template.updatedBy = clerkUserId;
    await template.save();

    return res.json({
      success: true,
      message: "Template imported from classroom",
      data: template,
    });
  } catch (error) {
    console.error("Error importing template from class:", error);
    return res.status(500).json({ error: error.message });
  }
};
