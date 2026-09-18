import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:3001"

def make_request(path, method="GET", role=None, user_id=None, data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    if role:
        req.add_header("x-user-role", role)
    if user_id:
        req.add_header("x-user-id", user_id)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")

    try:
        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode("utf-8"))
            return res.status, body
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode("utf-8"))
        except Exception:
            pass
        return e.code, body

print("====================================================")
print("FUSIONX PHASE 5: ROLE-BASED ACCESS CONTROL TESTS")
print("====================================================\n")

# Prepare test data: Problem 101 assigned to OFF-001 by Admin
status, assign_res = make_request(
    "/api/admin/problems/101/assign",
    method="POST",
    role="ADMIN",
    user_id="admin-master",
    data={"officer_id": "OFF-001", "remarks": "Assigned for security test"},
)
assert status == 200, f"Setup failed: Admin assignment returned {status}"
print("[SETUP] Problem #101 assigned to Officer 'OFF-001' by Admin.\n")

# 1. Citizen accessing Admin endpoint -> Expect 403 Forbidden
print("[TEST 1] Citizen accessing Admin endpoint (GET /api/admin/dashboard)")
code, body = make_request("/api/admin/dashboard", role="CITIZEN", user_id="citizen-101")
print(f"  HTTP Status: {code} (Expected: 403)")
print(f"  Response: {body.get('error')}")
assert code == 403, f"Expected 403 Forbidden, got {code}"
print("  >>> TEST 1 PASSED: Citizen blocked from Admin endpoint!\n")

# 2. Citizen accessing Officer endpoint -> Expect 403 Forbidden
print("[TEST 2] Citizen accessing Officer inspection endpoint (POST /api/officer/problems/101/inspection)")
code, body = make_request(
    "/api/officer/problems/101/inspection",
    method="POST",
    role="CITIZEN",
    user_id="citizen-101",
    data={"severity": 4},
)
print(f"  HTTP Status: {code} (Expected: 403)")
print(f"  Response: {body.get('error')}")
assert code == 403, f"Expected 403 Forbidden, got {code}"
print("  >>> TEST 2 PASSED: Citizen blocked from Officer endpoint!\n")

# 3. Officer accessing Admin endpoint -> Expect 403 Forbidden
print("[TEST 3] Officer accessing Admin close endpoint (POST /api/admin/problems/101/close)")
code, body = make_request(
    "/api/admin/problems/101/close",
    method="POST",
    role="CIVIC_OFFICER",
    user_id="OFF-001",
    data={"approved": True},
)
print(f"  HTTP Status: {code} (Expected: 403)")
print(f"  Response: {body.get('error')}")
assert code == 403, f"Expected 403 Forbidden, got {code}"
print("  >>> TEST 3 PASSED: Officer blocked from Admin endpoint!\n")

# 4. Officer accessing another officer's problem -> Expect 403 Forbidden
print("[TEST 4] Officer B ('OFF-002') accessing Problem #101 assigned to Officer A ('OFF-001')")
code, body = make_request(
    "/api/officer/problems/101",
    role="CIVIC_OFFICER",
    user_id="OFF-002",
)
print(f"  HTTP Status: {code} (Expected: 403)")
print(f"  Response: {body.get('error')}")
assert code == 403, f"Expected 403 Forbidden, got {code}"
print("  >>> TEST 4 PASSED: Cross-officer unauthorized access blocked!\n")

# 5. Admin accessing Admin endpoint -> Expect 200 OK
print("[TEST 5] Admin accessing Admin dashboard (GET /api/admin/dashboard)")
code, body = make_request("/api/admin/dashboard", role="ADMIN", user_id="admin-master")
print(f"  HTTP Status: {code} (Expected: 200)")
print(f"  Total Active Issues: {body.get('metrics', {}).get('total_active_issues')}")
assert code == 200, f"Expected 200 OK, got {code}"
print("  >>> TEST 5 PASSED: Admin authorized successfully!\n")

# 6. Assigned Officer accessing assigned problem -> Expect 200 OK
print("[TEST 6] Assigned Officer ('OFF-001') accessing assigned problem details (GET /api/officer/problems/101)")
code, body = make_request(
    "/api/officer/problems/101",
    role="CIVIC_OFFICER",
    user_id="OFF-001",
)
print(f"  HTTP Status: {code} (Expected: 200)")
print(f"  Assigned Problem ID: {body.get('task', {}).get('problem_id')}")
assert code == 200, f"Expected 200 OK, got {code}"
print("  >>> TEST 6 PASSED: Assigned officer authorized successfully!\n")

# 7. Citizen accessing Public problem -> Expect 200 OK (sanitized, no internal priority/evidence scores)
print("[TEST 7] Citizen accessing public problem details (GET /api/problems/101)")
code, body = make_request("/api/problems/101", role="CITIZEN", user_id="citizen-101")
print(f"  HTTP Status: {code} (Expected: 200)")
problem_view = body.get("problem", {})
has_priority_analysis = "priority_analysis" in problem_view
has_signals = "signals" in problem_view
has_internal_status = "internal_status" in problem_view
print(f"  Public Status: {problem_view.get('status')}")
print(f"  Contains priority_analysis? {has_priority_analysis} (Expected: False)")
print(f"  Contains raw signals? {has_signals} (Expected: False)")
print(f"  Contains internal_status? {has_internal_status} (Expected: False)")
assert code == 200, f"Expected 200 OK, got {code}"
assert not has_priority_analysis, "Public citizen view leaked priority_analysis!"
assert not has_signals, "Public citizen view leaked internal signals!"
assert not has_internal_status, "Public citizen view leaked internal_status!"
print("  >>> TEST 7 PASSED: Citizen sees public problem with complete administrative privacy!\n")

print("====================================================")
print("ALL ROLE-BASED ACCESS CONTROL TESTS PASSED!")
print("====================================================\n")
