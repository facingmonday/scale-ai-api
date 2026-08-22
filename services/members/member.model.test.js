const test = require("node:test");
const assert = require("node:assert/strict");

const Member = require("./member.model");

test("member model exports clerk sync statics", () => {
  assert.equal(typeof Member.getExistingClerkOrgMembership, "function");
  assert.equal(typeof Member.getOrCreateClerkOrgMembership, "function");
  assert.equal(typeof Member.syncOrgMembership, "function");
  assert.equal(typeof Member.maskEmail, "function");
});

test("maskEmail masks local part", () => {
  assert.equal(Member.maskEmail("student@example.com"), "s****@example.com");
});

test("formatMemberResponse prefers canonical Clerk identity fields", async () => {
  const member = {
    _id: "member_123",
    clerkUserId: "user_123",
    firstName: "Stale",
    lastName: "Name",
    username: "local-user",
    imageUrl: "local-image",
    hasImage: false,
    maskedEmail: "s****@example.com",
    maskedPhone: "***-***-1234",
    toObject() {
      return {
        _id: this._id,
        clerkUserId: this.clerkUserId,
        firstName: this.firstName,
        lastName: this.lastName,
      };
    },
    async getProfileFromClerk() {
      return {
        id: "user_123",
        firstName: "Myles",
        lastName: "Williams",
        fullName: "Myles Williams",
        username: "myles",
        imageUrl: "https://images.example.com/myles.png",
        hasImage: true,
        email: "myles@example.com",
        emailAddresses: [
          {
            id: "email_123",
            emailAddress: "myles@example.com",
            verification: { status: "verified", strategy: "email_code" },
          },
        ],
        phone: "+15555550123",
        phoneNumbers: [],
        createdAt: 1,
        updatedAt: 2,
        lastSignInAt: 3,
        lastActiveAt: 4,
      };
    },
  };

  const response = await Member.formatMemberResponse(
    member,
    { role: "org:member" },
    true,
  );

  assert.equal(response.firstName, "Myles");
  assert.equal(response.lastName, "Williams");
  assert.equal(response.fullName, "Myles Williams");
  assert.equal(response.name, "Myles Williams");
  assert.equal(response.email, "myles@example.com");
  assert.equal(response.phone, "+15555550123");
  assert.equal(response.emailAddresses[0].emailAddress, "myles@example.com");
  assert.equal(response.clerkProfile.id, "user_123");
});
