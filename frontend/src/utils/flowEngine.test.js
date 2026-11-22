import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_DATASETS,
  runHospitalPipeline,
  sanitizeWorkflowInput
} from "./flowEngine.js";

test("sanitizes a supported CSV and retains bundled fallback datasets", () => {
  const csv = [
    "time_slot,expected_walk_ins,inbound_ems_ambulances,expected_triage_1_2,projected_surge_multiplier",
    "20:00,10,2,3,1.25"
  ].join("\n");
  const data = sanitizeWorkflowInput(csv);

  assert.deepEqual(data.inbound_surges, [{
    time_slot: "20:00",
    expected_walk_ins: 10,
    inbound_ems_ambulances: 2,
    expected_triage_1_2: 3,
    projected_surge_multiplier: 1.25
  }]);
  assert.equal(data.shift_rosters.length, BUILT_IN_DATASETS.shift_rosters.length);
});

test("sanitizes JSON dataset overrides without mutating built-in data", () => {
  const data = sanitizeWorkflowInput(JSON.stringify({
    diagnostic_backlog: [{
      batch_id: "B_900",
      department_id: "D01",
      test_type: "STAT Troponin",
      pending_specimens: 2,
      avg_turnaround_mins: 12.5,
      equipment_status: "Operational",
      critical_delay_flag: 0
    }]
  }));

  assert.equal(data.diagnostic_backlog[0].avg_turnaround_mins, 12.5);
  assert.equal(data.inbound_surges.length, BUILT_IN_DATASETS.inbound_surges.length);
  assert.equal(BUILT_IN_DATASETS.diagnostic_backlog[0].batch_id, "B_101");
});

test("rejects malformed, oversized, and unsafe workflow inputs", () => {
  assert.throws(() => sanitizeWorkflowInput("not a supported dataset"), /CSV must include/u);
  assert.throws(() => sanitizeWorkflowInput(
    'time_slot,expected_walk_ins,inbound_ems_ambulances,expected_triage_1_2,projected_surge_multiplier\n"14:00"x,1,1,0,1'
  ), /unexpected characters after a quoted field/u);
  assert.throws(() => sanitizeWorkflowInput("x".repeat(1_000_001)), /1 MB/u);
  assert.throws(() => sanitizeWorkflowInput(JSON.stringify({
    shift_rosters: [{
      roster_id: "R_1",
      department_id: "D01",
      shift_type: "Day",
      nurses_on_duty: -1,
      doctors_on_duty: 2,
      active_surge_beds: 4,
      nurse_to_patient_ratio: 0.2
    }]
  })), /invalid nurses_on_duty/u);
});

test("allocates beds within capacity and reports all unmet peak arrivals", () => {
  const report = runHospitalPipeline();
  const totalCapacity = report.bedPlan.departments.reduce((sum, unit) => sum + unit.availableBeds, 0);

  assert.equal(report.surge.peakTime, "18:00");
  assert.equal(report.surge.expectedArrivals, 40);
  assert.ok(report.bedPlan.allocatedBeds <= totalCapacity);
  assert.equal(report.bedPlan.allocatedBeds + report.bedPlan.unallocatedArrivals, report.surge.expectedArrivals);
  assert.equal(
    report.bedPlan.allocatedIcuBeds + report.bedPlan.allocatedWardBeds,
    report.bedPlan.allocatedBeds
  );
  assert.ok(report.bedPlan.allocatedIcuBeds <= report.surge.expectedCriticalArrivals);
});

test("rebalances nurses without duplicate assignments or donor understaffing", () => {
  const report = runHospitalPipeline();
  const transferIds = report.staffingPlan.transfers.map(transfer => transfer.nurseId);

  assert.equal(new Set(transferIds).size, transferIds.length);
  assert.deepEqual(report.staffingPlan.unfilledNurseNeeds, []);
  for (const assignment of report.staffingPlan.assignments) {
    assert.ok(assignment.nursesAfter >= 0);
    if (assignment.nursesAfter < assignment.nursesBefore) {
      const roster = BUILT_IN_DATASETS.shift_rosters.find(item => item.roster_id === assignment.rosterId);
      const required = Math.max(1, Math.ceil(
        (roster.active_surge_beds + (roster.shift_type === "Day"
          ? report.bedPlan.departments.find(item => item.departmentId === roster.department_id).allocatedBeds
          : 0)) * roster.nurse_to_patient_ratio
      ));
      assert.ok(assignment.nursesAfter >= required);
    }
  }
  assert.ok(report.staffingPlan.transfers.every(transfer => transfer.fromRoster !== transfer.toRoster));
});

test("escalates critical diagnostic delays with actionable recommendations", () => {
  const report = runHospitalPipeline();
  const critical = report.diagnosticEscalations.find(alert => alert.batchId === "B_101");
  const delayedEquipment = report.diagnosticEscalations.find(alert => alert.batchId === "B_103");

  assert.equal(critical.severity, "critical");
  assert.match(critical.action, /Escalate/u);
  assert.equal(delayedEquipment.severity, "critical");
  assert.ok(report.diagnosticEscalations.every(alert => alert.severity === "critical" || alert.severity === "high"));
});
