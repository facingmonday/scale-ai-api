#!/usr/bin/env node
/**
 * Sync Clerk -> MongoDB (Members + Organizations + Org Memberships)
 *
 * Purpose:
 * - If you reset your local DB, this script repopulates the core identity tables
 *   from Clerk so you can keep testing with the same users/orgs.
 *
 * What it does:
 * - Upserts Clerk Organizations -> `Organization`
 * - Upserts Clerk Users -> `Member`
 * - Rebuilds `Member.organizationMemberships` from Clerk organization memberships
 *
 * Safety:
 * - Default is non-destructive (upsert/overwrite these identity fields only)
 * - Use --dry-run to preview counts with zero DB writes
 *
 * Usage:
 *   node scripts/sync-clerk.js
 *   node scripts/sync-clerk.js --dry-run
 *   node scripts/sync-clerk.js --only-org=org_123
 *
 * Requirements:
 * - CLERK_SECRET_KEY set (and any other Clerk env you use)
 * - Mongo env set (same as apps/api + scripts/seed-demo):
 *   - MONGO_URL or MONGO_URI
 *   - OR MONGO_SCHEME/MONGO_USERNAME/MONGO_PASSWORD/MONGO_HOSTNAME/MONGO_DB
 */
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();

const { clerkClient } = require("@clerk/express");
const Member = require("../services/members/member.model");
const Organization = require("../services/organizations/organization.model");

function parseArgs(argv) {
  const args = {
    dryRun: false,
    onlyOrg: null, // Clerk org id (org_*)
    help: false,
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") args.dryRun = true;
    else if (raw.startsWith("--only-org=")) args.onlyOrg = raw.split("=").slice(1).join("=");
    else if (raw === "--help" || raw === "-h") args.help = true;
  }

  return args;
}

function getMongoUrlFromEnv() {
  const direct = process.env.MONGO_URL || process.env.MONGO_URI;
  if (direct) return direct;

  const {
    MONGO_SCHEME,
    MONGO_USERNAME,
    MONGO_PASSWORD,
    MONGO_HOSTNAME,
    MONGO_DB,
  } = process.env;

  if (!MONGO_SCHEME || !MONGO_USERNAME || !MONGO_PASSWORD || !MONGO_HOSTNAME || !MONGO_DB) {
    return null;
  }

  return `${MONGO_SCHEME}://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}/${MONGO_DB}?authSource=admin`;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  // Clerk sometimes returns ISO strings in certain contexts
  return new Date(value);
}

function unwrapListResponse(resp) {
  // Clerk SDK responses are typically { data, totalCount, ... }
  if (!resp) return { data: [], totalCount: null };
  if (Array.isArray(resp)) return { data: resp, totalCount: resp.length };
  if (Array.isArray(resp.data)) return { data: resp.data, totalCount: resp.totalCount ?? null };
  // last-resort
  return { data: [], totalCount: resp.totalCount ?? null };
}

async function listAllPages({ fetchPage, pageSize, label }) {
  const all = [];
  let offset = 0;

  while (true) {
    const resp = await fetchPage({ limit: pageSize, offset });
    const { data, totalCount } = unwrapListResponse(resp);

    if (!data.length) break;
    all.push(...data);
    offset += data.length;

    if (typeof totalCount === "number" && all.length >= totalCount) break;
  }

  return all;
}

function buildOrgUpsertDoc(clerkOrg) {
  return {
    clerkOrganizationId: clerkOrg.id,
    name: clerkOrg.name,
    slug: clerkOrg.slug,
    imageUrl: clerkOrg.imageUrl,
    maxAllowedMemberships: clerkOrg.maxAllowedMemberships,
    adminDeleteEnabled: clerkOrg.adminDeleteEnabled,
    publicMetadata: clerkOrg.publicMetadata || {},
    privateMetadata: clerkOrg.privateMetadata || {},
    clerkCreatedAt: toDate(clerkOrg.createdAt),
    clerkUpdatedAt: toDate(clerkOrg.updatedAt),
  };
}

