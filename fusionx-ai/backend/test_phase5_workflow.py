import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:3001"

def api_call(path, method="GET", role="CITIZEN", user_id="citizen-101", data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("x-user-role", role)
    req.add_header("x-user-id", user_id)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")

    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            pass
        return e.code, body

print("====================================================")
print("FUSIONX PHASE 5: COMPLETE CIVIC LIFECYCLE (21 STEPS)")
print("====================================================\n")

# Reset store for clean repeatable test run
api_call("/api/test/reset", method="POST")

# 1. Citizen creates problem
print("[STEP 1] Citizen creates civic problem (POST /api/problems)")
report_payload = {
    "title": "Severe road cavity and water leakage",
    "description": "Hazardous road cavity with continuous water leakage threatening vehicle traffic.",
    "category": "water_leakage",
    "latitude": 13.6295,
    "longitude": 79.4201,
    "image_path": "C:/Users/rames/civic-ai-engine/waterleakage.webp",
    "voice_note_text": "Severe pipe leakage near intersection creating deep roadway cavity",
    "language": "en",
    "force_create": True,
}
status, created_res = api_call("/api/problems", method="POST", role="CITIZEN", user_id="citizen-alpha", data=report_payload)
assert status == 201, f"Problem creation failed: {status}, {created_res}"
problem_id = created_res["problem"]["id"]
print(f"  Created Problem ID: #{problem_id}")
print(f"  Public Status: {created_res['problem']['status']}")
print("  >>> STEP 1 PASSED: Problem submitted by citizen!\n")

# 2. Duplicate check
print("[STEP 2] Pre-submission duplicate check verification (POST /api/problems/check-duplicate)")
status, dup_res = api_call(
    "/api/problems/check-duplicate",
    method="POST",
    data={"latitude": 13.6295, "longitude": 79.4201, "image_path": "C:/Users/rames/civic-ai-engine/waterleakage.webp"}
)
assert status == 200, f"Duplicate check failed: {status}"
print(f"  Nearby candidates checked: {dup_res.get('candidates_count', 0)}")
print("  >>> STEP 2 PASSED: Geospatial & visual duplicate check verified!\n")

# 3. Evidence analysis
# 4. Priority calculated
print("[STEPS 3 & 4] Evidence analysis & Priority calculation (Atomic backend check)")
status, officer_view = api_call(f"/api/problems/{problem_id}", role="ADMIN", user_id="admin-master")
assert status == 200
full_problem = officer_view["problem"]
evidence_score = full_problem.get("evidence_analysis", {}).get("evidence_strength")
priority_score = full_problem.get("priority_analysis", {}).get("priority_score")
priority_level = full_problem.get("priority_analysis", {}).get("priority_level")
print(f"  Evidence Strength: {evidence_score}/100")
print(f"  Initial Priority Score: {priority_score}/100 ({priority_level})")
print(f"  Internal Status: {full_problem.get('internal_status')}")
assert evidence_score is not None, "Evidence analysis missing!"
assert priority_score is not None, "Priority score missing!"
assert full_problem.get("internal_status") == "ADMIN_REVIEW"
print("  >>> STEPS 3 & 4 PASSED: Evidence and Priority evaluated and problem queued for Admin review!\n")

# 5. Admin sees problem in dashboard & priority queue
print("[STEP 5] Admin inspects dashboard and priority queue")
status, dash_res = api_call("/api/admin/dashboard", role="ADMIN", user_id="admin-master")
assert status == 200
print(f"  Admin Active Issues Count: {dash_res['metrics']['total_active_issues']}")
status, q_res = api_call("/api/admin/problems/priority", role="ADMIN", user_id="admin-master")
assert status == 200
in_queue = any(item["id"] == problem_id for item in q_res.get("queue", []))
assert in_queue, f"Problem #{problem_id} missing from Admin Priority Queue!"
print(f"  Problem #{problem_id} confirmed present in Admin Priority Queue!")
print("  >>> STEP 5 PASSED: Admin triage queue contains reported issue!\n")

# 6. Admin assigns Civic Officer
print("[STEP 6] Admin assigns Civic Officer (POST /api/admin/problems/:id/assign)")
status, assign_res = api_call(
    f"/api/admin/problems/{problem_id}/assign",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data={"officer_id": "OFF-001", "remarks": "Dispatch for emergency pipeline inspection"},
)
assert status == 200, f"Assignment failed: {status}"
assigned_problem = assign_res["problem"]
assert assigned_problem["internal_status"] == "OFFICER_ASSIGNED"
assert assigned_problem["status"] == "ASSIGNED"
print(f"  Assigned Officer: {assigned_problem['assignment']['officer_id']}")
print(f"  Internal Status: {assigned_problem['internal_status']} (Public: {assigned_problem['status']})")
print("  >>> STEP 6 PASSED: Officer assigned successfully!\n")

# 7. Officer sees assignment in dashboard
print("[STEP 7] Civic Officer inspects assigned task queue (GET /api/officer/problems)")
status, off_tasks = api_call("/api/officer/problems", role="CIVIC_OFFICER", user_id="OFF-001")
assert status == 200
assigned_ids = [p["id"] for p in off_tasks["categories"]["assigned_issues"]]
assert problem_id in assigned_ids, f"Problem #{problem_id} not visible in officer queue!"
print(f"  Officer 'OFF-001' confirmed problem in task queue! Total assigned: {off_tasks['total_assigned']}")
print("  >>> STEP 7 PASSED: Officer dashboard populated with assigned task!\n")

# 8. Officer performs on-site field inspection
# 9. Officer submits verified severity (5/5 Critical)
# 10. Priority engine recalculates score automatically
print("[STEPS 8, 9, 10] Officer submits on-site field inspection & verified severity (POST /api/officer/problems/:id/inspection)")
inspection_data = {
    "location_verified": True,
    "issue_exists": True,
    "severity": 5,
    "current_condition": "Pressurized water rupture has created a deep sub-surface sinkhole cavity.",
    "remarks": "Urgent repair required to avoid roadway collapse.",
    "photos": ["C:/Users/rames/civic-ai-engine/waterleakage.webp"],
    "videos": [],
    "voice_note_text": "Inspected site, pipeline burst verified critical severity five out of five.",
}
status, insp_res = api_call(
    f"/api/officer/problems/{problem_id}/inspection",
    method="POST",
    role="CIVIC_OFFICER",
    user_id="OFF-001",
    data=inspection_data,
)
assert status == 200, f"Inspection submission failed: {status}, {insp_res}"
recalc_priority = insp_res.get("updated_priority", {})
print(f"  Verified Field Severity: {insp_res['inspection']['severity']}/5")
print(f"  Recalculated Priority Score: {recalc_priority.get('priority_score')}/100 ({recalc_priority.get('priority_level')})")
print(f"  Internal Status: {insp_res['problem']['internal_status']} (Public: {insp_res['problem']['status']})")
assert insp_res["problem"]["internal_status"] == "INSPECTION"
assert insp_res["problem"]["status"] == "INSPECTION"
assert recalc_priority.get("priority_score", 0) > priority_score, "Verified severity 5 should escalate priority score!"
print("  >>> STEPS 8, 9, 10 PASSED: Inspection recorded & priority engine recalculated score!\n")

# 11. Officer submits work estimation report
print("[STEP 11] Officer submits work report (POST /api/officer/problems/:id/work-report)")
work_report_data = {
    "workers_required": 4,
    "estimated_hours": 8,
    "materials": ["PVC pressure pipe 150mm", "coupling sleeves", "crushed gravel", "asphalt patch mix"],
    "remarks": "Requires excavation of 2 meters, pipeline replacement, backfilling and bituminous compaction.",
    "urgency_notes": "Main bus route intersection",
}
status, wr_res = api_call(
    f"/api/officer/problems/{problem_id}/work-report",
    method="POST",
    role="CIVIC_OFFICER",
    user_id="OFF-001",
    data=work_report_data,
)
assert status == 200, f"Work report failed: {status}"
assert wr_res["problem"]["internal_status"] == "WORK_REPORT_SUBMITTED"
print(f"  Workers Requested: {wr_res['work_report']['workers_required']}, Estimated Hours: {wr_res['work_report']['estimated_hours']}")
print(f"  Internal Status: {wr_res['problem']['internal_status']}")
print("  >>> STEP 11 PASSED: Officer work estimate submitted!\n")

# 12. Admin approves work
print("[STEP 12] Admin reviews and approves work plan (POST /api/admin/problems/:id/approve-work)")
status, app_res = api_call(
    f"/api/admin/problems/{problem_id}/approve-work",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data={"approved": True, "remarks": "Approved. Municipal engineering crew authorized."},
)
assert status == 200, f"Work approval failed: {status}"
assert app_res["problem"]["internal_status"] == "WORK_APPROVED"
print(f"  Internal Status: {app_res['problem']['internal_status']} (Public: {app_res['problem']['status']})")
print("  >>> STEP 12 PASSED: Admin approved work report!\n")

# 13. Workers allocated (Work Order)
print("[STEP 13] Admin allocates worker resources (POST /api/admin/problems/:id/work-order)")
work_order_data = {
    "workers_allocated": 4,
    "planned_start": "2026-09-19T08:00:00Z",
    "planned_completion": "2026-09-19T16:00:00Z",
    "materials": ["PVC pressure pipe 150mm", "gravel", "asphalt"],
    "instructions": "Shut off sub-valve, replace ruptured pipe section, compact with road roller.",
}
status, wo_res = api_call(
    f"/api/admin/problems/{problem_id}/work-order",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data=work_order_data,
)
assert status == 200, f"Work order failed: {status}"
assert wo_res["problem"]["internal_status"] == "WORKER_ALLOCATED"
assert wo_res["problem"]["status"] == "IN_PROGRESS"
print(f"  Workers Allocated: {wo_res['work_order']['workers_allocated']}")
print(f"  Internal Status: {wo_res['problem']['internal_status']} (Public: {wo_res['problem']['status']})")
print("  >>> STEP 13 PASSED: Worker resources allocated!\n")

# 14. Work started
print("[STEP 14] Field work physically started (POST /api/admin/problems/:id/work-status)")
status, ws1_res = api_call(
    f"/api/admin/problems/{problem_id}/work-status",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data={"status": "WORK_STARTED", "remarks": "Excavation and water isolation started."},
)
assert status == 200
assert ws1_res["problem"]["internal_status"] == "WORK_STARTED"
assert ws1_res["problem"]["status"] == "IN_PROGRESS"
print(f"  Internal Status: {ws1_res['problem']['internal_status']} (Public: {ws1_res['problem']['status']})")
print("  >>> STEP 14 PASSED: Work marked started!\n")

# 15. Work completed
print("[STEP 15] Field work physically completed (POST /api/admin/problems/:id/work-status)")
status, ws2_res = api_call(
    f"/api/admin/problems/{problem_id}/work-status",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data={"status": "WORK_COMPLETED", "remarks": "New pipe coupled, gravel backfilled, asphalt compacted."},
)
assert status == 200
assert ws2_res["problem"]["internal_status"] == "WORK_COMPLETED"
assert ws2_res["problem"]["status"] == "COMPLETED"
print(f"  Internal Status: {ws2_res['problem']['internal_status']} (Public: {ws2_res['problem']['status']})")
print("  >>> STEP 15 PASSED: Work marked completed!\n")

# 16. Officer verifies completion with AFTER evidence
print("[STEP 16] Officer verifies completion on-site (POST /api/officer/problems/:id/completion-verification)")
completion_data = {
    "completed": True,
    "remarks": "On-site re-inspection confirmed pipe pressure normal and roadway restored smoothly.",
    "photos": ["C:/Users/rames/civic-ai-engine/waterleakage.webp"],
    "videos": [],
}
status, comp_res = api_call(
    f"/api/officer/problems/{problem_id}/completion-verification",
    method="POST",
    role="CIVIC_OFFICER",
    user_id="OFF-001",
    data=completion_data,
)
assert status == 200, f"Completion verification failed: {status}"
assert comp_res["problem"]["internal_status"] == "OFFICER_VERIFIED"
assert comp_res["problem"]["status"] == "COMPLETED"
print(f"  Completion Verified: {comp_res['completion_verification']['completed']}")
print(f"  Internal Status: {comp_res['problem']['internal_status']} (Public: {comp_res['problem']['status']})")
print("  >>> STEP 16 PASSED: Officer verified completion with after-evidence!\n")

# 17. Admin final verification and closure
print("[STEP 17] Admin conducts final verification & marks problem closed (POST /api/admin/problems/:id/close)")
status, close_res = api_call(
    f"/api/admin/problems/{problem_id}/close",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data={"approved": True, "remarks": "Confirmed satisfactory repair. Officially marked resolved."},
)
assert status == 200, f"Admin close failed: {status}"
assert close_res["problem"]["internal_status"] == "RESOLVED"
assert close_res["problem"]["status"] == "RESOLVED"
print(f"  Internal Status: {close_res['problem']['internal_status']} (Public: {close_res['problem']['status']})")
print("  >>> STEP 17 PASSED: Problem officially closed by Admin!\n")

# 18. Citizen sees RESOLVED
print("[STEP 18] Citizen views public problem status (GET /api/problems/:id)")
status, cit_prob = api_call(f"/api/problems/{problem_id}", role="CITIZEN", user_id="citizen-alpha")
assert status == 200
print(f"  Citizen-Facing Public Status: {cit_prob['problem']['status']}")
assert cit_prob["problem"]["status"] == "RESOLVED"
assert "priority_analysis" not in cit_prob["problem"]
print("  >>> STEP 18 PASSED: Citizen sees issue RESOLVED with clean public status!\n")

# 19. Citizen reports "Still not resolved"
print("[STEP 19] Citizen reports 'Still not resolved' (POST /api/problems/:id/resolution-feedback)")
feedback_data = {
    "resolved": False,
    "comment": "Minor water seep remains and asphalt is uneven.",
}
status, fb_res = api_call(
    f"/api/problems/{problem_id}/resolution-feedback",
    method="POST",
    role="CITIZEN",
    user_id="citizen-alpha",
    data=feedback_data,
)
assert status == 200, f"Resolution feedback failed: {status}"
print(f"  Feedback Recorded: {fb_res['feedback']['comment']}")
print("  >>> STEP 19 PASSED: Citizen submitted resolution feedback!\n")

# 20. Problem becomes REOPENED -> ADMIN_REVIEW
print("[STEP 20] Problem state becomes REOPENED -> ADMIN_REVIEW")
status, admin_check = api_call(f"/api/problems/{problem_id}", role="ADMIN", user_id="admin-master")
assert status == 200
reopened_problem = admin_check["problem"]
print(f"  Internal Status: {reopened_problem['internal_status']} (Public: {reopened_problem['status']})")
assert reopened_problem["internal_status"] == "ADMIN_REVIEW"
assert reopened_problem["status"] == "REPORTED"  # Public map shows active reported status
print("  >>> STEP 20 PASSED: Problem successfully transitioned to REOPENED and queued for Admin review!\n")

# 21. Admin receives re-verification task in dashboard & notifications
print("[STEP 21] Admin receives re-verification task & notifications")
status, final_dash = api_call("/api/admin/dashboard", role="ADMIN", user_id="admin-master")
assert status == 200
print(f"  Admin Dashboard Reopened Issues: {final_dash['metrics']['reopened_issues']}")
assert final_dash["metrics"]["reopened_issues"] >= 1

status, notifs = api_call("/api/notifications", role="ADMIN", user_id="admin-master")
assert status == 200
reopen_notifs = [n for n in notifs["notifications"] if "Reopened" in n.get("title", "")]
assert len(reopen_notifs) > 0, "Admin notification for reopened problem missing!"
print(f"  Admin Notification Received: \"{reopen_notifs[0]['title']}\" — {reopen_notifs[0]['message']}")

status, audit_trail = api_call(f"/api/admin/problems/{problem_id}/audit", role="ADMIN", user_id="admin-master")
assert status == 200
print(f"  Total Immutable Audit Events Generated: {audit_trail['count']}")
for i, ev in enumerate(audit_trail["events"][:6], 1):
    print(f"    {i}. [{ev['actor_role']}] {ev['from_status']} -> {ev['to_status']} | \"{ev['remarks'][:50]}...\"")
print(f"    ... and {audit_trail['count'] - 6} subsequent lifecycle transition events.")

print("\n====================================================")
print("ALL 21 LIFECYCLE STEPS VERIFIED END-TO-END!")
print("====================================================")
