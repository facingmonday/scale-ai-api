/**
 * Component-specific types for UI display
 */

/**
 * Student display type for StudentList component
 */
export interface StudentDisplay {
  id: string;
  name: string;
  email: string;
  classroomId?: string;
  createdAt: string;
  [key: string]: any;
  lastName: string;
  firstName: string;
}

/**
 * Classroom display type for ClassroomList component
 */
export interface ClassroomDisplay {
  id: string;
  name: string;
  studentCount: number;
  createdAt: string;
  [key: string]: any;
}
