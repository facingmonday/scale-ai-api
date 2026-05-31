export interface ClassroomTemplate {
  _id: string;
  key?: string;
  label: string;
  description?: string;
  version?: number;
  isActive?: boolean;
  sourceTemplateId?: string | null;
}


