export const BUILT_IN_DATASETS = Object.freeze({
  inbound_surges: Object.freeze([
    { time_slot: "14:00", expected_walk_ins: 12, inbound_ems_ambulances: 3, expected_triage_1_2: 2, projected_surge_multiplier: 1.05 },
    { time_slot: "15:00", expected_walk_ins: 16, inbound_ems_ambulances: 4, expected_triage_1_2: 3, projected_surge_multiplier: 1.2 },
    { time_slot: "16:00", expected_walk_ins: 22, inbound_ems_ambulances: 6, expected_triage_1_2: 5, projected_surge_multiplier: 1.48 },
    { time_slot: "17:00", expected_walk_ins: 28, inbound_ems_ambulances: 8, expected_triage_1_2: 6, projected_surge_multiplier: 1.72 },
    { time_slot: "18:00", expected_walk_ins: 31, inbound_ems_ambulances: 9, expected_triage_1_2: 7, projected_surge_multiplier: 1.85 },
    { time_slot: "19:00", expected_walk_ins: 25, inbound_ems_ambulances: 5, expected_triage_1_2: 4, projected_surge_multiplier: 1.4 }
  ]),
  diagnostic_backlog: Object.freeze([
    { batch_id: "B_101", department_id: "D03", test_type: "Spiral_Contrast_CT", pending_specimens: 14, avg_turnaround_mins: 86.4, equipment_status: "Operational", critical_delay_flag: 1 },
    { batch_id: "B_102", department_id: "D03", test_type: "Portable_Digital_XRay", pending_specimens: 4, avg_turnaround_mins: 19.5, equipment_status: "Operational", critical_delay_flag: 0 },
    { batch_id: "B_103", department_id: "D01", test_type: "STAT_Cardiac_Troponin", pending_specimens: 19, avg_turnaround_mins: 48.2, equipment_status: "Delayed", critical_delay_flag: 1 },
    { batch_id: "B_104", department_id: "D03", test_type: "3T_Neuro_Spine_MRI", pending_specimens: 8, avg_turnaround_mins: 72, equipment_status: "Operational", critical_delay_flag: 0 },
    { batch_id: "B_105", department_id: "D04", test_type: "Complete_Hemogram_CBC", pending_specimens: 26, avg_turnaround_mins: 32, equipment_status: "Operational", critical_delay_flag: 0 }
  ]),
  shift_rosters: Object.freeze([
    { roster_id: "R_01", department_id: "D01", shift_type: "Day", nurses_on_duty: 6, doctors_on_duty: 3, active_surge_beds: 10, nurse_to_patient_ratio: 0.22 },
    { roster_id: "R_02", department_id: "D01", shift_type: "Night", nurses_on_duty: 4, doctors_on_duty: 2, active_surge_beds: 6, nurse_to_patient_ratio: 0.15 },
    { roster_id: "R_03", department_id: "D02", shift_type: "Day", nurses_on_duty: 5, doctors_on_duty: 2, active_surge_beds: 4, nurse_to_patient_ratio: 0.3 },
    { roster_id: "R_04", department_id: "D03", shift_type: "Day", nurses_on_duty: 4, doctors_on_duty: 2, active_surge_beds: 0, nurse_to_patient_ratio: 0.4 },
    { roster_id: "R_05", department_id: "D04", shift_type: "Day", nurses_on_duty: 6, doctors_on_duty: 4, active_surge_beds: 8, nurse_to_patient_ratio: 0.25 },
    { roster_id: "R_06", department_id: "D05", shift_type: "Day", nurses_on_duty: 5, doctors_on_duty: 2, active_surge_beds: 6, nurse_to_patient_ratio: 0.35 }
  ])
});

export const DEFAULT_DEPARTMENTS = Object.freeze([
  { id: "D01", name: "Emergency Care", totalBeds: 24, activeBeds: 21 },
  { id: "D02", name: "Cardiology Center", totalBeds: 18, activeBeds: 16 },
  { id: "D03", name: "Radiology & Imaging", totalBeds: 12, activeBeds: 7 },
  { id: "D04", name: "General Surgery", totalBeds: 20, activeBeds: 12 },
  { id: "D05", name: "Pediatrics & Child Care", totalBeds: 16, activeBeds: 8 },
  { id: "D06", name: "Orthopedics & Joint Clinic", totalBeds: 14, activeBeds: 11 }
]);

