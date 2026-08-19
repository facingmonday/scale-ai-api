type StoreStudentIdSource = {
  studentId?: string;
};

export function getInitialStoreStudentId(
  profile: StoreStudentIdSource | null,
  memberStudentId?: string,
): string {
  return profile ? profile.studentId ?? "" : memberStudentId ?? "";
}
