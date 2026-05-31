import React from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import StoreTypesTable from "../Settings/ProfileTypes";

const ProfileTypes: React.FC = () => {
  return (
    <BasicLayout>
      <div className="page">
        <div className="container">
          <h1 className="heading-xl mb-6">Profile Types</h1>
          <StoreTypesTable showTitle={false} returnTo="/profile-types" />
        </div>
      </div>
    </BasicLayout>
  );
};

export default ProfileTypes;


