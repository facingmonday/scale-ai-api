const mongoose = require("mongoose");
/**
 * Template service to handle template data population and validation
 */
class TemplateService {
  /**
   * Get the correct model name with proper capitalization
   * @param {String} modelKey - The model key from the template requirements
   * @returns {String} - The properly capitalized model name
   */
  getModelName(modelKey) {
    // Map of lowercase model names to their correctly capitalized versions
    const modelNameMap = {
      organization: "Organization",
      user: "User",
      event: "Event",
      member: "Member",
      order: "Order",
      invitation: "OrganizationInvitation",
    };

    // If we have a mapping, use it, otherwise just capitalize first letter
    if (modelNameMap[modelKey.toLowerCase()]) {
      return modelNameMap[modelKey.toLowerCase()];
    }

    // Default capitalization for model names not in the map
    return modelKey.charAt(0).toUpperCase() + modelKey.slice(1);
  }

  /**
   * Get template file name from slug
   * @param {string} templateSlug - Template slug
   * @returns {string} - Template file name
   */
  getTemplateFileName(templateSlug) {
    // Map slugs to template file names
    const templateMap = {
      "ticket-template": "TicketTemplateEmail",
      "order-cancelled": "OrderCancelledEmail",
      "order-created": "OrderCreatedEmail",
      "share-template": "ShareTemplateEmail",
      "event-announcement": "EventInvitationEmail",
      "event-invitation": "EventInvitationEmail",
      "tickets-generated": "TicketsGeneratedEmail",
      "ticket-reminder": "TicketReminderEmail",
      "ticket-claimed": "TicketClaimedEmail",
      "daily-stats": "DailyStatsEmail",
    };

    return templateMap[templateSlug] || null;
  }

  /**
   * Populates template data based on provided model IDs
   * @param {Object} template - Template object
   * @param {Object} modelData - Map of model keys to IDs or objects
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Additional options
   * @param {Array} options.populate - Array of paths to populate (e.g. ['event.location', 'member.tags'])
   * @returns {Promise<Object>} - Populated template data
   */
  async populateTemplateData(
    templateSlug,
    modelData,
    organizationId,
    options = {}
  ) {
    const populatedData = {};
    let populatePaths = [];

    // Load populate paths from template
    try {
      const templateFileName = this.getTemplateFileName(templateSlug);
      if (templateFileName) {
        const templateModule = require(
          `./emails/templates/${templateFileName}`
        );
        populatePaths = templateModule.populatePaths || [];
      }
    } catch (error) {
      console.warn(
        `Could not load populate paths for template ${templateSlug}:`,
        error.message
      );
    }

    const Organization = require("../services/organizations/organization.model");

    // Populate all models in modelData
    for (const [key, value] of Object.entries(modelData)) {
      if (!value) continue;

      try {
        // Special handling for Member IDs (Clerk user IDs)
        if (key === "member" && typeof value === "string") {
          const Member = require("../services/members/member.model");
          const member = await Member.findByClerkUserId(value);
          const organization = await Organization.findById(organizationId);
          if (member) {
            const orgMembership =
              member.getOrganizationMembership(organization);
            if (orgMembership) {
              populatedData[key] = {
                id: member.clerkUserId,
                userId: member.clerkUserId,
                email: member.email,
                firstName: member.firstName,
                lastName: member.lastName,
                fullName: member.fullName,
                name: member.fullName || member.name,
                phone: member.phone,
                imageUrl: member.imageUrl,
                role: orgMembership.role,
                isActive: orgMembership.isActive,
                subscribed: orgMembership.subscribed,
                membershipType: orgMembership.membershipType,
                tags: orgMembership.tags,
                joinedDate: orgMembership.joinedDate,
                customFields: orgMembership.customFields,
                createdAt: member.clerkCreatedAt,
                updatedAt: member.clerkUpdatedAt,
                lastSignInAt: member.lastSignInAt,
              };
            } else {
              populatedData[key] = null;
            }
          } else {
            populatedData[key] = null;
          }
          continue;
        }

        // Get the mongoose model with proper capitalization
        const modelName = this.getModelName(key);
        const Model = mongoose.model(modelName);

        // Check if we need to apply specific population
        const fieldsToPopulate = populatePaths
          .filter((path) => path.startsWith(`${key}.`))
          .map((path) => path.substr(key.length + 1));

        if (Array.isArray(value)) {
          // Handle array of IDs
          const ids = value.filter(
            (id) => id && mongoose.Types.ObjectId.isValid(id)
          );
          const query = { _id: { $in: ids } };

          // Organization model no longer exists - remove organization filtering

          let findQuery = Model.find(query);

          // Apply population if needed
          if (fieldsToPopulate.length > 0) {
            fieldsToPopulate.forEach((path) => {
              // Handle nested paths
              const nestedPaths = path.split(".");
              let currentPath = nestedPaths[0];
              let currentPopulate = { path: currentPath };
              let current = currentPopulate;

              for (let i = 1; i < nestedPaths.length; i++) {
                current.populate = { path: nestedPaths[i] };
                current = current.populate;
              }

              findQuery = findQuery.populate(currentPopulate);
            });
          }

          populatedData[key] = await findQuery.lean();
        } else {
          // Handle single ID or object
          if (
            typeof value === "object" &&
            !mongoose.Types.ObjectId.isValid(value)
          ) {
            // Already an object, use as is
            populatedData[key] = value;
          } else {
            // Fetch from database
            const query = { _id: value };

            // Organization model no longer exists - remove organization filtering

            let findQuery = Model.findOne(query);

            // Apply population if needed
            if (fieldsToPopulate.length > 0) {
              fieldsToPopulate.forEach((path) => {
                // Handle nested paths
                const nestedPaths = path.split(".");
                let currentPath = nestedPaths[0];
                let currentPopulate = { path: currentPath };
                let current = currentPopulate;

                for (let i = 1; i < nestedPaths.length; i++) {
                  current.populate = { path: nestedPaths[i] };
                  current = current.populate;
                }

                findQuery = findQuery.populate(currentPopulate);
              });
            }

            const result = await findQuery.lean();
            populatedData[key] = result || null;
          }
        }
      } catch (error) {
        console.error(
          `Error populating model data for ${key}: ${error.message}`
        );
      }
    }

    return populatedData;
  }
}

module.exports = new TemplateService();
