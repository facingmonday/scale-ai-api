import React, { useEffect, useState } from "react";
import BasicLayout from "../../../components/Layouts/BasicLayout";
import { useAuth } from "../../../context/AuthContext";
import aiService from "../../../services/ai";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import toast from "react-hot-toast";

interface Slide {
  slideTitle: string;
  bullets: string[];
  teachingTip: string;
}

interface ReportPayload {
  classSummary: string;
  commonMistakes: string[];
  slideOutline: Slide[];
}

interface ClassroomReport {
  _id: string;
  challengeTitle: string;
  challengeId: string | null;
  reportType: string;
  payload: ReportPayload;
  createdDate: string;
}

const Vault: React.FC = () => {
  const { activeClassroom } = useAuth();
  const [reports, setReports] = useState<ClassroomReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ClassroomReport | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const classroomId = activeClassroom?._id ?? null;

  useEffect(() => {
    if (!classroomId) return;

    const loadReports = async () => {
      setIsLoading(true);
      try {
        const data = await aiService.getClassroomReports(classroomId);
        if (data && Array.isArray(data.reports)) {
          setReports(data.reports);
        }
      } catch (err: any) {
        console.error("Failed to load reports:", err);
        toast.error("Failed to load classroom reports.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadReports();
  }, [classroomId]);

  const openReport = (report: ClassroomReport) => {
    setSelectedReport(report);
    setCurrentSlideIndex(0);
  };

  const handleNextSlide = () => {
    if (selectedReport && currentSlideIndex < selectedReport.payload.slideOutline.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  return (
    <BasicLayout>
      <div className="page max-w-6xl mx-auto w-full flex-grow">
        <div className="container space-y-6">
          {/* Header */}
          <div className="card p-6 flex items-center justify-between">
            <div>
              <h1 className="heading-md flex items-center gap-2">
                <i className="pi pi-folder-open text-brand-teal text-xl" /> File Vault
              </h1>
              <p className="text-text-muted text-xs mt-1">
                Access your classroom's round-by-round AI summaries, learning slides, and supply chain reports.
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-brand-teal/10 text-brand-teal">
                {reports.length} Reports Available
              </span>
            </div>
          </div>

          {/* Reports Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-text-muted">
              <i className="pi pi-spin pi-spinner text-2xl mb-2" />
              <p>Loading files...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="card text-center py-16 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-ui-muted flex items-center justify-center text-text-secondary mb-4">
                <i className="pi pi-search text-2xl" />
              </div>
              <h3 className="font-semibold text-text-primary text-lg">No reports found</h3>
              <p className="text-text-secondary text-sm max-w-sm mt-1">
                Reports will appear here once simulation rounds are closed and processed by our nightly prep agent.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((report) => (
                <Card
                  key={report._id}
                  title={report.challengeTitle}
                  subTitle={`Generated on ${new Date(report.createdDate).toLocaleDateString()}`}
                  className="hover:shadow-md transition-shadow border border-ui-border bg-ui-surface cursor-pointer hover:border-brand-teal/50"
                  onClick={() => openReport(report)}
                >
                  <p className="text-sm text-text-secondary line-clamp-3 mb-4">
                    {report.payload.classSummary}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-ui-border">
                    <span className="text-xs text-brand-teal font-medium flex items-center gap-1">
                      <i className="pi pi-images" /> {report.payload.slideOutline.length} Slides
                    </span>
                    <span className="text-xs text-text-muted">
                      Report ID: {report._id.slice(-6)}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Interactive Report View Dialog */}
          {selectedReport && (
            <Dialog
              visible={!!selectedReport}
              onHide={() => setSelectedReport(null)}
              header={`${selectedReport.challengeTitle} - Performance Report`}
              className="modal w-full max-w-5xl"
              maskClassName="modal-mask"
              headerClassName="modal-header"
              contentClassName="p-6"
              style={{ width: "95vw", maxWidth: "1000px" }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Side: Summary and Mistakes */}
                <div className="lg:col-span-5 space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-brand-teal tracking-wider mb-2">Round Summary</h3>
                    <p className="text-sm text-text-primary leading-relaxed bg-ui-surface p-4 border border-ui-border rounded-lg shadow-sm">
                      {selectedReport.payload.classSummary}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-brand-teal tracking-wider mb-2">Common Mistakes</h3>
                    <ul className="space-y-2 bg-ui-surface p-4 border border-ui-border rounded-lg shadow-sm">
                      {selectedReport.payload.commonMistakes.map((mistake, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-text-primary">
                          <span className="text-red-400 font-semibold">•</span>
                          <span>{mistake}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Side: Interactive Slides Player */}
                <div className="lg:col-span-7 flex flex-col">
                  <h3 className="text-sm font-semibold uppercase text-brand-teal tracking-wider mb-2 flex items-center justify-between">
                    <span>Lesson Slides</span>
                    <span className="text-xs text-text-muted lowercase">
                      Slide {currentSlideIndex + 1} of {selectedReport.payload.slideOutline.length}
                    </span>
                  </h3>

                  {/* Slide Container */}
                  <div className="flex-grow bg-slate-900 text-slate-100 rounded-xl p-6 shadow-lg border border-slate-800 min-h-[320px] flex flex-col justify-between">
                    <div>
                      {/* Slide Title */}
                      <h4 className="text-xl font-bold text-brand-teal mb-4 pb-2 border-b border-slate-800">
                        {selectedReport.payload.slideOutline[currentSlideIndex].slideTitle}
                      </h4>
                      {/* Bullet points */}
                      <ul className="space-y-3 mb-6">
                        {selectedReport.payload.slideOutline[currentSlideIndex].bullets.map((bullet, idx) => (
                          <li key={idx} className="flex gap-2 text-sm">
                            <span className="text-brand-teal font-semibold">✔</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Instructor Tip / Coaching Box */}
                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-lg">
                      <span className="text-xs uppercase font-bold text-brand-orange tracking-wider flex items-center gap-1 mb-1">
                        <i className="pi pi-lightbulb" /> Lesson Insight
                      </span>
                      <p className="text-xs text-slate-300 italic">
                        {selectedReport.payload.slideOutline[currentSlideIndex].teachingTip}
                      </p>
                    </div>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex items-center justify-between mt-4">
                    <Button
                      label="Previous"
                      icon="pi pi-chevron-left"
                      onClick={handlePrevSlide}
                      disabled={currentSlideIndex === 0}
                      className="px-4 py-2 text-sm bg-ui-surface border-ui-border text-text-primary rounded-lg"
                    />
                    <Button
                      label="Next"
                      icon="pi pi-chevron-right"
                      iconPos="right"
                      onClick={handleNextSlide}
                      disabled={currentSlideIndex === selectedReport.payload.slideOutline.length - 1}
                      className="px-4 py-2 text-sm bg-brand-teal text-brand-dark font-semibold rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </Dialog>
          )}
        </div>
      </div>
    </BasicLayout>
  );
};

export default Vault;