const SCHEMAS = {
  inbound_surges: {
    columns: ["time_slot", "expected_walk_ins", "inbound_ems_ambulances", "expected_triage_1_2", "projected_surge_multiplier"],
    strings: ["time_slot"],
    numbers: ["expected_walk_ins", "inbound_ems_ambulances", "expected_triage_1_2", "projected_surge_multiplier"]
  },
  diagnostic_backlog: {
    columns: ["batch_id", "department_id", "test_type", "pending_specimens", "avg_turnaround_mins", "equipment_status", "critical_delay_flag"],
    strings: ["batch_id", "department_id", "test_type", "equipment_status"],
    numbers: ["pending_specimens", "avg_turnaround_mins", "critical_delay_flag"]
  },
  shift_rosters: {
    columns: ["roster_id", "department_id", "shift_type", "nurses_on_duty", "doctors_on_duty", "active_surge_beds", "nurse_to_patient_ratio"],
    strings: ["roster_id", "department_id", "shift_type"],
    numbers: ["nurses_on_duty", "doctors_on_duty", "active_surge_beds", "nurse_to_patient_ratio"]
  }
};

const cloneBuiltInDatasets = () => Object.fromEntries(
  Object.entries(BUILT_IN_DATASETS).map(([name, rows]) => [name, rows.map(row => ({ ...row }))])
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        field += character;
      }
    } else if (afterQuote && (character === "," || character === "\n" || character === "\r")) {
      if (character === ",") {
        row.push(field.trim());
        field = "";
      } else {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(field.trim());
        if (row.some(value => value !== "")) rows.push(row);
        row = [];
        field = "";
      }
      afterQuote = false;
    } else if (afterQuote && /\s/u.test(character)) {
      continue;
    } else if (afterQuote) {
      throw new Error("CSV contains unexpected characters after a quoted field.");
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === '"') {
      throw new Error("CSV contains a quote inside an unquoted field.");
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
    if (field.length > 200) throw new Error("CSV fields may not exceed 200 characters.");
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(value => value !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV must include a header and at least one data row.");
  return rows;
}

function normalizeRows(datasetName, inputRows) {
  const schema = SCHEMAS[datasetName];
  if (!Array.isArray(inputRows) || inputRows.length === 0 || inputRows.length > 10000) {
    throw new Error(`${datasetName} must contain between 1 and 10,000 rows.`);
  }
  return inputRows.map((input, rowIndex) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error(`${datasetName} row ${rowIndex + 1} must be an object.`);
    }
    const result = {};
    for (const column of schema.columns) {
      const value = input[column];
      if (value === undefined || value === null || String(value).trim() === "") {
        throw new Error(`${datasetName} row ${rowIndex + 1} is missing ${column}.`);
      }
      if (schema.strings.includes(column)) {
        const normalized = String(value).trim();
        if (normalized.length > 100 || !/^[\w][\w .:/-]*$/u.test(normalized)) {
          throw new Error(`${datasetName} row ${rowIndex + 1} has an invalid ${column}.`);
        }
        result[column] = normalized;
      } else {
        const numeric = typeof value === "number" ? value : Number(String(value).trim());
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100000) {
          throw new Error(`${datasetName} row ${rowIndex + 1} has an invalid ${column}.`);
        }
        result[column] = numeric;
      }
    }
    if (datasetName === "inbound_surges") {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(result.time_slot) ||
          !Number.isInteger(result.expected_walk_ins) ||
          !Number.isInteger(result.inbound_ems_ambulances) ||
          !Number.isInteger(result.expected_triage_1_2) ||
          result.expected_triage_1_2 > result.expected_walk_ins + result.inbound_ems_ambulances) {
        throw new Error(`${datasetName} row ${rowIndex + 1} has inconsistent surge values.`);
      }
    }
    if (datasetName === "diagnostic_backlog") {
      if (!Number.isInteger(result.pending_specimens) ||
          ![0, 1].includes(result.critical_delay_flag) ||
          !["Operational", "Delayed", "Offline"].includes(result.equipment_status)) {
        throw new Error(`${datasetName} row ${rowIndex + 1} has invalid diagnostic values.`);
      }
    }
    if (datasetName === "shift_rosters") {
      if (!Number.isInteger(result.nurses_on_duty) || !Number.isInteger(result.doctors_on_duty) ||
          !Number.isInteger(result.active_surge_beds) || result.nurse_to_patient_ratio > 1 ||
          !["Day", "Night"].includes(result.shift_type)) {
        throw new Error(`${datasetName} row ${rowIndex + 1} has invalid roster values.`);
      }
    }
    return result;
  });
}