function buildMemberUpsertDocFromUser(clerkUser) {
  const primaryEmail = clerkUser.emailAddresses?.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  );
  const primaryPhone = clerkUser.phoneNumbers?.find(
    (p) => p.id === clerkUser.primaryPhoneNumberId
  );

  const email = primaryEmail?.emailAddress || "";
  const phone = primaryPhone?.phoneNumber || "";

  return {
    clerkUserId: clerkUser.id,
    firstName: clerkUser.firstName || "",
    lastName: clerkUser.lastName || "",
    username: clerkUser.username || "",
    imageUrl: clerkUser.imageUrl || "",
    hasImage: !!clerkUser.hasImage,

    primaryEmailAddressId: clerkUser.primaryEmailAddressId || null,
    primaryPhoneNumberId: clerkUser.primaryPhoneNumberId || null,
    primaryWeb3WalletId: clerkUser.primaryWeb3WalletId || null,

    emailAddresses:
      clerkUser.emailAddresses?.map((e) => ({
        id: e.id,
        verification: e.verification,
      })) || [],
    phoneNumbers:
      clerkUser.phoneNumbers?.map((p) => ({
        id: p.id,
        verification: p.verification,
      })) || [],
    web3Wallets:
      clerkUser.web3Wallets?.map((w) => ({
        id: w.id,
        web3Wallet: w.web3Wallet,
        verification: w.verification,
      })) || [],
    externalAccounts:
      clerkUser.externalAccounts?.map((a) => ({
        id: a.id,
        provider: a.provider,
        providerUserId: a.providerUserId,
        verification: a.verification,
      })) || [],

    publicMetadata: clerkUser.publicMetadata || {},
    privateMetadata: clerkUser.privateMetadata || {},
    unsafeMetadata: clerkUser.unsafeMetadata || {},

    passwordEnabled: !!clerkUser.passwordEnabled,
    twoFactorEnabled: !!clerkUser.twoFactorEnabled,
    totpEnabled: !!clerkUser.totpEnabled,
    backupCodeEnabled: !!clerkUser.backupCodeEnabled,
    createOrganizationEnabled: !!clerkUser.createOrganizationEnabled,
    createOrganizationsLimit: clerkUser.createOrganizationsLimit ?? null,
    deleteSelfEnabled: clerkUser.deleteSelfEnabled !== false,

    hasVerifiedEmailAddress: !!clerkUser.hasVerifiedEmailAddress,
    hasVerifiedPhoneNumber: !!clerkUser.hasVerifiedPhoneNumber,

    createdAt: toDate(clerkUser.createdAt) || new Date(),
    updatedAt: toDate(clerkUser.updatedAt) || null,
    lastSignInAt: toDate(clerkUser.lastSignInAt) || null,
    legalAcceptedAt: toDate(clerkUser.legalAcceptedAt) || null,

    externalId: clerkUser.externalId || null,

    // Store only masked contact info in Mongo (full values remain in Clerk)
    maskedEmail: email ? Member.maskEmail(email) : "",
    maskedPhone: phone ? Member.maskPhone(phone) : "",
  };
}

