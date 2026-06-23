function stubClerkMembership(Member, { role = "org:member" } = {}) {
  const mockMembership = {
    id: "mem_test_123",
    role,
    publicUserData: { userId: "user_test_clerk" },
    organization: { id: "org_clerk_test" },
    createdAt: new Date().toISOString(),
  };

  const originalGetExisting = Member.getExistingClerkOrgMembership;
  const originalGetOrCreate = Member.getOrCreateClerkOrgMembership;
  const originalSync = Member.syncOrgMembership;

  Member.getExistingClerkOrgMembership = async () => null;
  Member.getOrCreateClerkOrgMembership = async () => mockMembership;
  Member.syncOrgMembership = async (member) => member;

  return () => {
    Member.getExistingClerkOrgMembership = originalGetExisting;
    Member.getOrCreateClerkOrgMembership = originalGetOrCreate;
    Member.syncOrgMembership = originalSync;
  };
}

module.exports = { stubClerkMembership };
