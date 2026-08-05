export function buildClassroomJoinUrl(
  orgId: string,
  classroomId: string,
  origin = window.location.origin,
): string {
  const url = new URL("/", origin);
  url.searchParams.set("orgId", orgId);
  url.searchParams.set("classroomId", classroomId);
  return url.toString();
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error("Copy failed");
    }
  }
}
