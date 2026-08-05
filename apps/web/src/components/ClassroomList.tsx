import React from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import type { ClassroomDisplay } from "../types/components";

interface ClassroomListProps {
  classrooms?: ClassroomDisplay[];
  onClassroomClick?: (classroom: ClassroomDisplay) => void;
  onEdit?: (classroom: ClassroomDisplay) => void;
  onDelete?: (classroom: ClassroomDisplay) => void;
}

const ClassroomList: React.FC<ClassroomListProps> = ({
  classrooms = [],
  onClassroomClick,
  onEdit,
  onDelete,
}) => {
  const actionBodyTemplate = (rowData: ClassroomDisplay) => {
    return (
      <div className="flex gap-2">
        {onEdit && (
          <Button
            icon="pi pi-pencil"
            className="p-button-rounded p-button-text"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(rowData);
            }}
          />
        )}
        {onDelete && (
          <Button
            icon="pi pi-trash"
            className="p-button-rounded p-button-text p-button-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(rowData);
            }}
          />
        )}
      </div>
    );
  };

  return (
    <DataTable
      value={classrooms}
      onRowClick={(e) => onClassroomClick?.(e.data as ClassroomDisplay)}
      selectionMode="single"
      dataKey="id"
      emptyMessage="No classrooms found"
    >
      <Column field="name" header="Name" />
      <Column field="studentCount" header="Students" />
      <Column field="createdAt" header="Created" />
      {(onEdit || onDelete) && (
        <Column body={actionBodyTemplate} header="Actions" />
      )}
    </DataTable>
  );
};

export default ClassroomList;
