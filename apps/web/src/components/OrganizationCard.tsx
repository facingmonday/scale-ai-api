import type { Organization } from "@/types/organization";

interface OrganizationCardProps {
  organization: Organization;
  onClick: () => void | Promise<void>;
}

export default function OrganizationCard({
  organization,
  onClick,
}: OrganizationCardProps) {
  const imageUrl =
    organization.imageUrl || organization.defaultImage || organization.logo;

  return (
    <div
      key={organization._id}
      className="block border border-gray-600 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition relative"
    >
      <div className="relative w-full h-36">
        {imageUrl?.startsWith("http") ? (
          <img
            src={imageUrl}
            alt={organization.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-400">
            {organization.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-bold text-xl mb-1 truncate">{organization.name}</h3>
      </div>

      <div className="relative mx-4 mb-4 flex justify-center">
        <button onClick={onClick} className="btn-teal ">
          Join Organization
        </button>
      </div>
    </div>
  );
}
