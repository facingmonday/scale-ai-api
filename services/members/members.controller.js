const Member = require("./member.model");

/**
 * Get all members for the current organization
 */
exports.getAllMembers = async (req, res) => {
  try {
    const organization = req.organization;
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 50;

    // Parse filters
    const filters = {};
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === "true";
    }
    if (req.query.subscribed !== undefined) {
      filters.subscribed = req.query.subscribed === "true";
    }
    if (req.query.membershipType) {
      filters.membershipType = req.query.membershipType;
    }

    const result = await Member.getOrganizationMembers(
      organization,
      filters,
      page,
      pageSize
    );

    res.status(200).json({
      page,
      pageSize,
      hasMore: result.hasMore,
      total: result.totalCount,
      data: result.members,
    });
  } catch (error) {
    console.error("Error getting members:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get a specific member by ID
 */
exports.getMemberById = async (req, res) => {
  try {
    const organization = req.organization;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Member ID is required" });
    }

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const member = await Member.findById(id);

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Get organization-specific membership data
    const orgMembership = member.getOrganizationMembership(organization);

    if (!orgMembership) {
      return res
        .status(404)
        .json({ message: "Member not found in this organization" });
    }

    // Format response with organization-specific data
    const formattedMember = await Member.formatMemberResponse(
      member,
      orgMembership,
      true
    );

    res.status(200).json(formattedMember);
  } catch (error) {
    console.error("Error getting member:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create or invite a new member
 */
exports.createMember = async (req, res) => {
  try {
    const organization = req.organization;
    const {
      email,
      role,
      firstName,
      lastName,
      phone,
      membershipType,
      isActive,
      subscribed,
      tags,
      customFields,
      publicMetadata,
    } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const membershipMetadata = publicMetadata || {
      membershipType: membershipType || "basic",
      isActive: isActive !== undefined ? isActive : true,
      subscribed: subscribed !== undefined ? subscribed : true,
      tags: tags || [],
      customFields: customFields || {},
    };

    const member = await Member.createMember(
      { email, firstName, lastName, phone, role },
      organization,
      membershipMetadata
    );

    res.status(201).json(member);
  } catch (error) {
    console.error("Error creating member:", error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * Update a member's organization-specific data
 */
exports.updateMember = async (req, res) => {
  try {
    const organization = req.organization;
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ message: "Member ID is required" });
    }

    // Remove fields that shouldn't be updated this way
    delete updateData.id;
    delete updateData.userId;
    delete updateData.email;
    delete updateData.joinedDate;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const member = await Member.updateMember(id, organization, updateData);

    res.status(200).json(member);
  } catch (error) {
    console.error("Error updating member:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.updateOrganizationMembership = async (req, res) => {
  try {
    const organization = req.organization;
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ message: "Member ID is required" });
    }

    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const member = await Member.findById(id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    // Update membership in Clerk first
    await Member.updateMembershipInClerk(
      member.clerkUserId,
      organization.clerkOrganizationId,
      updateData
    );

    // Poll every second until the member is found (with a sensible timeout)
    const waitForMember = async (
      memberId,
      { timeoutMs = 30000, intervalMs = 1000 } = {}
    ) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const doc = await Member.findById(memberId);
        if (doc) return doc;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      return null;
    };

    const updatedMember = await waitForMember(id);

    if (!updatedMember) {
      return res.status(404).json({ message: "Member not found" });
    }

    res.status(200).json(updatedMember);
  } catch (error) {
    console.error("Error updating organization membership:", error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * Remove member from organization
 */
exports.removeMember = async (req, res) => {
  try {
    const organization = req.organization;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Member ID is required" });
    }

    const member = await Member.findById(id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    const result = await Member.removeMemberFromOrganization(
      member,
      organization
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Search members by name or email
 */
exports.searchMembers = async (req, res) => {
  try {
    const organization = req.organization;
    const { q: searchTerm } = req.query;
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 20;

    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }

    const members = await Member.searchMembers(
      organization,
      searchTerm,
      page,
      pageSize
    );

    res.status(200).json({
      searchTerm,
      page,
      pageSize,
      data: members,
    });
  } catch (error) {
    console.error("Error searching members:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add an existing Clerk user to the organization
 */
exports.addExistingUser = async (req, res) => {
  try {
    const organization = req.organization;
    const { userId, membershipType, isActive, subscribed, tags, customFields } =
      req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const member = await Member.createMember({ userId }, organization, {
      membershipType: membershipType || "basic",
      isActive: isActive !== undefined ? isActive : true,
      subscribed: subscribed !== undefined ? subscribed : true,
      tags: tags || [],
      customFields: customFields || {},
    });

    res.status(201).json(member);
  } catch (error) {
    console.error("Error adding existing user:", error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * Get member statistics for the organization
 */
exports.getMemberStats = async (req, res) => {
  try {
    const organization = req.organization;

    // Get all members for the organization
    const allMembers = await Member.getOrganizationMembers(
      organization,
      {},
      0,
      1000
    );

    const stats = {
      total: allMembers.totalCount,
      active: allMembers.members.filter((m) => m.isActive).length,
      subscribed: allMembers.members.filter((m) => m.subscribed).length,
      byMembershipType: {},
    };

    // Calculate membership type distribution
    allMembers.members.forEach((member) => {
      const type = member.membershipType || "basic";
      stats.byMembershipType[type] = (stats.byMembershipType[type] || 0) + 1;
    });

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error getting member stats:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Populate masked contact info for all members (migration/maintenance endpoint)
 */
exports.populateMaskedContactInfo = async (req, res) => {
  try {
    const { batchSize = 50, delay = 1000 } = req.body;

    // This is a potentially long-running operation, so we'll run it in the background
    // and return immediately with a status message
    Member.populateMaskedContactInfoForAll({ batchSize, delay })
      .then((result) => {
        console.log("Bulk masked contact info population completed:", result);
      })
      .catch((error) => {
        console.error("Bulk masked contact info population failed:", error);
      });

    res.status(202).json({
      message: "Masked contact info population started in background",
      estimatedTime:
        "This may take several minutes depending on the number of members",
    });
  } catch (error) {
    console.error("Error starting masked contact info population:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Export members as CSV and email to specified address
 */
exports.exportMembers = async (req, res) => {
  try {
    const organization = req.organization;
    const { email: recipientEmail } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ message: "Email address is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({ message: "Invalid email address format" });
    }

    // Return immediately - this is a long-running operation
    res.status(202).json({
      message: "Member export started",
      recipientEmail,
      note: "You will receive an email with the CSV file when the export is complete",
    });

    // Process export in background
    (async () => {
      try {
        console.log(
          `Starting member export for organization ${organization._id}, sending to ${recipientEmail}`
        );

        // Fetch all members with emails (throttled to avoid rate limits)
        const membersData = await Member.getAllMembersWithEmails(
          organization,
          { rateLimitDelay: 1000 } // 1 second delay between Clerk API calls
        );

        console.log(`Fetched ${membersData.length} members with email data`);

        // Generate CSV
        const { Parser } = require("json2csv");

        const fields = [
          "id",
          "clerkUserId",
          "firstName",
          "lastName",
          "fullName",
          "username",
          "email",
          "phone",
          "maskedEmail",
          "maskedPhone",
          "imageUrl",
          "role",
          "isActive",
          "subscribed",
          "membershipType",
          "tags",
          "joinedDate",
          "createdAt",
          "updatedAt",
          "lastSignInAt",
        ];

        // Transform data for CSV (convert arrays to strings)
        const csvData = membersData.map((member) => ({
          ...member,
          tags: Array.isArray(member.tags)
            ? member.tags.join("; ")
            : member.tags || "",
          joinedDate: member.joinedDate
            ? new Date(member.joinedDate).toISOString()
            : "",
          createdAt: member.createdAt
            ? new Date(member.createdAt).toISOString()
            : "",
          updatedAt: member.updatedAt
            ? new Date(member.updatedAt).toISOString()
            : "",
          lastSignInAt: member.lastSignInAt
            ? new Date(member.lastSignInAt).toISOString()
            : "",
        }));

        const parser = new Parser({ fields });
        const csv = parser.parse(csvData);

        // Send email with CSV attachment using SendGrid
        const { sgMail } = require("../../lib/sendGrid");

        const msg = {
          to: recipientEmail,
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "no-reply@kikits.com",
            name: process.env.SENDGRID_FROM_NAME || "Kikits",
          },
          subject: `Member Export - ${organization.name || "Organization"}`,
          text: `Please find attached the member export CSV file for ${organization.name || "your organization"}.\n\nTotal members: ${membersData.length}`,
          html: `<p>Please find attached the member export CSV file for <strong>${organization.name || "your organization"}</strong>.</p><p>Total members: <strong>${membersData.length}</strong></p>`,
          attachments: [
            {
              content: Buffer.from(csv).toString("base64"),
              filename: `members_export_${Date.now()}.csv`,
              type: "text/csv",
              disposition: "attachment",
            },
          ],
        };

        await sgMail.send(msg);

        console.log(
          `✅ Member export completed and emailed to ${recipientEmail}`
        );
      } catch (error) {
        console.error("Error processing member export:", error);

        // Try to send error notification email
        try {
          const { sgMail } = require("../../lib/sendGrid");
          await sgMail.send({
            to: recipientEmail,
            from: {
              email: process.env.SENDGRID_FROM_EMAIL || "no-reply@kikits.com",
              name: process.env.SENDGRID_FROM_NAME || "Kikits",
            },
            subject: "Member Export Failed",
            text: `The member export request failed with the following error: ${error.message}`,
            html: `<p>The member export request failed with the following error:</p><p><strong>${error.message}</strong></p>`,
          });
        } catch (emailError) {
          console.error("Failed to send error notification email:", emailError);
        }
      }
    })();
  } catch (error) {
    console.error("Error starting member export:", error);
    res.status(500).json({ message: error.message });
  }
};
