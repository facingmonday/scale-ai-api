/**
 * Members Service Routes
 * 
 * Provides endpoints for managing organization members (users).
 * All routes require org:admin role.
 * Mounted at: /v1/members
 */
const express = require("express");
const membersController = require("./members.controller");
const { requireAuth, checkRole } = require("../../middleware/auth");

const router = express.Router();

router.use(requireAuth());
router.use(checkRole("org:admin"));

// Member management routes

/**
 * @openapi
 * /v1/members:
 *   post:
 *     summary: Create a new member
 *     description: Creates a new user/member within the active organization. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *     responses:
 *       201:
 *         description: Member created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 *       400:
 *         description: Bad Request.
 *   get:
 *     summary: Get all organization members
 *     description: Returns a list of all members within the active organization. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of members.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Member'
 */
router.post("/", membersController.createMember);
router.get("/", membersController.getAllMembers);

/**
 * @openapi
 * /v1/members/search:
 *   get:
 *     summary: Search members
 *     description: Search organization members by name or email. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Member'
 */
router.get("/search", membersController.searchMembers);

/**
 * @openapi
 * /v1/members/stats:
 *   get:
 *     summary: Get member statistics
 *     description: Get statistics regarding active members in the organization. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics object.
 */
router.get("/stats", membersController.getMemberStats);

/**
 * @openapi
 * /v1/members/{id}/organization-membership:
 *   put:
 *     summary: Update organization membership role
 *     description: Change a member's organization role (e.g. admin vs member). Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *     responses:
 *       200:
 *         description: Membership role updated.
 */
router.put(
  "/:id/organization-membership",
  membersController.updateOrganizationMembership
);

/**
 * @openapi
 * /v1/members/{id}:
 *   get:
 *     summary: Get member by ID
 *     description: Retrieve detailed information for a specific member by their Mongoose ID. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member profile.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 *       404:
 *         description: Member not found.
 *   put:
 *     summary: Update member profile
 *     description: Update profile fields for a member. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Member updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Member'
 *   delete:
 *     summary: Remove member
 *     description: Remove a member from the organization. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed.
 */
router.get("/:id", membersController.getMemberById);
router.put("/:id", membersController.updateMember);
router.delete("/:id", membersController.removeMember);

/**
 * @openapi
 * /v1/members/add-existing:
 *   post:
 *     summary: Add an existing Clerk user
 *     description: Add a user who already has a Clerk account to the organization. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *     responses:
 *       200:
 *         description: User added successfully.
 */
router.post("/add-existing", membersController.addExistingUser);

/**
 * @openapi
 * /v1/members/export:
 *   post:
 *     summary: Export members as CSV
 *     description: Generates and triggers a file export of the active members list in CSV format. Requires org:admin role.
 *     tags:
 *       - Members
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: File download trigger.
 */
router.post("/export", membersController.exportMembers);

module.exports = router;
