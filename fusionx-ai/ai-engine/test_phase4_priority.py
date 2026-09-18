import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root to sys.path
ai_root = Path(__file__).resolve().parent
sys.path.insert(0, str(ai_root))

from services.priority_service import calculate_priority

print("====================================================")
print("FUSIONX PHASE 4: PRIORITY ENGINE COMPREHENSIVE TESTS")
print("====================================================\n")

now = datetime.now(timezone.utc)

# --- TEST A: Critical Problem ---
print("[TEST A] Critical Problem (Max Severity, High Evidence, Heavy Support, High Criticality, Old Unresolved)")
res_a = calculate_priority(
    severity=5,
    evidence_strength=90.0,
    support_count=20,
    criticality="high",
    created_at=(now - timedelta(days=35)).isoformat(),
    recent_supports=10,
)
print(f"  Priority Score: {res_a['priority_score']}/100 ({res_a['priority_level']})")
print(f"  Signals: {res_a['signals']}")
print("  Explanations:")
for exp in res_a["explanation"]:
    print(f"    - {exp}")

assert res_a["priority_score"] >= 80, f"Expected CRITICAL (>=80), got {res_a['priority_score']}"
assert res_a["priority_level"] == "CRITICAL"
print("  >>> TEST A PASSED: Critical issue received top-tier priority!\n")


# --- TEST B: Low Severity Problem ---
print("[TEST B] Low Severity Problem (Severity=1, Modest Evidence, 1 Supporter, Low Criticality, 1 Day Old)")
res_b = calculate_priority(
    severity=1,
    evidence_strength=40.0,
    support_count=1,
    criticality="low",
    created_at=(now - timedelta(days=1)).isoformat(),
    recent_supports=0,
)
print(f"  Priority Score: {res_b['priority_score']}/100 ({res_b['priority_level']})")
print(f"  Signals: {res_b['signals']}")
print("  Explanations:")
for exp in res_b["explanation"]:
    print(f"    - {exp}")

assert res_b["priority_score"] <= 35, f"Expected LOW (<=35), got {res_b['priority_score']}"
assert res_b["priority_level"] in ["LOW", "VERY LOW"]
print("  >>> TEST B PASSED: Low severity issue received low priority!\n")


# --- TEST C: High Severity but Weak Evidence ---
print("[TEST C] High Severity but Weak Evidence (Severity=5, Evidence=20, Support=2, Criticality=Medium)")
res_c = calculate_priority(
    severity=5,
    evidence_strength=20.0,
    support_count=2,
    criticality="medium",
    created_at=(now - timedelta(days=5)).isoformat(),
    recent_supports=0,
)
print(f"  Priority Score: {res_c['priority_score']}/100 ({res_c['priority_level']})")
print(f"  Signals: {res_c['signals']}")

# Compare with full evidence counter-part
res_c_strong_evi = calculate_priority(
    severity=5,
    evidence_strength=90.0,
    support_count=2,
    criticality="medium",
    created_at=(now - timedelta(days=5)).isoformat(),
    recent_supports=0,
)
print(f"  Score with Weak Evidence (20/100): {res_c['priority_score']}")
print(f"  Score with Strong Evidence (90/100): {res_c_strong_evi['priority_score']}")

assert res_c["priority_score"] < res_c_strong_evi["priority_score"], "Weak evidence should decrease final priority"
assert res_c["priority_score"] > res_b["priority_score"], "High severity should keep score higher than low-severity issue"
print("  >>> TEST C PASSED: Evidence affects score without completely erasing high physical severity!\n")


# --- TEST D: Many Supporters Impact ---
print("[TEST D] Community Support Impact (Severity=3, Evidence=70, Support=20 vs Support=0)")
res_d_high_sup = calculate_priority(
    severity=3,
    evidence_strength=70.0,
    support_count=20,
    criticality="medium",
    created_at=(now - timedelta(days=10)).isoformat(),
    recent_supports=5,
)
res_d_zero_sup = calculate_priority(
    severity=3,
    evidence_strength=70.0,
    support_count=0,
    criticality="medium",
    created_at=(now - timedelta(days=10)).isoformat(),
    recent_supports=0,
)
print(f"  Score with 20 Supporters: {res_d_high_sup['priority_score']}/100 ({res_d_high_sup['priority_level']})")
print(f"  Score with 0 Supporters:  {res_d_zero_sup['priority_score']}/100 ({res_d_zero_sup['priority_level']})")
diff_sup = res_d_high_sup["priority_score"] - res_d_zero_sup["priority_score"]
print(f"  Priority Boost from Community Support: +{diff_sup} points")