function inferDataset(rows) {
  const columns = Object.keys(rows[0] || {}).sort().join(",");
  return Object.entries(SCHEMAS).find(([, schema]) => schema.columns.slice().sort().join(",") === columns)?.[0];
}

export function sanitizeWorkflowInput(input) {
  const datasets = cloneBuiltInDatasets();
  if (typeof input === "string") {
    const text = input.replace(/^\uFEFF/u, "").trim();
    if (!text || text.length > 1_000_000) throw new Error("Input must be non-empty and no larger than 1 MB.");
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        input = JSON.parse(text);
      } catch {
        throw new Error("JSON input is not valid.");
      }
    } else {
      const rows = parseCsv(text);
      const headers = rows[0].map(header => header.trim());
      if (headers.some(header => !header || header.length > 100) || new Set(headers).size !== headers.length) {
        throw new Error("CSV headers must be non-empty and unique.");
      }
      if (rows.some(values => values.length !== headers.length)) {
        throw new Error("Each CSV row must have the same number of columns as its header.");
      }
      const objects = rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
      const datasetName = inferDataset(objects);
      if (!datasetName) throw new Error("CSV headers do not match a supported hospital dataset.");
      datasets[datasetName] = normalizeRows(datasetName, objects);
      return datasets;
    }
  }
  if (Array.isArray(input)) {
    const datasetName = inferDataset(input);
    if (!datasetName) throw new Error("JSON rows do not match a supported hospital dataset.");
    datasets[datasetName] = normalizeRows(datasetName, input);
    return datasets;
  }
  if (!input || typeof input !== "object") throw new Error("JSON must contain supported hospital dataset rows.");
  const datasetNames = Object.keys(input).filter(name => Object.hasOwn(SCHEMAS, name));
  if (datasetNames.length === 0) throw new Error("JSON must include inbound_surges, diagnostic_backlog, or shift_rosters.");
  for (const name of datasetNames) datasets[name] = normalizeRows(name, input[name]);
  return datasets;
}

function getDiagnosticEscalations(rows) {
  return rows.map(row => {
    let severity = "monitor";
    if (row.critical_delay_flag === 1 || row.avg_turnaround_mins >= 75) severity = "critical";
    else if (row.equipment_status !== "Operational" || row.avg_turnaround_mins >= 45 || row.pending_specimens >= 20) severity = "high";
    const reason = row.equipment_status !== "Operational"
      ? `Equipment is ${row.equipment_status.toLowerCase()}`
      : `${row.pending_specimens} specimens with ${row.avg_turnaround_mins} min average turnaround`;
    return {
      batchId: row.batch_id,
      departmentId: row.department_id,
      testType: row.test_type,
      pendingSpecimens: row.pending_specimens,
      turnaroundMinutes: row.avg_turnaround_mins,
      severity,
      reason,
      action: severity === "critical" ? "Escalate to diagnostic lead and prioritize STAT review"
        : severity === "high" ? "Review queue and rebalance diagnostic capacity"
          : "Continue routine monitoring"
    };
  }).filter(alert => alert.severity !== "monitor");
}

function planNurseRebalancing(rosters, allocations, shiftType) {
  const staffing = rosters.map(roster => {
    const surgeBeds = allocations.find(item => item.departmentId === roster.department_id)?.allocatedBeds || 0;
    const requiredNurses = Math.max(1, Math.ceil(
      (roster.active_surge_beds + (roster.shift_type === shiftType ? surgeBeds : 0)) * roster.nurse_to_patient_ratio
    ));
    return { ...roster, requiredNurses, assignedNurses: roster.nurses_on_duty };
  });
  const transfers = [];
  const donors = staffing
    .filter(roster => roster.shift_type === shiftType)
    .sort((left, right) => (right.assignedNurses - right.requiredNurses) - (left.assignedNurses - left.requiredNurses));
  const recipients = staffing
    .filter(roster => roster.shift_type === shiftType)
    .sort((left, right) => (right.requiredNurses - right.assignedNurses) - (left.requiredNurses - left.assignedNurses));

  for (const recipient of recipients) {
    while (recipient.assignedNurses < recipient.requiredNurses) {
      const donor = donors.find(candidate =>
        candidate.roster_id !== recipient.roster_id &&
        candidate.department_id !== recipient.department_id &&
        candidate.assignedNurses > candidate.requiredNurses
      );
      if (!donor) break;
      donor.assignedNurses -= 1;
      recipient.assignedNurses += 1;
      const nurseNumber = donor.nurses_on_duty - (donor.assignedNurses - donor.requiredNurses) - 1;
      transfers.push({
        fromRoster: donor.roster_id,
        toRoster: recipient.roster_id,
        nurseId: `${donor.roster_id}-N${String(Math.max(1, nurseNumber)).padStart(2, "0")}`
      });
    }
  }
  return {
    assignments: staffing.map(roster => ({
      rosterId: roster.roster_id,
      departmentId: roster.department_id,
      shiftType: roster.shift_type,
      nursesBefore: roster.nurses_on_duty,
      nursesAfter: roster.assignedNurses
    })),
    transfers,
    unfilledNurseNeeds: staffing
      .filter(roster => roster.assignedNurses < roster.requiredNurses)
      .map(roster => ({
        rosterId: roster.roster_id,
        departmentId: roster.department_id,
        nursesNeeded: roster.requiredNurses - roster.assignedNurses
      }))
  };
}

