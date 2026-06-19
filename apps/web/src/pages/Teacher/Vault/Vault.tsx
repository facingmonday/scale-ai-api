import React from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import FileVault from "../../../components/FileVault";

const TeacherVault: React.FC = () => {
  return (
    <BasicLayout>
      <div className="page">
        <div className="container space-y-6">
          <FileVault role="admin" />
        </div>
      </div>
    </BasicLayout>
  );
};

export default TeacherVault;
