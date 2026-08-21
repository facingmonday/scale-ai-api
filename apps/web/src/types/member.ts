/**
 * EmailAddress model
 */
export interface EmailAddress {
  id: string;
  emailAddress?: string;
  verification: {
    status: string;
    strategy: string;
  };
}

/**
 * PhoneNumber model
 */
export interface PhoneNumber {
  id: string;
  phoneNumber?: string;
  verification: {
    status: string;
    strategy: string;
  };
}

/**
 * Web3Wallet model
 */
export interface Web3Wallet {
  id: string;
  web3Wallet: string;
  verification: {
    status: string;
    strategy: string;
  };
}

/**
 * ExternalAccount model
 */
export interface ExternalAccount {
  id: string;
  provider: string;
  providerUserId: string;
  verification: {
    status: string;
    strategy: string;
  };
}

/**
 * OrganizationMembership model
 */
export interface OrganizationMembership {
  id: string; // Clerk membership ID
  organizationId: string; // Organization ObjectId reference
  role: string; // e.g., "org:admin", "org:member"
  publicMetadata: Record<string, any>;
  organization: {
    id: string; // Clerk organization ID
    name: string;
    slug: string;
    imageUrl?: string;
  };
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * MemberPreferences model
 */
export interface MemberPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
  transactional: boolean;
}

/**
 * Canonical identity fields fetched from Clerk for an admin member-detail view.
 */
export interface ClerkMemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  imageUrl: string;
  hasImage: boolean;
  email: string;
  emailAddresses: EmailAddress[];
  phone: string;
  phoneNumbers: PhoneNumber[];
  createdAt: string | number | null;
  updatedAt: string | number | null;
  lastSignInAt: string | number | null;
  lastActiveAt: string | number | null;
}

/**
 * Member model
 */
export interface Member {
  _id: string; // MongoDB ObjectId
  clerkUserId: string; // Unique Clerk user ID
  firstName: string;
  lastName: string;
  username?: string;
  imageUrl?: string;
  hasImage: boolean;

  // Primary identifiers
  primaryEmailAddressId?: string;
  primaryPhoneNumberId?: string;
  primaryWeb3WalletId?: string;

  // Contact arrays
  emailAddresses: EmailAddress[];
  phoneNumbers: PhoneNumber[];
  web3Wallets: Web3Wallet[];
  externalAccounts: ExternalAccount[];

  // Metadata
  publicMetadata: Record<string, any>;
  privateMetadata: Record<string, any>;
  unsafeMetadata: Record<string, any>;

  // Capabilities
  passwordEnabled: boolean;
  twoFactorEnabled: boolean;
  totpEnabled: boolean;
  backupCodeEnabled: boolean;
  createOrganizationEnabled: boolean;
  createOrganizationsLimit?: number;
  deleteSelfEnabled: boolean;

  // Verification status
  hasVerifiedEmailAddress: boolean;
  hasVerifiedPhoneNumber: boolean;

  // Organization memberships
  organizationMemberships: OrganizationMembership[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt?: Date;
  legalAcceptedAt?: Date;

  // Devices (references)
  devices: string[]; // Array of Device ObjectIds

  // Preferences
  preferences: MemberPreferences;

  // External ID
  externalId?: string;

  // Masked contact info (populated from Clerk)
  maskedEmail?: string;
  maskedPhone?: string;
}

/**
 * Member with virtual/computed fields
 */
export interface MemberWithVirtuals extends Member {
  studentId?: string;
  clerkProfile?: ClerkMemberProfile | null;
  fullName: string; // Virtual: computed from firstName + lastName
  name: string; // Virtual: fullName || username || clerkUserId
  primaryEmailAddress?: EmailAddress; // Virtual
  primaryPhoneNumber?: PhoneNumber; // Virtual
  primaryWeb3Wallet?: Web3Wallet; // Virtual
  email: string; // Virtual: empty string (use getEmailFromClerk() method)
  phone: string; // Virtual: empty string (use getPhoneFromClerk() method)
}

/**
 * Formatted member for checkout/API responses
 */
export interface FormattedMember {
  id: string; // Clerk user ID
  _id: string; // MongoDB ObjectId
  userId: string; // Clerk user ID
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  maskedEmail: string;
  maskedPhone: string;
  imageUrl?: string;
  role: string;
  isActive: boolean;
  subscribed: boolean;
  membershipType: string;
  tags: string[];
  joinedDate: Date;
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt?: Date;
}
