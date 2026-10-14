import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ChallengeResultsReport } from "./challengeResultsReport";

export interface ReportFonts { regular: string; bold: string }

/** Render from explicit report fields, never from screen HTML or student records. */
export function createChallengeResultsPdf(report: ChallengeResultsReport, fonts: ReportFonts) {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait", putOnlyUsedFonts: true });
  doc.addFileToVFS("DejaVuSans.ttf", fonts.regular);
  doc.addFont("DejaVuSans.ttf", "Report", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fonts.bold);
  doc.addFont("DejaVuSans-Bold.ttf", "Report", "bold");
  doc.setProperties({ title: `${report.title} - Results`, author: "SCALE", subject: "Instructor class summary" });
  const margin = 44;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - 52;
  let y = margin;

  function ensureSpace(height: number) {
    if (y + height > bottom) { doc.addPage(); y = margin; }
  }
  function text(value: string, size = 10, bold = false, spaceAfter = 8) {
    doc.setFont("Report", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(30, 41, 59);
    const lines: string[] = doc.splitTextToSize(value, width);
    for (const line of lines) {
      ensureSpace(size * 1.45);
      doc.text(line, margin, y + size);
      y += size * 1.45;
    }
    y += spaceAfter;
  }
  function heading(value: string, followingSpace = 32) {
    doc.setFont("Report", "bold");
    doc.setFontSize(13);
    const lines: string[] = doc.splitTextToSize(value, width);
    ensureSpace(lines.length * 19 + 16 + followingSpace);
    y += 8;
    text(value, 13, true);
  }
  function table(head: string[], body: string[][]) {
    autoTable(doc, {
      startY: y, head: [head], body,
      margin: { top: margin, right: margin, bottom: 52, left: margin },
      theme: "grid", showHead: "everyPage", rowPageBreak: "avoid",
      styles: { font: "Report", fontSize: 9, cellPadding: 6,
        textColor: [30, 41, 59], lineColor: [213, 221, 229], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: { fontStyle: "bold", fillColor: [233, 240, 245], textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: data => { y = data.cursor?.y ?? margin; },
    });
    y += 12;
  }

  text("SCALE  /  INSTRUCTOR CLASS SUMMARY", 9, true, 14);
  text(report.title, 21, true);
  text(report.classroom, 12, true, 4);
  text(`Report generated ${report.generatedAt}`, 9, false, 16);
  if (report.description) { heading("Challenge"); text(report.description); }
  heading("Participation", 60);
  table(["Measure", "Students"], report.participation);
  heading("Challenge outcome");
  text(report.outcomeNotes);
  if (report.instructorNotes) {
    heading("Instructor notes (private)");
    text(report.instructorNotes);
  }
  if (report.outcomeVariables.length) {
    heading("Outcome variables", 60);
    table(["Variable", "Saved value"], report.outcomeVariables);
  }
  // Keep this section title together with the first profile heading and table row.
  doc.setFont("Report", "bold");
  doc.setFontSize(13);
  const firstProfile = report.profiles[0];
  const firstProfileHeadingHeight = firstProfile
    ? doc.splitTextToSize(`${firstProfile.label} (${firstProfile.count} profiles)`, width).length * 19 + 16
    : 0;
  heading("Profile type statistics", firstProfileHeadingHeight + 60);
  if (!report.profiles.length) text("No profile type statistics are available.");
  for (const profile of report.profiles) {
    heading(`${profile.label} (${profile.count} profiles)`, 60);
    if (profile.metrics.length) table(["Metric", "Total", "Average"], profile.metrics);
    else text("No active numeric metrics are configured.");
  }
  for (const section of report.debrief) {
    doc.setFont("Report", "normal");
    doc.setFontSize(10);
    const sectionHeight = section.paragraphs.reduce((height, paragraph) =>
      height + doc.splitTextToSize(paragraph, width).length * 14.5 + 8, 0);
    // Keep brief teaching summaries together; long narratives flow across pages.
    heading(section.title, sectionHeight <= 180 ? sectionHeight : 32);
    for (const paragraph of section.paragraphs) text(paragraph);
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("Report", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 102, 118);
    doc.setDrawColor(213, 221, 229);
    doc.line(margin, bottom + 13, margin + width, bottom + 13);
    doc.text("SCALE • Instructor reference", margin, bottom + 29);
    doc.text(`Page ${page} of ${pages}`, margin + width, bottom + 29, { align: "right" });
  }
  return doc;
}