function buildMinimalMemberOnInsert(clerkUserId) {
  // Used when a membership references a user we didn't pull for some reason.
  // Keep schema-required fields satisfied.
  return {
    clerkUserId,
    firstName: "",
    lastName: "",
    username: "",
    imageUrl: "",
    hasImage: false,
    emailAddresses: [],
    phoneNumbers: [],
    web3Wallets: [],
    externalAccounts: [],
    publicMetadata: {},
    privateMetadata: {},
    unsafeMetadata: {},
    passwordEnabled: false,
    twoFactorEnabled: false,
    totpEnabled: false,
    backupCodeEnabled: false,
    createOrganizationEnabled: false,
    createOrganizationsLimit: 0,
    deleteSelfEnabled: true,
    hasVerifiedEmailAddress: false,
    hasVerifiedPhoneNumber: false,
    createdAt: new Date(),
    // IMPORTANT: do NOT set updatedAt here.
    // Mongoose timestamps will auto-$set updatedAt on update operations, which conflicts
    // with $setOnInsert.updatedAt and causes:
    // "Updating the path 'updatedAt' would create a conflict at 'updatedAt'"
    maskedEmail: "",
    maskedPhone: "",
    // IMPORTANT: do NOT set organizationMemberships here.
    // The membership bulkWrite upsert uses:
    //   $set: { organizationMemberships: memberships }
    // and setting the same path in $setOnInsert causes MongoDB conflict errors:
    // "Updating the path 'organizationMemberships' would create a conflict..."
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(`
Sync Clerk -> Mongo

Options:
  --dry-run             connect + read from Clerk, but do not write to Mongo
  --only-org=<org_id>   only sync memberships for this Clerk org (still syncs org doc)
  -h, --help            show help
`);
    process.exit(0);
  }

  if (!process.env.CLERK_SECRET_KEY) {
    console.error("Missing CLERK_SECRET_KEY in env. Cannot sync from Clerk.");
    process.exit(1);
  }

  const mongoUrl = getMongoUrlFromEnv();
  if (!mongoUrl) {
    console.error(
      "Missing Mongo configuration. Set MONGO_URL/MONGO_URI or MONGO_SCHEME/MONGO_USERNAME/MONGO_PASSWORD/MONGO_HOSTNAME/MONGO_DB."
    );
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log("✅ Connected to MongoDB");

  try {
    // 1) Organizations
    const clerkOrgs = await listAllPages({
      label: "organizations",
      pageSize: 100,
      fetchPage: ({ limit, offset }) =>
        clerkClient.organizations.getOrganizationList({ limit, offset }),
    });

    const filteredOrgs = args.onlyOrg
      ? clerkOrgs.filter((o) => o.id === args.onlyOrg)
      : clerkOrgs;

    if (args.onlyOrg && filteredOrgs.length === 0) {
      console.warn(`⚠️  No Clerk org found for --only-org=${args.onlyOrg}`);
    }

    console.log(`Found ${filteredOrgs.length} organization(s) in Clerk`);

    const orgBulk = filteredOrgs.map((org) => ({
      updateOne: {
        filter: { clerkOrganizationId: org.id },
        update: { $set: buildOrgUpsertDoc(org) },
        upsert: true,
      },
    }));

    if (!args.dryRun && orgBulk.length) {
      await Organization.bulkWrite(orgBulk, { ordered: false });
      console.log(`✅ Upserted ${orgBulk.length} organization(s)`);
    } else if (args.dryRun) {
      console.log(`(dry-run) Would upsert ${orgBulk.length} organization(s)`);
    }

    const orgDocs = await Organization.find({
      clerkOrganizationId: { $in: filteredOrgs.map((o) => o.id) },
    }).select("_id clerkOrganizationId name slug imageUrl");

    const orgByClerkId = new Map(orgDocs.map((d) => [d.clerkOrganizationId, d]));

    // 2) Users -> Members
    const clerkUsers = await listAllPages({
      label: "users",
      pageSize: 100,
      fetchPage: ({ limit, offset }) => clerkClient.users.getUserList({ limit, offset }),
    });

    console.log(`Found ${clerkUsers.length} user(s) in Clerk`);

    const userBulk = clerkUsers.map((u) => ({
      updateOne: {
        filter: { clerkUserId: u.id },
        update: { $set: buildMemberUpsertDocFromUser(u) },
        upsert: true,
      },
    }));

    if (!args.dryRun && userBulk.length) {
      await Member.bulkWrite(userBulk, { ordered: false });
      console.log(`✅ Upserted ${userBulk.length} member(s)`);
    } else if (args.dryRun) {
      console.log(`(dry-run) Would upsert ${userBulk.length} member(s)`);
    }

    // 3) Memberships -> Member.organizationMemberships (rebuilt from Clerk)
    const membershipsByUserId = new Map(); // clerkUserId -> membership[]
    let totalMemberships = 0;

    for (const clerkOrg of filteredOrgs) {
      const orgDoc = orgByClerkId.get(clerkOrg.id);
      if (!orgDoc) {
        console.warn(`⚠️  Org not found in DB after upsert: ${clerkOrg.id}`);
        continue;
      }

      const clerkMemberships = await listAllPages({
        label: `memberships:${clerkOrg.id}`,
        pageSize: 200,
        fetchPage: ({ limit, offset }) =>
          clerkClient.organizations.getOrganizationMembershipList({
            organizationId: clerkOrg.id,
            limit,
            offset,
          }),
      });

      totalMemberships += clerkMemberships.length;

      for (const m of clerkMemberships) {
        const clerkUserId = m.publicUserData?.userId || m.userId;
        if (!clerkUserId) continue;

        const membershipDoc = {
          id: m.id,
          organizationId: orgDoc._id,
          role: m.role,
          publicMetadata: m.publicMetadata || {},
          organization: {
            id: clerkOrg.id,
            name: orgDoc.name,
            slug: orgDoc.slug,
            imageUrl: orgDoc.imageUrl,
          },
          createdAt: toDate(m.createdAt) || new Date(),
          ...(m.updatedAt ? { updatedAt: toDate(m.updatedAt) } : {}),
        };

        if (!membershipsByUserId.has(clerkUserId)) {
          membershipsByUserId.set(clerkUserId, []);
        }
        membershipsByUserId.get(clerkUserId).push(membershipDoc);
      }
    }

    console.log(
      `Found ${totalMemberships} organization membership(s) across ${filteredOrgs.length} org(s)`
    );

    const membershipBulk = Array.from(membershipsByUserId.entries()).map(
      ([clerkUserId, memberships]) => ({
        updateOne: {
          filter: { clerkUserId },
          update: {
            $set: { organizationMemberships: memberships },
            $setOnInsert: buildMinimalMemberOnInsert(clerkUserId),
          },
          upsert: true,
        },
      })
    );

    if (!args.dryRun && membershipBulk.length) {
      await Member.bulkWrite(membershipBulk, { ordered: false });
      console.log(
        `✅ Updated organizationMemberships for ${membershipBulk.length} member(s)`
      );
    } else if (args.dryRun) {
      console.log(
        `(dry-run) Would update organizationMemberships for ${membershipBulk.length} member(s)`
      );
    }

    console.log("🎉 Clerk sync complete");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Sync failed:", err?.message || err);
  process.exit(1);
});