assert diff_sup >= 18, "Support count up to cap (20) should provide significant priority boost"
print("  >>> TEST D PASSED: Community endorsement demonstrably escalates problem prioritization!\n")


# --- TEST E: Old Unresolved Problem ---
print("[TEST E] Duration Escalation (Unresolved 35 Days vs Unresolved 1 Day)")
res_e_old = calculate_priority(
    severity=3,
    evidence_strength=70.0,
    support_count=3,
    criticality="low",
    created_at=(now - timedelta(days=35)).isoformat(),
    recent_supports=0,
)
res_e_new = calculate_priority(
    severity=3,
    evidence_strength=70.0,
    support_count=3,
    criticality="low",
    created_at=(now - timedelta(days=1)).isoformat(),
    recent_supports=0,
)
print(f"  Score after 35 Days: {res_e_old['priority_score']}/100")
print(f"  Score after 1 Day:   {res_e_new['priority_score']}/100")
diff_dur = res_e_old["priority_score"] - res_e_new["priority_score"]
print(f"  Priority Gain from Aging Duration: +{diff_dur} points")

assert res_e_old["priority_score"] > res_e_new["priority_score"], "Aging unresolved problems must gain priority"
print("  >>> TEST E PASSED: Older unresolved problems receive gradual duration escalation!\n")


# --- TEST F: Missing Optional Data ---
print("[TEST F] Missing Optional Data (None for Severity, Evidence, Landmark, and Dates)")
res_f = calculate_priority(
    severity=None,
    evidence_strength=None,
    support_count=0,
    criticality=None,
    created_at=None,
    recent_supports=None,
)
print(f"  Priority Score: {res_f['priority_score']}/100 ({res_f['priority_level']})")
print(f"  Signals: {res_f['signals']}")
print("  Explanations:")
for exp in res_f["explanation"]:
    print(f"    - {exp}")

assert 0 <= res_f["priority_score"] <= 100
assert res_f["signals"]["severity"] == 0.60  # default moderate baseline
assert res_f["signals"]["evidence"] == 0.50  # neutral baseline
print("  >>> TEST F PASSED: Transparent baselines handled gracefully without crashing!\n")


# --- TEST G: Edge Cases & Boundary Clamping ---
print("[TEST G] Extreme Edge Cases (Negative numbers, out-of-range inputs, future dates)")
res_g1 = calculate_priority(
    severity=999,           # exceeds 5
    evidence_strength=250,  # exceeds 100
    support_count=-15,      # negative
    criticality=5.5,        # exceeds 1.0
    created_at="invalid-date-string",
    recent_supports=-5,     # negative
)
print(f"  Over-range Input Clamped Score: {res_g1['priority_score']}/100")
assert 0 <= res_g1["priority_score"] <= 100
assert res_g1["signals"]["severity"] == 1.0  # clamped to 5/5
assert res_g1["signals"]["evidence"] == 1.0  # clamped to 100/100
assert res_g1["signals"]["community"] == 0.0 # clamped from negative to 0

res_g2 = calculate_priority(
    severity=-10,           # sub-1
    evidence_strength=-80,  # negative
    support_count=-100,
    criticality=-1.0,
    created_at=(now + timedelta(days=10)).isoformat(), # future date
)
print(f"  Under-range Input Clamped Score: {res_g2['priority_score']}/100")
assert 0 <= res_g2["priority_score"] <= 100
assert res_g2["signals"]["severity"] == 0.20  # clamped to 1/5
assert res_g2["signals"]["evidence"] == 0.0   # clamped to 0
assert res_g2["signals"]["duration"] == 0.0   # future date clamped to 0 days
print("  >>> TEST G PASSED: Strict boundary clamping enforced across all signals!\n")


print("====================================================")
print("ALL PHASE 4 PRIORITY ENGINE TESTS PASSED!")
print("====================================================")
