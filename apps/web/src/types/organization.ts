/**
 * Organization model
 */
export interface Organization {
  id: string; // Clerk organization ID
  _id: string; // MongoDB ObjectId
  clerkOrganizationId: string; // Unique Clerk organization ID
  name: string;
  slug: string; // Unique slug
  imageUrl?: string;

  // Organization settings
  maxAllowedMemberships: number; // Default: 1000
  adminDeleteEnabled: boolean; // Default: true

  // Stripe integration
  stripeAccountId?: string;

  // Metadata
  publicMetadata: Record<string, any>;
  privateMetadata: Record<string, any>;

  // Clerk timestamps
  clerkCreatedAt?: Date;
  clerkUpdatedAt?: Date;

  // Default image
  defaultImage?: string;
  logo?: string;

  // MongoDB timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization with virtual/computed fields
 */
export interface OrganizationWithVirtuals extends Organization {
  memberCount?: number; // Virtual: count of members
}

/**
 * Legacy organization interface for backward compatibility
 * @deprecated Use Organization instead
 */
export interface IOrganization {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
  metadata: {
    public: {};
    private: {
      stripeAccountId: string;
      features?: {
        [key: string]: boolean | undefined;
      };
    };
  };
}

/**
 * Legacy organization API response
 * @deprecated Use ApiSuccessResponse<Organization> instead
 */
export interface IOrganizationApiResponse {
  data: IOrganization;
}
