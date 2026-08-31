import { useState, useEffect, useRef } from "react";
import {
  Play,
  Mail,
  Cpu,
  Terminal as TerminalIcon,
  Eye,
  Code,
  FileText,
  CheckCircle,
  AlertTriangle,
  Moon,
  Sun,
} from "lucide-react";

interface Admin {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  maskedEmail: string;
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
}

interface Classroom {
  _id: string;
  name: string;
  description: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulation" | "emails">("simulation");
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Simulation settings
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");

  const [classroomMode, setClassroomMode] = useState<"existing" | "create">("create");
  const [newClassroomName, setNewClassroomName] = useState<string>("");
  const [studentCount, setStudentCount] = useState<number>(10);
  const [scenarioMode, setScenarioMode] = useState<"manual" | "ai">("manual");
  const [submissionMode, setSubmissionMode] = useState<"ai" | "defaults">("defaults");
  const [missingSubmissionsMode, setMissingSubmissionsMode] = useState<string>("null");
  const [simulationMode, setSimulationMode] = useState<"direct" | "batch">("direct");

  // Manual scenario inputs
  const [scenarioTitle, setScenarioTitle] = useState<string>("Week 1: Demand Shock & Supply Constraints");
  const [scenarioDescription, setScenarioDescription] = useState<string>("A sudden demand spike hits our regional campuses. Optimize your pricing, staff schedules, and inventory ordering to maximize profits.");
  const [outcomeNotes, setOutcomeNotes] = useState<string>("The week concluded. High inventory holding costs penalize over-ordering, while stockouts cost sales.");
  const [randomEventChance, setRandomEventChance] = useState<number>(0);

