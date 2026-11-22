import React, { useEffect, useState, useMemo } from "react";
import { checkBackendConnection, loadOperationalDatasets, predictWait } from "./services/api.js";
import { runHospitalPipeline, sanitizeWorkflowInput } from "./utils/flowEngine.js";

const DEPARTMENTS_DATA = [
  { id: "D01", name: "Emergency Care", totalBeds: 24, activeBeds: 21, staffCount: 14, waitTime: 82.5, status: "CRITICAL", leadDoctor: "Dr. Arvind Rao", doctorStatus: "In Surgery" },
  { id: "D02", name: "Cardiology Center", totalBeds: 18, activeBeds: 16, staffCount: 8, waitTime: 65.2, status: "CRITICAL", leadDoctor: "Dr. Ananya Sen", doctorStatus: "On Rounds" },
  { id: "D03", name: "Radiology & Imaging", totalBeds: 12, activeBeds: 7, staffCount: 6, waitTime: 38.0, status: "ELEVATED", leadDoctor: "Dr. K. V. Sharma", doctorStatus: "Available" },
  { id: "D04", name: "General Surgery", totalBeds: 20, activeBeds: 12, staffCount: 10, waitTime: 24.5, status: "OPTIMAL", leadDoctor: "Dr. Meera Nambiar", doctorStatus: "Available" },
  { id: "D05", name: "Pediatrics & Child Care", totalBeds: 16, activeBeds: 8, staffCount: 7, waitTime: 21.0, status: "OPTIMAL", leadDoctor: "Dr. Rajesh Gupta", doctorStatus: "Available" },
  { id: "D06", name: "Orthopedics & Joint Clinic", totalBeds: 14, activeBeds: 11, staffCount: 6, waitTime: 42.1, status: "ELEVATED", leadDoctor: "Dr. S. Mukherjee", doctorStatus: "Consultation" }
];

const generateInitialBeds = () => {
  const beds = {};
  DEPARTMENTS_DATA.forEach(dept => {
    beds[dept.id] = Array.from({ length: dept.totalBeds }, (_, i) => {
      const bedNum = i + 1;
      const isOccupied = bedNum <= dept.activeBeds;
      const triageLvl = isOccupied ? (dept.status === "CRITICAL" ? (bedNum % 3 === 0 ? 1 : 2) : (bedNum % 2 === 0 ? 3 : 4)) : null;
      return {
        id: `${dept.id}-B${bedNum.toString().padStart(2, '0')}`,
        bedNumber: bedNum,
        status: isOccupied ? "OCCUPIED" : (bedNum === dept.activeBeds + 1 ? "CLEANING" : "AVAILABLE"),
        triageLevel: triageLvl,
        patientName: isOccupied ? `Patient #${1000 + i * 17}` : null,
        admitTime: isOccupied ? `${Math.floor(Math.random() * 4) + 1}h ago` : null,
        pendingLabs: isOccupied ? (i % 2 === 0 ? 2 : 0) : 0
      };
    });
  });
  return beds;
};

const DOCTORS_ROSTER = [
  { id: "DOC-01", name: "Dr. Arvind Rao", dept: "Emergency Care", role: "Chief Trauma Surgeon", status: "In Emergency OR", shift: "08:00 - 20:00", patientsAssigned: 8, rating: "99.4%" },
  { id: "DOC-02", name: "Dr. Ananya Sen", dept: "Cardiology Center", role: "Consultant Cardiologist", status: "ICU Rounds", shift: "08:00 - 18:00", patientsAssigned: 6, rating: "98.9%" },
  { id: "DOC-03", name: "Dr. K. V. Sharma", dept: "Radiology & Imaging", role: "Senior Radiologist", status: "Available", shift: "12:00 - 22:00", patientsAssigned: 3, rating: "97.5%" },
  { id: "DOC-04", name: "Dr. Meera Nambiar", dept: "General Surgery", role: "Lap. Surgeon", status: "Available", shift: "09:00 - 19:00", patientsAssigned: 4, rating: "99.1%" },
  { id: "DOC-05", name: "Dr. S. Mukherjee", dept: "Orthopedics & Joint Clinic", role: "Orthopedic Specialist", status: "Consultation", shift: "10:00 - 20:00", patientsAssigned: 5, rating: "98.2%" },
  { id: "DOC-06", name: "Dr. Rajesh Gupta", dept: "Pediatrics & Child Care", role: "Pediatric Intensivist", status: "Available", shift: "08:00 - 17:00", patientsAssigned: 4, rating: "99.0%" }
];