export function runHospitalPipeline(input = BUILT_IN_DATASETS, options = {}) {
  const datasets = sanitizeWorkflowInput(input);
  const departments = options.departments || DEFAULT_DEPARTMENTS;
  const surge = datasets.inbound_surges.reduce((peak, item) =>
    item.expected_walk_ins + item.inbound_ems_ambulances > peak.expected_walk_ins + peak.inbound_ems_ambulances
      ? item : peak
  , { time_slot: "—", expected_walk_ins: 0, inbound_ems_ambulances: 0, expected_triage_1_2: 0, projected_surge_multiplier: 1 });
  const arrivals = surge.expected_walk_ins + surge.inbound_ems_ambulances;
  const criticalArrivals = Math.min(arrivals, surge.expected_triage_1_2);
  const allocations = departments.map(department => {
    const availableBeds = Math.max(0, Math.floor(department.totalBeds - department.activeBeds));
    const estimatedIcuCapacity = Math.max(1, Math.ceil(department.totalBeds * 0.1));
    const estimatedIcuOccupied = Math.min(estimatedIcuCapacity, Math.floor(department.activeBeds * 0.1));
    const availableIcuBeds = Math.min(availableBeds, estimatedIcuCapacity - estimatedIcuOccupied);
    return {
      departmentId: department.id,
      departmentName: department.name,
      availableBeds,
      availableIcuBeds,
      icuAllocated: 0,
      wardAllocated: 0,
      allocatedBeds: 0
    };
  });
  let remainingCritical = criticalArrivals;
  for (const unit of allocations) {
    const allocated = Math.min(remainingCritical, unit.availableIcuBeds);
    unit.icuAllocated += allocated;
    unit.allocatedBeds += allocated;
    remainingCritical -= allocated;
  }
  let remainingWard = arrivals - allocations.reduce((total, unit) => total + unit.icuAllocated, 0);
  for (const unit of allocations) {
    const wardCapacity = unit.availableBeds - unit.icuAllocated;
    const allocated = Math.min(remainingWard, wardCapacity);
    unit.wardAllocated += allocated;
    unit.allocatedBeds += allocated;
    remainingWard -= allocated;
  }
  const allocated = allocations.reduce((total, unit) => total + unit.allocatedBeds, 0);
  const shiftType = Number(surge.time_slot.slice(0, 2)) >= 19 || Number(surge.time_slot.slice(0, 2)) < 7 ? "Night" : "Day";

  return {
    generatedAt: new Date().toISOString(),
    source: options.source || "Bundled operational datasets",
    surge: {
      peakTime: surge.time_slot,
      expectedWalkIns: surge.expected_walk_ins,
      inboundAmbulances: surge.inbound_ems_ambulances,
      expectedArrivals: arrivals,
      expectedCriticalArrivals: criticalArrivals,
      multiplier: surge.projected_surge_multiplier
    },
    bedPlan: {
      allocatedBeds: allocated,
      allocatedIcuBeds: allocations.reduce((total, unit) => total + unit.icuAllocated, 0),
      allocatedWardBeds: allocations.reduce((total, unit) => total + unit.wardAllocated, 0),
      unallocatedArrivals: arrivals - allocated,
      icuCapacityNote: "ICU inventory is not present in the supplied datasets; available ICU beds are estimated at 10% of each department's total bed capacity.",
      departments: allocations
    },
    staffingPlan: planNurseRebalancing(datasets.shift_rosters, allocations, shiftType),
    diagnosticEscalations: getDiagnosticEscalations(datasets.diagnostic_backlog)
  };
}
