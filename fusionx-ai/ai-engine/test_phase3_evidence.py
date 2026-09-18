import os
import sys
from pathlib import Path

# Add project root to sys.path
ai_root = Path(__file__).resolve().parent
sys.path.insert(0, str(ai_root))

from services.evidence_service import evaluate_evidence_strength

print("====================================================")
print("FUSIONX PHASE 3: MULTIMODAL EVIDENCE STRENGTH TESTS")
print("====================================================\n")

# Available test images
img_leak = "C:/Users/rames/civic-ai-engine/waterleakage.webp"
img_pothole = "C:/Users/rames/civic-ai-engine/garbbage.webp"  # actual visual content is a sidewalk hole/pothole
img_streetlight = "C:/Users/rames/civic-ai-engine/brlit.jpg"
img_missing = "C:/Users/rames/civic-ai-engine/non_existent_image.png"

# --- TEST A: Consistent Evidence ---
print("[TEST A] Consistent Evidence (Water leakage text + Water leakage image)")
res_a = evaluate_evidence_strength(
    text="Water leakage from broken pipeline causing water to flow across the road",
    image_path=img_leak,
)
print(f"  Evidence Strength: {res_a['evidence_strength']}/100 ({res_a['interpretation']})")
print(f"  Text Category: {res_a['text_category']} | Visual Category: {res_a['visual_category']}")
print(f"  BLIP Caption: \"{res_a['blip_caption']}\"")
print(f"  Signals: {res_a['signals']}")
print("  Explanations:")
for exp in res_a["explanation"]:
    print(f"    - {exp}")

assert res_a["evidence_strength"] >= 65, "Test A should have strong evidence score"
print("  >>> TEST A PASSED: Consistent evidence produced strong score!\n")


# --- TEST B: Inconsistent Evidence ---
print("[TEST B] Inconsistent Evidence (Broken streetlight text + Water leakage image)")
res_b = evaluate_evidence_strength(
    text="Broken streetlight pole leaning dangerously over the road at night",
    image_path=img_leak,
)
print(f"  Evidence Strength: {res_b['evidence_strength']}/100 ({res_b['interpretation']})")
print(f"  Text Category: {res_b['text_category']} | Visual Category: {res_b['visual_category']}")
print(f"  BLIP Caption: \"{res_b['blip_caption']}\"")
print(f"  Signals: {res_b['signals']}")
print("  Explanations:")
for exp in res_b["explanation"]:
    print(f"    - {exp}")

assert res_b["evidence_strength"] < res_a["evidence_strength"], "Test B score must be significantly lower than Test A"
print(f"  >>> TEST B PASSED: Inconsistent evidence ({res_b['evidence_strength']}/100) < Consistent evidence ({res_a['evidence_strength']}/100)!\n")


# --- TEST C: Broken Streetlight ---
print("[TEST C] Broken Streetlight Incident (Streetlight text + Streetlight image)")
res_c = evaluate_evidence_strength(
    text="Broken streetlight with wires and shoes hanging from the lamp post",
    image_path=img_streetlight,
)
print(f"  Evidence Strength: {res_c['evidence_strength']}/100 ({res_c['interpretation']})")
print(f"  Text Category: {res_c['text_category']} | Visual Category: {res_c['visual_category']}")
print(f"  BLIP Caption: \"{res_c['blip_caption']}\"")
print(f"  Signals: {res_c['signals']}")
print("  Explanations:")
for exp in res_c["explanation"]:
    print(f"    - {exp}")

assert res_c["evidence_strength"] >= 65, "Test C should have strong evidence score"
print("  >>> TEST C PASSED: Streetlight signals evaluated cleanly with high evidence strength!\n")


# --- TEST D: Missing / Invalid Image ---
print("[TEST D] Missing / Invalid Image Handling")
res_d = evaluate_evidence_strength(
    text="Large pothole near school gate causing traffic issues",
    image_path=img_missing,
)
print(f"  Evidence Strength: {res_d['evidence_strength']}/100 ({res_d['interpretation']})")
print(f"  Signals: {res_d['signals']}")
print("  Explanations:")
for exp in res_d["explanation"]:
    print(f"    - {exp}")

assert res_d["evidence_strength"] <= 20, "Test D without valid image must yield very low evidence"
print("  >>> TEST D PASSED: Missing image handled safely without crashing!\n")


print("====================================================")
print("ALL PHASE 3 EVIDENCE STRENGTH TESTS COMPLETED!")
print("====================================================")