const DIAGNOSTIC_TELEMETRY = [
  { code: "CT-01", name: "Spiral Contrast CT", dept: "Radiology", turnaround: "86.4 min", queueLength: 14, alert: "Bottleneck Detected" },
  { code: "LAB-09", name: "STAT Cardiac Troponin-I", dept: "Emergency", turnaround: "48.2 min", queueLength: 19, alert: "Delay Warning" },
  { code: "MRI-02", name: "3T Neuro/Spine MRI", dept: "Radiology", turnaround: "72.0 min", queueLength: 8, alert: "Normal Queue" },
  { code: "XRY-04", name: "Portable Digital X-Ray", dept: "Emergency", turnaround: "19.5 min", queueLength: 4, alert: "Clear Stream" },
  { code: "HEM-01", name: "Complete Hemogram (CBC)", dept: "Pathology", turnaround: "32.0 min", queueLength: 26, alert: "High Volume" }
];

export default function App() {
  const [currentTab, setCurrentTab] = useState("spatial");
  const [backendConnected, setBackendConnected] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState("D01");
  const [bedsData, setBedsData] = useState(generateInitialBeds);
  const [selectedBed, setSelectedBed] = useState(null);
  const [filterTriage, setFilterTriage] = useState("ALL");
  const [showToast, setShowToast] = useState(null);

  const [simTriage, setSimTriage] = useState(3);
  const [simOcc, setSimOcc] = useState(0.85);
  const [simLabs, setSimLabs] = useState(3);
  const [simOutput, setSimOutput] = useState(null);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [pipelineMessage, setPipelineMessage] = useState("");
  const [uploadedDatasets, setUploadedDatasets] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");

  useEffect(() => {
    let active = true;
    checkBackendConnection().then(connected => {
      if (active) setBackendConnected(connected);
    });
    return () => { active = false; };
  }, []);

  const activeDept = useMemo(() => DEPARTMENTS_DATA.find(d => d.id === selectedDeptId), [selectedDeptId]);
  const currentBeds = useMemo(() => {
    let b = bedsData[selectedDeptId] || [];
    if (filterTriage !== "ALL") {
      b = b.filter(bed => bed.status === "OCCUPIED" && bed.triageLevel === Number(filterTriage));
    }
    return b;
  }, [bedsData, selectedDeptId, filterTriage]);

  const triggerToast = (msg) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 3500);
  };

  const handleToggleBedState = () => {
    if (!selectedBed) return;
    setBedsData(prev => {
      const updated = { ...prev };
      updated[selectedDeptId] = updated[selectedDeptId].map(b => {
        if (b.id === selectedBed.id) {
          const newStatus = b.status === "OCCUPIED" ? "AVAILABLE" : "OCCUPIED";
          return {
            ...b,
            status: newStatus,
            patientName: newStatus === "OCCUPIED" ? "Emergency Inbound #9021" : null,
            admitTime: newStatus === "OCCUPIED" ? "Just Now" : null,
            triageLevel: newStatus === "OCCUPIED" ? 2 : null
          };
        }
        return b;
      });
      return updated;
    });
    triggerToast(`Bed ${selectedBed.id} status updated successfully.`);
    setSelectedBed(null);
  };

  const runSimulation = async (e) => {
    e.preventDefault();
    try {
      const data = await predictWait({
        triage_level: simTriage,
        active_dept_occupancy: simOcc,
        concurrent_lab_orders: simLabs
      });
      setSimOutput({
        wait: data.predicted_wait_time_mins,
        band: data.risk_tier,
        occPenalty: data.signals.occupancy_impact,
        labPenalty: data.signals.diagnostics_queue_impact
      });
    } catch {
      const base = (6 - simTriage) * 7.8 + (simOcc * 24.5) + (simLabs * 4.3);
      setSimOutput({
        wait: base.toFixed(1),
        band: base > 50 ? "CRITICAL DELAY RISK" : (base > 30 ? "ELEVATED CONGESTION" : "STABLE FLOW"),
        occPenalty: ((simOcc - 0.7) * 22).toFixed(1),
        labPenalty: (simLabs * 4.3).toFixed(1)
      });
    }
  };

  const handlePipelineUpload = async (event) => {
    const file = event.target.files?.[0];
    setPipelineError("");
    setPipelineMessage("");
    setUploadedDatasets(null);
    setUploadedFileName("");
    if (!file) return;
    if (!/\.(csv|json)$/iu.test(file.name) || file.size > 1_000_000) {
      setPipelineError("Choose a CSV or JSON file no larger than 1 MB.");
      event.target.value = "";
      return;
    }
    try {
      const datasets = sanitizeWorkflowInput(await file.text());
      setUploadedDatasets(datasets);
      setUploadedFileName(file.name);
      setPipelineMessage(`${file.name} validated. Unchanged datasets will use the bundled operational records.`);
    } catch (error) {
      setPipelineError(error instanceof Error ? error.message : "The uploaded file could not be validated.");
      event.target.value = "";
    }
  };

  const executePipeline = async () => {
    setPipelineBusy(true);
    setPipelineError("");
    setPipelineMessage("");
    try {
      const data = uploadedDatasets
        ? { datasets: uploadedDatasets, source: `Uploaded file: ${uploadedFileName}` }
        : await loadOperationalDatasets();
      const result = runHospitalPipeline(data.datasets, {
        departments: DEPARTMENTS_DATA,
        source: data.source
      });
      setPipelineResult(result);
      setPipelineMessage(`Pipeline complete for the ${result.surge.peakTime} peak surge window.`);
    } catch (error) {
      setPipelineError(error instanceof Error ? error.message : "The hospital workflow could not be completed.");
    } finally {
      setPipelineBusy(false);
    }
  };

  const downloadDispatchReport = () => {
    if (!pipelineResult) return;
    const report = new Blob([JSON.stringify(pipelineResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(report);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vitalis-dispatch-report-${pipelineResult.generatedAt.replace(/[:.]/gu, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#FBFBF9] text-[#2D312E] overflow-hidden">
      {/* WARM BOTANICAL SIDEBAR */}
      <aside className="w-72 bg-[#F5F4EE] border-r border-[#E8E6DC] flex flex-col justify-between shrink-0 shadow-sm">
        <div>
          {/* Logo & Hospital Header */}
          <div className="p-6 border-b border-[#E8E6DC] flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-sage-600 to-sage-500 flex items-center justify-center font-bold text-white shadow-md shadow-sage-600/20 text-lg">
              🌿
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-[#1E2522]">Vitalis Hospital</h1>
              <p className="text-xs text-sage-600 font-semibold">FlowIQ Operations Portal</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {[
              { id: "spatial", label: "Spatial Ward Map", icon: "🏛️", desc: "Interactive bed view" },
              { id: "doctors", label: "Care Team & Doctors", icon: "🩺", desc: "Shift & availability" },
              { id: "diagnostics", label: "Diagnostic Monitor", icon: "🧪", desc: "Labs & imaging queues" },
              { id: "simulator", label: "FlowIQ Predictor", icon: "✨", desc: "Wait time simulator" },
              { id: "pipeline", label: "Auto-Pilot Pipeline", icon: "⚙️", desc: "Automated surge response" }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                aria-current={currentTab === item.id ? "page" : undefined}
                aria-label={`${item.label}: ${item.desc}`}
                className={`w-full flex items-center px-4 py-3.5 rounded-2xl text-left transition-all ${
                  currentTab === item.id 
                    ? "bg-[#EAE8DD] text-sage-800 font-bold shadow-sm border border-[#DDD9C8]" 
                    : "text-[#626863] hover:bg-[#EFECE1] hover:text-[#1E2522]"
                }`}
              >
                <span className="text-xl mr-3.5">{item.icon}</span>
                <div>
                  <div className="text-sm">{item.label}</div>
                  <div className="text-[11px] text-[#868C87] font-normal">{item.desc}</div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Live Status Card */}
        <div className="p-5 border-t border-[#E8E6DC] bg-[#ECE9DE]/60 m-3 rounded-2xl">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#6D746E] font-medium">Hospital Live Stream</span>
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center font-bold ${backendConnected ? "text-sage-700" : "text-amberwarm-700"}`}
            >
              <span className={`w-2 h-2 rounded-full mr-1.5 ${backendConnected ? "bg-sage-500 animate-pulse" : "bg-amberwarm-500"}`}></span>
              {backendConnected === null ? "Checking Backend" : backendConnected ? "Live Backend Connected" : "Standalone Edge Engine Active"}
            </span>
          </div>
          <div className="text-[11px] text-[#868C87] leading-relaxed">
            Vitalis Central Care • Track 1 Health Integration
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FBFBF9]">
        {/* TOP BAR */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#ECE8DC] px-8 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-[#1E2522]">
              {currentTab === "spatial" ? "Ward Spatial Map & Bed Matrix" : currentTab === "doctors" ? "Care Team Rosters & Availability" : currentTab === "diagnostics" ? "Diagnostic Backlog & Turnaround" : currentTab === "pipeline" ? "Auto-Pilot Hospital Pipeline" : "Triage Delay Forecaster"}
            </h2>
            <p className="text-xs text-[#7B827C]">Real-time patient flow coordination • Vitalis Central</p>
          </div>

          <div className="flex items-center space-x-6 text-xs">
            <div className="bg-[#F7F5EE] px-4 py-2 rounded-xl border border-[#ECE8DC]">
              <span className="text-[#7B827C] block font-medium">Hospital Bed Capacity</span>
              <span className="text-sm font-bold text-[#1E2522]">85 / 104 Occupied</span>
            </div>
            <div className="bg-clay-50 px-4 py-2 rounded-xl border border-clay-100">
              <span className="text-clay-700 block font-medium">Critical Attention</span>
              <span className="text-sm font-bold text-clay-600">2 Departments</span>
            </div>
            <div className="bg-amberwarm-50 px-4 py-2 rounded-xl border border-amberwarm-100">
              <span className="text-amberwarm-700 block font-medium">Inbound EMS</span>
              <span className="text-sm font-bold text-amberwarm-600">4 Enroute</span>
            </div>
          </div>
        </header>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {showToast && (
            <div role="status" aria-live="polite" className="fixed bottom-6 right-6 bg-sage-700 text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-medium border border-sage-600 flex items-center space-x-2 z-50 animate-bounce">
              <span>🌿</span>
              <span>{showToast}</span>
            </div>
          )}

          {currentTab === "pipeline" && (
            <section aria-labelledby="pipeline-heading" className="space-y-6">
              <div className="rounded-3xl bg-white border border-[#ECE8DC] shadow-sm p-6 md:p-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                  <div>
                    <p className="text-xs uppercase tracking-widest font-bold text-sage-700">Operational decision support</p>
                    <h3 id="pipeline-heading" className="mt-2 text-2xl font-extrabold text-[#1E2522]">Auto-Pilot Hospital Pipeline</h3>
                    <p className="mt-2 max-w-2xl text-sm text-[#626863]">
                      Forecast the peak inbound surge, allocate estimated ward and ICU beds, rebalance available nurse shifts, and flag diagnostic delays.
                    </p>
                  </div>
                  <span className={`self-start inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
                    backendConnected ? "bg-sage-50 text-sage-700 border-sage-200" : "bg-amberwarm-50 text-amberwarm-700 border-amberwarm-200"
                  }`}>
                    {backendConnected === null ? "Checking connection" : backendConnected ? "Live Backend Connected" : "Standalone Edge Engine Active"}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-[#E8E6DC] bg-[#FBFBF9] p-5">
                    <h4 className="font-bold text-sm text-[#1E2522]">Use operational data</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[#626863]">
                      Run against the built-in hospital datasets, or upload a supported dataset CSV/JSON to replace its matching records.
                    </p>
                    <label htmlFor="pipeline-file" className="mt-4 block text-xs font-bold text-[#626863]">Optional CSV or JSON input (max 1 MB)</label>
                    <input
                      id="pipeline-file"
                      type="file"
                      accept=".csv,.json,text/csv,application/json"
                      aria-label="Upload hospital workflow data as CSV or JSON, maximum 1 megabyte"
                      onChange={handlePipelineUpload}
                      className="mt-2 block w-full rounded-xl border border-[#DDD9C8] bg-white p-2.5 text-xs text-[#2D312E] file:mr-3 file:rounded-lg file:border-0 file:bg-sage-50 file:px-3 file:py-2 file:font-bold file:text-sage-700"
                    />
                    {uploadedFileName && <p className="mt-2 text-xs text-sage-700">Validated input: <strong>{uploadedFileName}</strong></p>}
                    <button
                      type="button"
                      onClick={executePipeline}
                      disabled={pipelineBusy}
                      aria-label="Run the automated hospital operations pipeline"
                      className="mt-4 w-full rounded-xl bg-sage-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-sage-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {pipelineBusy ? "Executing Pipeline…" : "Run Auto-Pilot Pipeline"}
                    </button>
                    <p className="mt-3 text-[11px] leading-relaxed text-[#7B827C]">
                      Bed allocations are planning recommendations. ICU availability is estimated because the supplied datasets do not include ICU inventory.
                    </p>
                  </div>

                  <div
                    aria-live="polite"
                    aria-busy={pipelineBusy}
                    className="rounded-2xl border border-[#E8E6DC] bg-[#FBFBF9] p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-[#1E2522]">Dispatch report</h4>
                        <p className="mt-1 text-xs text-[#626863]">Peak-window actions and resource constraints.</p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadDispatchReport}
                        disabled={!pipelineResult}
                        aria-label="Download the hospital dispatch report as a JSON file"
                        className="shrink-0 rounded-xl border border-[#DDD9C8] bg-white px-3 py-2 text-xs font-bold text-sage-700 hover:bg-sage-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Download JSON
                      </button>
                    </div>
                    {pipelineError && <p role="alert" className="mt-4 rounded-xl border border-clay-200 bg-clay-50 p-3 text-xs font-semibold text-clay-700">{pipelineError}</p>}
                    {pipelineMessage && <p role="status" className="mt-4 rounded-xl border border-sage-200 bg-sage-50 p-3 text-xs font-semibold text-sage-700">{pipelineMessage}</p>}
                    {!pipelineResult && !pipelineError && (
                      <p className="mt-5 rounded-xl border border-dashed border-[#DDD9C8] p-5 text-center text-xs text-[#7B827C]">
                        Run the pipeline to view surge, allocation, staffing, and diagnostic escalation decisions.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {pipelineResult && (
                <div aria-live="polite" className="space-y-6">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    {[
                      { label: "Peak window", value: pipelineResult.surge.peakTime },
                      { label: "Expected arrivals", value: pipelineResult.surge.expectedArrivals },
                      { label: "ICU beds allocated", value: pipelineResult.bedPlan.allocatedIcuBeds },
                      { label: "Unallocated arrivals", value: pipelineResult.bedPlan.unallocatedArrivals }
                    ].map(metric => (
                      <div key={metric.label} className="rounded-2xl border border-[#ECE8DC] bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium text-[#7B827C]">{metric.label}</p>
                        <p className="mt-1 text-2xl font-extrabold text-sage-700">{metric.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <section aria-labelledby="bed-plan-heading" className="rounded-3xl border border-[#ECE8DC] bg-white p-6 shadow-sm">
                      <h4 id="bed-plan-heading" className="text-lg font-extrabold text-[#1E2522]">Bed & ICU allocation</h4>
                      <p className="mt-1 text-xs text-[#7B827C]">
                        {pipelineResult.surge.expectedCriticalArrivals} high-acuity arrivals at {pipelineResult.surge.peakTime}; ICU space is planning-only.
                      </p>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead><tr className="border-b border-[#ECE8DC] text-[#7B827C]">
                            <th scope="col" className="py-2 pr-3">Department</th>
                            <th scope="col" className="py-2 px-2">Available</th>
                            <th scope="col" className="py-2 px-2">ICU</th>
                            <th scope="col" className="py-2 pl-2">Ward</th>
                          </tr></thead>
                          <tbody className="divide-y divide-[#F2EFE6]">
                            {pipelineResult.bedPlan.departments.map(unit => (
                              <tr key={unit.departmentId}>
                                <th scope="row" className="py-3 pr-3 font-semibold text-[#2D312E]">{unit.departmentName}</th>
                                <td className="py-3 px-2">{unit.availableBeds}</td>
                                <td className="py-3 px-2 font-bold text-sage-700">{unit.icuAllocated}</td>
                                <td className="py-3 pl-2 font-bold text-sage-700">{unit.wardAllocated}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-[#7B827C]">{pipelineResult.bedPlan.icuCapacityNote}</p>
                    </section>

                    <section aria-labelledby="staffing-heading" className="rounded-3xl border border-[#ECE8DC] bg-white p-6 shadow-sm">
                      <h4 id="staffing-heading" className="text-lg font-extrabold text-[#1E2522]">Conflict-free nurse shift plan</h4>
                      <p className="mt-1 text-xs text-[#7B827C]">Donor rosters retain their minimum calculated coverage; each reassignment is used once.</p>
                      <div className="mt-4 space-y-2">
                        {pipelineResult.staffingPlan.assignments.map(assignment => (
                          <div key={assignment.rosterId} className="flex items-center justify-between gap-3 rounded-xl bg-[#FBFBF9] px-3 py-2.5 text-xs">
                            <span className="font-semibold text-[#2D312E]">{assignment.departmentId} · {assignment.shiftType}</span>
                            <span className="text-[#626863]">{assignment.nursesBefore} → <strong className="text-sage-700">{assignment.nursesAfter}</strong> nurses</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-xs font-bold text-[#1E2522]">Reassignments: {pipelineResult.staffingPlan.transfers.length}</p>
                      {pipelineResult.staffingPlan.unfilledNurseNeeds.length > 0 ? (
                        <ul aria-label="Unfilled nurse staffing needs" className="mt-2 space-y-1 rounded-xl border border-amberwarm-200 bg-amberwarm-50 p-3 text-xs text-amberwarm-700">
                          {pipelineResult.staffingPlan.unfilledNurseNeeds.map(need => (
                            <li key={need.rosterId}>{need.departmentId} ({need.rosterId}): {need.nursesNeeded} additional nurse(s) still needed.</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-sage-700">All calculated shift coverage needs are met.</p>
                      )}
                      {pipelineResult.staffingPlan.transfers.length > 0 && (
                        <ul aria-label="Nurse reassignment details" className="mt-2 space-y-1 text-[11px] text-[#626863]">
                          {pipelineResult.staffingPlan.transfers.map(transfer => (
                            <li key={transfer.nurseId}>{transfer.nurseId}: {transfer.fromRoster} → {transfer.toRoster}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>

                  <section aria-labelledby="diagnostic-alerts-heading" className="rounded-3xl border border-[#ECE8DC] bg-white p-6 shadow-sm">
                    <h4 id="diagnostic-alerts-heading" className="text-lg font-extrabold text-[#1E2522]">Diagnostic escalation alerts</h4>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {pipelineResult.diagnosticEscalations.map(alert => (
                        <article key={alert.batchId} className={`rounded-2xl border p-4 ${alert.severity === "critical" ? "border-clay-200 bg-clay-50" : "border-amberwarm-200 bg-amberwarm-50"}`}>
                          <div className="flex justify-between gap-2">
                            <h5 className="text-sm font-bold text-[#1E2522]">{alert.testType.replace(/_/gu, " ")}</h5>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${alert.severity === "critical" ? "bg-clay-100 text-clay-700" : "bg-amberwarm-100 text-amberwarm-700"}`}>{alert.severity}</span>
                          </div>
                          <p className="mt-2 text-xs text-[#626863]">{alert.reason} · {alert.turnaroundMinutes} min</p>
                          <p className="mt-2 text-xs font-semibold text-[#2D312E]">{alert.action}</p>
                        </article>
                      ))}
                      {pipelineResult.diagnosticEscalations.length === 0 && <p className="text-xs text-sage-700">No diagnostic escalations. Continue routine monitoring.</p>}
                    </div>
                  </section>
                </div>
              )}
            </section>
          )}

          {/* SPATIAL THEATER MAP */}
          {currentTab === "spatial" && (
            <div className="space-y-6">
              {/* Department Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {DEPARTMENTS_DATA.map(dept => {
                  const isSel = dept.id === selectedDeptId;
                  const isCrit = dept.status === "CRITICAL";
                  return (
                    <button
                      key={dept.id}
                      onClick={() => { setSelectedDeptId(dept.id); setSelectedBed(null); }}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isSel 
                          ? "bg-white border-sage-600 shadow-md ring-2 ring-sage-500/20" 
                          : "bg-[#F7F6F0] border-[#E8E6DC] hover:bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-xs font-bold text-[#7B827C]">{dept.id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isCrit ? "bg-clay-50 text-clay-600 border border-clay-200" : (dept.status === "ELEVATED" ? "bg-amberwarm-50 text-amberwarm-700 border border-amberwarm-200" : "bg-sage-50 text-sage-700 border border-sage-200")
                        }`}>
                          {dept.status}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-[#1E2522] truncate">{dept.name}</div>
                      <div className="text-xs text-[#7B827C] mt-2 flex justify-between">
                        <span>Wait: <strong className={isCrit ? "text-clay-600" : "text-[#1E2522]"}>{dept.waitTime}m</strong></span>
                        <span>{dept.activeBeds}/{dept.totalBeds} Beds</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Spatial Matrix Canvas */}
              <div className="bg-white border border-[#ECE8DC] rounded-3xl p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#ECE8DC] gap-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#1E2522]">{activeDept.name} — Bed Layout View</h3>
                    <p className="text-xs text-[#7B827C] mt-1">Supervising Physician: <strong>{activeDept.leadDoctor}</strong> ({activeDept.doctorStatus})</p>
                  </div>
                  
                  {/* Legend & Filter */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#626863]">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-sage-500"></div>
                      <span>Free Bed</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-clay-500"></div>
                      <span>Triage 1/2 (Critical)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-amberwarm-500"></div>
                      <span>Triage 3/4 (Urgent)</span>
                    </div>
                    <select 
                      value={filterTriage}
                      onChange={(e) => setFilterTriage(e.target.value)}
                      className="bg-[#F7F5EE] text-[#2D312E] border border-[#DDD9C8] rounded-xl px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value="ALL">All Beds</option>
                      <option value="1">Triage 1 Only</option>
                      <option value="2">Triage 2 Only</option>
                      <option value="3">Triage 3 Only</option>
                    </select>
                  </div>
                </div>

                {/* Theater-Style Seating Grid */}
                <div className="mt-8 flex flex-col items-center">
                  <div className="w-2/3 max-w-xl h-9 bg-gradient-to-b from-sage-100/70 to-transparent border-t-2 border-sage-500 rounded-t-2xl flex items-center justify-center mb-8">
                    <span className="text-[11px] tracking-widest font-bold text-sage-800 uppercase">
                      CENTRAL NURSING DESK & OBSERVATION STATION
                    </span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 w-full max-w-4xl px-4">
                    {currentBeds.map(bed => {
                      const isOccupied = bed.status === "OCCUPIED";
                      const isCrit = bed.triageLevel === 1 || bed.triageLevel === 2;
                      const isSelected = selectedBed?.id === bed.id;
                      return (
                        <button
                          key={bed.id}
                          onClick={() => setSelectedBed(bed)}
                          className={`rounded-2xl p-3 text-center flex flex-col items-center justify-center border transition-all ${
                            isSelected 
                              ? "ring-2 ring-sage-600 scale-105 border-sage-600 bg-sage-50 shadow-md" 
                              : isOccupied 
                                ? (isCrit ? "bg-clay-50 border-clay-200 text-clay-800 hover:bg-clay-100" : "bg-amberwarm-50 border-amberwarm-200 text-amberwarm-900 hover:bg-amberwarm-100") 
                                : "bg-sage-50/60 border-sage-200 text-sage-800 hover:bg-sage-100"
                          }`}
                        >
                          <span className="text-xl">🛏️</span>
                          <span className="text-xs font-bold mt-1 text-[#2D312E]">{bed.id.split('-')[1]}</span>
                          {isOccupied && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-1 ${isCrit ? "bg-clay-500 text-white" : "bg-amberwarm-500 text-white"}`}>
                              T{bed.triageLevel}
                            </span>
                          )}
                          {!isOccupied && <span className="text-[10px] text-sage-600 font-bold mt-1">FREE</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bed Details Drawer */}
                {selectedBed && (
                  <div className="mt-8 bg-[#F8F7F2] border border-[#DDD9C8] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-base text-[#1E2522]">Cubicle {selectedBed.id} ({selectedBed.status})</h4>
                      <p className="text-xs text-[#626863] mt-1">
                        {selectedBed.status === "OCCUPIED" 
                          ? `${selectedBed.patientName} • Admitted: ${selectedBed.admitTime} • Triage Level: ${selectedBed.triageLevel} • Outstanding Labs: ${selectedBed.pendingLabs}`
                          : "Sanitized and prepped for incoming triage transfer."}
                      </p>
                    </div>
                    <div className="flex space-x-3">
                      <button onClick={() => setSelectedBed(null)} className="px-4 py-2 rounded-xl bg-white text-[#626863] border border-[#DDD9C8] text-xs font-bold hover:bg-[#F0EEE4]">
                        Close
                      </button>
                      <button onClick={handleToggleBedState} className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sage-600 hover:bg-sage-700 shadow-sm">
                        {selectedBed.status === "OCCUPIED" ? "Discharge Patient" : "Admit Inbound Patient"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DOCTORS ROSTER */}
          {currentTab === "doctors" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DOCTORS_ROSTER.map(doc => (
                <div key={doc.id} className="bg-white border border-[#ECE8DC] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-[#1E2522] text-base">{doc.name}</h4>
                        <p className="text-xs text-sage-600 font-semibold mt-0.5">{doc.role}</p>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-sage-50 text-sage-700 border border-sage-200">
                        {doc.status}
                      </span>
                    </div>
                    <div className="mt-5 pt-4 border-t border-[#F2EFE6] text-xs space-y-2 text-[#626863]">
                      <div className="flex justify-between"><span>Department:</span><span className="text-[#1E2522] font-semibold">{doc.dept}</span></div>
                      <div className="flex justify-between"><span>Scheduled Shift:</span><span className="text-[#1E2522] font-semibold">{doc.shift}</span></div>
                      <div className="flex justify-between"><span>Active Caseload:</span><span className="text-sage-700 font-bold">{doc.patientsAssigned} Patients</span></div>
                    </div>
                  </div>
                  <button onClick={() => triggerToast(`Paged ${doc.name} for escalation`)} className="w-full mt-5 py-2.5 bg-[#F7F5EE] hover:bg-[#EFECE1] text-sage-800 rounded-xl text-xs font-bold border border-[#E2DFD2]">
                    Page Specialist Pool
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* DIAGNOSTIC MONITOR */}
          {currentTab === "diagnostics" && (
            <div className="bg-white border border-[#ECE8DC] rounded-3xl p-8 shadow-sm">
              <h3 className="text-lg font-extrabold text-[#1E2522] mb-1">Diagnostic Batch Telemetry</h3>
              <p className="text-xs text-[#7B827C] mb-6">Monitoring turnaround times linked to diagnostic_tests.csv dataset.</p>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#ECE8DC] text-[#7B827C] uppercase">
                    <th className="py-3.5 px-4 font-bold">Instrument / Test</th>
                    <th className="py-3.5 px-4 font-bold">Department</th>
                    <th className="py-3.5 px-4 font-bold">Pending Queue</th>
                    <th className="py-3.5 px-4 font-bold">Mean Turnaround</th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="py-3.5 px-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2EFE6] text-[#2D312E]">
                  {DIAGNOSTIC_TELEMETRY.map(d => (
                    <tr key={d.code} className="hover:bg-[#FAF9F5]">
                      <td className="py-4 px-4 font-bold text-[#1E2522]">{d.name}</td>
                      <td className="py-4 px-4 text-[#626863]">{d.dept}</td>
                      <td className="py-4 px-4 font-semibold">{d.queueLength} tests</td>
                      <td className="py-4 px-4 font-mono font-bold text-sage-700">{d.turnaround}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${d.alert.includes("Bottleneck") ? "bg-clay-50 text-clay-700 border border-clay-200" : "bg-sage-50 text-sage-700 border border-sage-200"}`}>
                          {d.alert}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button onClick={() => triggerToast(`Priority batch expedited: ${d.name}`)} className="px-3 py-1 bg-[#F5F4EE] hover:bg-[#ECE9DC] text-sage-700 rounded-lg text-xs font-bold border border-[#DDD9C8]">
                          Expedite
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SIMULATOR */}
          {currentTab === "simulator" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-[#ECE8DC] rounded-3xl p-8 shadow-sm">
                <h3 className="text-lg font-extrabold text-[#1E2522] mb-1">Triage Delay Forecaster</h3>
                <p className="text-xs text-[#7B827C] mb-6">Interactive simulator powered by our Gradient Boosting Decision Trees.</p>
                
                <form onSubmit={runSimulation} className="space-y-5">
                  <div>
                    <label className="text-xs text-[#626863] block mb-1 font-bold">Acuity Level: Level {simTriage}</label>
                    <input type="range" min="1" max="5" value={simTriage} onChange={e => setSimTriage(Number(e.target.value))} className="w-full accent-sage-600" />
                  </div>
                  <div>
                    <label className="text-xs text-[#626863] block mb-1 font-bold">Department Occupancy: {(simOcc * 100).toFixed(0)}%</label>
                    <input type="range" min="0.3" max="1.5" step="0.05" value={simOcc} onChange={e => setSimOcc(Number(e.target.value))} className="w-full accent-sage-600" />
                  </div>
                  <div>
                    <label className="text-xs text-[#626863] block mb-1 font-bold">Pending Lab Orders Backlog</label>
                    <input type="number" min="0" max="15" value={simLabs} onChange={e => setSimLabs(Number(e.target.value))} className="w-full bg-[#F7F5EE] border border-[#DDD9C8] rounded-xl p-3 text-sm text-[#1E2522]" />
                  </div>
                  <button type="submit" className="w-full py-3 bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-all">
                    Forecast Delay
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#ECE8DC] rounded-3xl p-8 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-[#1E2522] mb-1">Factor Attribution Receipt</h3>
                  <p className="text-xs text-[#7B827C] mb-6">Explainable decomposition of wait-time factors.</p>
                  
                  {simOutput ? (
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-[#F7F5EE] border border-[#E8E6DC] flex justify-between items-center">
                        <div>
                          <span className="text-xs text-[#7B827C] block font-medium">Estimated Arrival-to-Service Wait</span>
                          <span className="text-3xl font-extrabold text-sage-700 font-mono">{simOutput.wait} mins</span>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amberwarm-50 text-amberwarm-700 border border-amberwarm-200">
                          {simOutput.band}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBFBF9] border border-[#E8E6DC] text-xs flex justify-between">
                        <span className="text-[#626863]">Ward Bed Occupancy Strain:</span>
                        <span className="text-clay-600 font-bold">+{simOutput.occPenalty} mins</span>
                      </div>
                      <div className="p-3 rounded-xl bg-[#FBFBF9] border border-[#E8E6DC] text-xs flex justify-between">
                        <span className="text-[#626863]">Diagnostic Testing Turnaround Penalty:</span>
                        <span className="text-amberwarm-600 font-bold">+{simOutput.labPenalty} mins</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 border-2 border-dashed border-[#E8E6DC] rounded-2xl text-center text-[#868C87] text-xs">
                      Adjust inputs on the left and click forecast to evaluate signals.
                    </div>
                  )}
                </div>

                <div className="p-4 bg-sage-50 border border-sage-200 rounded-2xl text-xs text-sage-800 mt-6">
                  💡 <strong>Administrative Protocol:</strong> If occupancy exceeds 100%, deploy a roving triage nurse to expedite non-critical orders to outpatient care.
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