  // Simulation logs
  const [logs, setLogs] = useState<{ text: string; status: string }[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCleaningUp, setIsCleaningUp] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<any>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Email Preview settings
  const [templates, setTemplates] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("challenge-created");
  const [fixtureJson, setFixtureJson] = useState<string>(
    JSON.stringify(
      {
        challenge: {
          _id: "challenge_week3_2025",
          week: 3,
          title: "Back to School Rush",
          description: "Students return to campus, bringing increased demand and new challenges. Plan your inventory and staffing carefully to handle the surge in orders.",
          classroomId: "class_supply_chain_101_fall"
        },
        classroom: {
          _id: "class_supply_chain_101_fall",
          name: "Supply Chain 101 – Fall",
          description: "Intro to supply chain concepts using simulation"
        },
        member: {
          firstName: "Alex",
          lastName: "Martinez",
          name: "Alex Martinez",
          email: "alex.martinez@example.com",
          clerkUserId: "user_2abc123"
        },
        organization: {
          _id: "org_123",
          name: "Business School",
          email: "admin@businessschool.edu"
        },
        link: "https://scalelxp.com/class/class_supply_chain_101_fall/challenge/challenge_week3_2025",
        env: {
          SCALE_ADMIN_HOST: "https://localhost:5173",
          SCALE_API_HOST: "https://api.scalelxp.com"
        }
      },
      null,
      2
    )
  );
  const [emailFormats, setEmailFormats] = useState<{ html: string; text: string }>({ html: "", text: "" });
  const [emailTab, setEmailTab] = useState<"html" | "text" | "raw">("html");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetch("/api/admins")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setAdmins(data);
          if (data.length > 0) {
            setSelectedAdminId(data[0]._id);
          }
        } else {
          console.error("Admins fetch did not return an array:", data);
          setAdmins([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching admins:", err);
        setAdmins([]);
      });

    fetch("/api/emails/templates")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data);
          if (data.length > 0) {
            setSelectedTemplate(data[0]);
          }
        } else {
          console.error("Templates fetch did not return an array:", data);
          setTemplates([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching email templates:", err);
        setTemplates([]);
      });
  }, []);

  // Fetch organizations when admin changes
  useEffect(() => {
    if (!selectedAdminId) {
      setOrganizations([]);
      setSelectedOrgId("");
      return;
    }
    fetch(`/api/organizations?adminId=${selectedAdminId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setOrganizations(data);
          if (data.length > 0) {
            setSelectedOrgId(data[0]._id);
          } else {
            setSelectedOrgId("");
          }
        } else {
          console.error("Organizations fetch did not return an array:", data);
          setOrganizations([]);
          setSelectedOrgId("");
        }
      })
      .catch((err) => {
        console.error("Error fetching organizations:", err);
        setOrganizations([]);
        setSelectedOrgId("");
      });
  }, [selectedAdminId]);

  // Fetch classrooms when organization changes
  useEffect(() => {
    if (!selectedOrgId) {
      setClassrooms([]);
      setSelectedClassroomId("");
      return;
    }
    fetch(`/api/classrooms?orgId=${selectedOrgId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setClassrooms(data);
          if (data.length > 0) {
            setSelectedClassroomId(data[0]._id);
            setClassroomMode("existing");
          } else {
            setSelectedClassroomId("");
            setClassroomMode("create");
          }
        } else {
          console.error("Classrooms fetch did not return an array:", data);
          setClassrooms([]);
          setSelectedClassroomId("");
        }
      })
      .catch((err) => {
        console.error("Error fetching classrooms:", err);
        setClassrooms([]);
        setSelectedClassroomId("");
      });
  }, [selectedOrgId]);

  // Fetch email template fixture
  useEffect(() => {
    if (!selectedTemplate) return;
    fetch(`/api/emails/fixture/${selectedTemplate}`)
      .then((res) => res.json())
      .then((data) => {
        setFixtureJson(JSON.stringify(data, null, 2));
      })
      .catch((err) => console.error("Error fetching fixture:", err));
  }, [selectedTemplate]);

  // Render email preview when template or fixture json changes
  useEffect(() => {
    if (!selectedTemplate || !fixtureJson) return;
    try {
      const parsedProps = JSON.parse(fixtureJson);
      setJsonError(null);

      fetch(`/api/emails/render/${selectedTemplate}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedProps),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setJsonError(data.error);
          } else {
            setEmailFormats({ html: data.html || "", text: data.text || "" });
          }
        })
        .catch((err) => setJsonError(err.message));
    } catch (e: any) {
      setJsonError(`JSON Syntax Error: ${e.message}`);
    }
  }, [selectedTemplate, fixtureJson]);

  // Toggle Dark Mode
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  // Auto-scroll logs terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Run simulation round via Server-Sent Events (SSE)
  const handleRunSimulation = async () => {
    if (isRunning) return;
    const classroomLabel =
      classroomMode === "create"
        ? newClassroomName || "a new simulation classroom"
        : classrooms.find((classroom) => classroom._id === selectedClassroomId)?.name ||
          "the selected simulation classroom";
    if (
      !window.confirm(
        `Create a challenge and submit simulation jobs for ${studentCount} simulated students in ${classroomLabel}?`,
      )
    ) {
      return;
    }
    setIsRunning(true);
    setLogs([]);
    setRunResult(null);

    const payload = {
      adminId: selectedAdminId,
      orgId: selectedOrgId,
      classroomId: selectedClassroomId,
      classroomMode,
      classroomName: newClassroomName,
      studentCount: String(studentCount),
      scenarioMode,
      scenarioTitle,
      scenarioDescription,
      outcomeNotes,
      randomEventChance: String(randomEventChance),
      submissionMode,
      missingSubmissionsMode,
      simulationMode,
    };

    try {
      const response = await fetch("/api/simulation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Simulation request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6));
          if (data.log) {
            setLogs((prev) => [
              ...prev,
              { text: data.log, status: data.status || "running" },
            ]);
          }
          if (data.done) {
            setRunResult({
              classroomId: data.classroomId,
              challengeId: data.challengeId,
              jobCount: data.jobCount,
              status: data.status,
            });
          }
        }
        if (done) break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLogs((prev) => [
        ...prev,
        { text: `❌ Simulation request failed: ${message}`, status: "failed" },
      ]);
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCleanupSimulation = async () => {
    if (!runResult || isCleaningUp) return;
    if (
      !window.confirm(
        "Permanently delete this simulation classroom, its challenges, jobs, results, profiles, enrollments, and orphaned simulated users?",
      )
    ) {
      return;
    }

    setIsCleaningUp(true);
    try {
      const response = await fetch("/api/simulation/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: selectedAdminId,
          orgId: selectedOrgId,
          classroomId: runResult.classroomId,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Cleanup failed");
      setLogs((prev) => [
        ...prev,
        {
          text: `🧹 Simulation data removed (${body.simulationMembersDeleted || 0} simulated users deleted).`,
          status: "completed",
        },
      ]);
      setRunResult(null);
      setSelectedClassroomId("");
      setClassroomMode("create");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLogs((prev) => [
        ...prev,
        { text: `❌ Cleanup failed: ${message}`, status: "failed" },
      ]);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const navItems = [
    { key: "simulation" as const, label: "Simulation Runner", icon: Cpu },
    { key: "emails" as const, label: "Email Previews", icon: Mail },
  ];

  return (
    <div className="flex min-h-screen">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="admin-sidebar">
        {/* Brand */}
        <div className="admin-sidebar-brand">
          <div>
            <div className="admin-sidebar-brand-title">SCALE</div>
            <div className="admin-sidebar-brand-subtitle">Admin Console</div>
          </div>
        </div>

        <div className="px-5 mb-2">
          <span className="badge badge-warning text-[10px] font-semibold uppercase">Local Environment</span>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-white/10 dark:border-ui-border" />

        {/* Navigation */}
        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`admin-sidebar-nav-item ${activeTab === item.key ? "admin-sidebar-nav-item-active" : ""}`}
            >
              <item.icon className="admin-sidebar-nav-item-icon" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="admin-sidebar-nav-item"
            title="Toggle theme"
          >
            {darkMode ? (
              <>
                <Sun className="admin-sidebar-nav-item-icon text-brand-orange" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="admin-sidebar-nav-item-icon" />
                Dark Mode
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="admin-content flex-1 flex flex-col">
        {activeTab === "simulation" ? (
          <>
            {/* Page Header */}
            <div className="admin-page-header">
              <h1 className="admin-page-header-title">
                <Cpu className="h-5 w-5 text-brand-teal" />
                Simulation Runner
              </h1>
              <button
                onClick={handleRunSimulation}
                disabled={isRunning || !selectedAdminId || !selectedOrgId}
                className={`btn btn-teal px-6 py-2 flex items-center gap-2 font-bold ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Play className="h-4 w-4" />
                {isRunning ? "Simulating..." : "Trigger Simulation"}
              </button>
            </div>

            {/* Page Body */}
            <div className="admin-page-body">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Config */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="card">
                    <h2 className="heading-md mb-4 flex items-center gap-2">
                      <Play className="h-5 w-5 text-brand-teal" />
                      Simulation Parameters
                    </h2>

                    {/* Acting Admin Selector */}
                    <div className="mb-4">
                      <label className="label">Acting Admin Owner</label>
                      <select
                        className="input select"
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                      >
                        {admins.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.firstName} {a.lastName} ({a.username})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Organization Selector */}
                    <div className="mb-4">
                      <label className="label">Target Organization</label>
                      {organizations.length === 0 ? (
                        <p className="text-text-muted text-sm italic py-2">No organizations available for selected admin</p>
                      ) : (
                        <select
                          className="input select"
                          value={selectedOrgId}
                          onChange={(e) => setSelectedOrgId(e.target.value)}
                        >
                          {organizations.map((o) => (
                            <option key={o._id} value={o._id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Classroom selector / creator */}
                    <div className="mb-4">
                      <label className="label">Classroom Mode</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-ui-muted dark:bg-ui-bg rounded-md mb-3">
                        <button
                          type="button"
                          onClick={() => setClassroomMode("create")}
                          className={`py-1.5 text-xs rounded font-medium transition-all ${classroomMode === "create" ? "bg-ui-surface text-brand-blue shadow-xs" : "text-text-secondary"}`}
                        >
                          Create Classroom
                        </button>
                        <button
                          type="button"
                          disabled={classrooms.length === 0}
                          onClick={() => setClassroomMode("existing")}
                          className={`py-1.5 text-xs rounded font-medium transition-all disabled:opacity-50 ${classroomMode === "existing" ? "bg-ui-surface text-brand-blue shadow-xs" : "text-text-secondary"}`}
                        >
                          Use Existing
                        </button>
                      </div>

                      {classroomMode === "existing" ? (
                        <select
                          className="input select"
                          value={selectedClassroomId}
                          onChange={(e) => setSelectedClassroomId(e.target.value)}
                        >
                          {classrooms.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="input"
                          placeholder="classroom_name (auto-generated if empty)"
                          value={newClassroomName}
                          onChange={(e) => setNewClassroomName(e.target.value)}
                        />
                      )}
                    </div>

                    {/* Simulated Roster Count */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <label className="label mb-0">Simulated Students Count</label>
                        <span className="text-xs font-bold text-brand-blue dark:text-brand-teal bg-ui-muted dark:bg-ui-bg px-2 py-0.5 rounded">
                          {studentCount} Students
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={studentCount}
                        onChange={(e) => setStudentCount(parseInt(e.target.value))}
                        className="w-full accent-brand-teal"
                      />
                      <span className="text-text-muted text-xs block mt-1">
                        Note: Round-robin seed assignments will split these across active store profiles.
                      </span>
                    </div>

                    {/* Simulation Mode Toggle */}
                    <div>
                      <label className="label">Simulation Ledger Method</label>
                      <select
                        className="input select"
                        value={simulationMode}
                        onChange={(e) => setSimulationMode(e.target.value as "direct" | "batch")}
                      >
                        <option value="direct">Individual Job Queue (requires worker)</option>
                        <option value="batch">Batch Ledger Mode (requires bull worker running)</option>
                      </select>
                    </div>
                  </div>

                  {/* Advanced Challenge Creation Settings */}
                  <div className="card">
                    <h3 className="heading-md mb-3">Challenge Configurations</h3>

                    <div className="mb-4">
                      <label className="label">Challenge Description Mode</label>
                      <select
                        className="input select"
                        value={scenarioMode}
                        onChange={(e) => setScenarioMode(e.target.value as "manual" | "ai")}
                      >
                        <option value="manual">Manual Configuration</option>
                        <option value="ai">AI Structured Generation (OpenAI required)</option>
                      </select>
                    </div>

                    {scenarioMode === "manual" && (
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="label">Weekly Challenge Title</label>
                          <input
                            type="text"
                            className="input"
                            value={scenarioTitle}
                            onChange={(e) => setScenarioTitle(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">Weekly Description</label>
                          <textarea
                            className="textarea"
                            value={scenarioDescription}
                            onChange={(e) => setScenarioDescription(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">Instructor Summary Notes</label>
                          <textarea
                            className="textarea"
                            value={outcomeNotes}
                            onChange={(e) => setOutcomeNotes(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="label">Random Event Chance (%): {randomEventChance}%</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={randomEventChance}
                            onChange={(e) => setRandomEventChance(parseInt(e.target.value))}
                            className="w-full accent-brand-orange"
                          />
                        </div>
                      </div>
                    )}

                    <div className="mb-4 mt-3">
                      <label className="label">Student Submission Generation Mode</label>
                      <select
                        className="input select"
                        value={submissionMode}
                        onChange={(e) => setSubmissionMode(e.target.value as "ai" | "defaults")}
                      >
                        <option value="defaults">Defaults (Variables fallback schema)</option>
                        <option value="ai">AI Generated Decisions (OpenAI LLM Pizza models)</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Missing Decisions Auto-Outcome Resolution</label>
                      <select
                        className="input select"
                        value={missingSubmissionsMode}
                        onChange={(e) => setMissingSubmissionsMode(e.target.value)}
                      >
                        <option value="null">Skip (do nothing for absent submissions)</option>
                        <option value="USE_DEFAULTS">Defaults (simulate defaults values)</option>
                        <option value="USE_AI">AI Generation (simulate AI values)</option>
                        <option value="FORWARD_PREVIOUS">Forward Previous (copy last week's values)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column: Terminal */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className="card flex-1 flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-ui-border pb-4 mb-4">
                      <h2 className="heading-md flex items-center gap-2">
                        <TerminalIcon className="h-5 w-5 text-brand-teal" />
                        Engine Activity Stream
                      </h2>
                    </div>

                    {/* Dark terminal box */}
                    <div className="flex-1 bg-black text-green-400 p-4 rounded-md font-mono text-xs overflow-y-auto max-h-[500px] border border-gray-800 shadow-inner flex flex-col gap-1.5 terminal-container">
                      {logs.length === 0 && (
                        <div className="text-gray-500 italic py-8 text-center">
                          Ready. Configure parameters and click "Trigger Simulation" to start the simulation round.
                        </div>
                      )}
                      {logs.map((log, idx) => (
                        <div key={idx} className={`leading-relaxed ${log.status === "failed" ? "text-red-400" :
                            log.status === "completed" ? "text-teal-300 font-bold" :
                              log.text.startsWith("❌") ? "text-red-400" :
                                log.text.startsWith("🎉") || log.text.startsWith("✅") ? "text-teal-300" : "text-green-400"
                          }`}>
                          {log.text}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </div>

                    {/* Run summary alert if finished */}
                    {runResult && (
                      <div className="alert alert-success mt-4">
                        <div className="alert-content">
                          <CheckCircle className="h-5 w-5 alert-icon text-brand-teal" />
                          <div className="alert-body">
                            <h4 className="alert-title">Simulation jobs submitted</h4>
                            <p className="alert-message">
                              {runResult.jobCount} student jobs were queued. The workers will save outcomes as they complete.
                            </p>
                            <div className="alert-actions mt-2 text-xs">
                              <span className="font-bold">Classroom ID:</span> {runResult.classroomId} | <span className="font-bold">Challenge ID:</span> {runResult.challengeId}
                            </div>
                            <button
                              type="button"
                              className="mt-3 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                              disabled={isCleaningUp}
                              onClick={handleCleanupSimulation}
                            >
                              {isCleaningUp ? "Cleaning up…" : "Delete simulation classroom and data"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Email Previews Header */}
            <div className="admin-page-header">
              <h1 className="admin-page-header-title">
                <Mail className="h-5 w-5 text-brand-teal" />
                Email Previews
              </h1>

              {/* Format tabs */}
              <div className="flex bg-ui-muted dark:bg-ui-bg p-1 rounded-md text-xs">
                <button
                  onClick={() => setEmailTab("html")}
                  className={`px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-all ${emailTab === "html" ? "bg-ui-surface text-brand-blue shadow-xs" : "text-text-secondary"}`}
                >
                  <Eye className="h-3 w-3" />
                  HTML Preview
                </button>
                <button
                  onClick={() => setEmailTab("text")}
                  className={`px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-all ${emailTab === "text" ? "bg-ui-surface text-brand-blue shadow-xs" : "text-text-secondary"}`}
                >
                  <FileText className="h-3 w-3" />
                  Plaintext
                </button>
                <button
                  onClick={() => setEmailTab("raw")}
                  className={`px-3 py-1.5 rounded font-medium flex items-center gap-1 transition-all ${emailTab === "raw" ? "bg-ui-surface text-brand-blue shadow-xs" : "text-text-secondary"}`}
                >
                  <Code className="h-3 w-3" />
                  HTML Source
                </button>
              </div>
            </div>

            {/* Email Page Body */}
            <div className="admin-page-body">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Props */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="card">
                    <h2 className="heading-md mb-4 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-brand-teal" />
                      Template Configuration
                    </h2>

                    <div className="mb-4">
                      <label className="label">Select Template Slug</label>
                      <select
                        className="input select"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                      >
                        {templates.map((slug) => (
                          <option key={slug} value={slug}>
                            {slug}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="label mb-0">Template Props (JSON Payload)</label>
                        {jsonError && (
                          <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Invalid JSON
                          </span>
                        )}
                      </div>
                      <textarea
                        className="textarea font-mono text-xs leading-normal bg-ui-muted dark:bg-black p-3 border border-ui-border text-text-primary rounded-md min-h-[350px]"
                        value={fixtureJson}
                        onChange={(e) => setFixtureJson(e.target.value)}
                      />
                      {jsonError && (
                        <p className="text-red-400 text-xs mt-2 border border-red-900 bg-red-950/35 p-2 rounded">
                          {jsonError}
                        </p>
                      )}
                      <span className="text-text-muted text-xs block mt-2">
                        Tip: Any updates to the JSON structure or fields are instantly rendered in the live preview panel on the right.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className="card flex-1 flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between border-b border-ui-border pb-3 mb-4">
                      <h2 className="heading-md flex items-center gap-2">
                        <Eye className="h-5 w-5 text-brand-teal" />
                        Live Preview Frame
                      </h2>
                    </div>

                    {/* Main Preview viewport */}
                    <div className="flex-1 border border-ui-border rounded-md overflow-hidden bg-white flex flex-col min-h-[400px]">
                      {emailTab === "html" && (
                        <iframe
                          title="Email HTML Preview"
                          srcDoc={emailFormats.html}
                          className="w-full h-full border-none flex-1 min-h-[400px]"
                          sandbox="allow-popups allow-popups-to-escape-sandbox"
                        />
                      )}

                      {emailTab === "text" && (
                        <pre className="p-4 text-xs font-mono text-black whitespace-pre-wrap overflow-auto h-full flex-1 bg-gray-50 leading-relaxed min-h-[400px]">
                          {emailFormats.text || "(no plain text version available)"}
                        </pre>
                      )}

                      {emailTab === "raw" && (
                        <pre className="p-4 text-xs font-mono text-blue-800 dark:text-blue-900 whitespace-pre-wrap overflow-auto h-full flex-1 bg-gray-50 leading-relaxed min-h-[400px]">
                          {emailFormats.html}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
