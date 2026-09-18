from fastapi.testclient import TestClient
import api

client = TestClient(api.app)

print("--- Testing POST /ai/embed ---")
res_embed = client.post(
    "/ai/embed",
    data={"image_path": "C:/Users/rames/civic-ai-engine/garbbage.webp"}
)
print("Status:", res_embed.status_code)
data_embed = res_embed.json()
print("Success:", data_embed.get("success"))
print("Embedding dimension:", data_embed.get("embedding_dimension"))
assert res_embed.status_code == 200
assert data_embed["embedding_dimension"] == 768

print("\n--- Testing POST /ai/similarity ---")
res_sim = client.post(
    "/ai/similarity",
    data={
        "image_a_path": "C:/Users/rames/civic-ai-engine/garbbage.webp",
        "image_b_path": "C:/Users/rames/civic-ai-engine/garbbage_cropped.webp",
        "threshold": 0.80,
    }
)
print("Status:", res_sim.status_code)
data_sim = res_sim.json()
print("Success:", data_sim.get("success"))
print("Similarity:", data_sim.get("similarity"))
print("Is visually similar:", data_sim.get("is_visually_similar"))
assert res_sim.status_code == 200
assert data_sim["is_visually_similar"] is True

print("\n--- Testing POST /ai/find-duplicates (Legacy payload format) ---")
res_dup_legacy = client.post(
    "/ai/find-duplicates",
    json={
        "query_image_path": "C:/Users/rames/civic-ai-engine/garbbage_cropped.webp",
        "threshold": 0.75,
        "candidates": [
            {
                "id": "101",
                "title": "Garbage dump",
                "image_path": "C:/Users/rames/civic-ai-engine/garbbage.webp"
            },
            {
                "id": "102",
                "title": "Water leak",
                "image_path": "C:/Users/rames/civic-ai-engine/waterleakage.webp"
            }
        ]
    }
)
print("Status:", res_dup_legacy.status_code)
data_dup_legacy = res_dup_legacy.json()
print("Success:", data_dup_legacy.get("success"))
print("Potential match:", data_dup_legacy.get("potential_match"))
assert res_dup_legacy.status_code == 200
assert data_dup_legacy["potential_match"] is True

print("\n--- Testing POST /ai/find-duplicates (Geospatial + Visual payload) ---")
res_dup_geo = client.post(
    "/ai/find-duplicates",
    json={
        "query_image_path": "C:/Users/rames/civic-ai-engine/garbbage_cropped.webp",
        "query_latitude": 13.6291,
        "query_longitude": 79.4194,
        "radius_meters": 100.0,
        "threshold": 0.80,
        "candidates": [
            {
                "id": "101",
                "title": "Garbage near school",
                "image_path": "C:/Users/rames/civic-ai-engine/garbbage.webp",
                "latitude": 13.6288,
                "longitude": 79.4192,
                "status": "OPEN"
            },
            {
                "id": "102",
                "title": "Water leak",
                "image_path": "C:/Users/rames/civic-ai-engine/waterleakage.webp",
                "latitude": 13.6350,
                "longitude": 79.4250,
                "status": "OPEN"
            }
        ]
    }
)
print("Status:", res_dup_geo.status_code)
data_dup_geo = res_dup_geo.json()
print("Success:", data_dup_geo.get("success"))
print("Potential match:", data_dup_geo.get("potential_match"))
top = data_dup_geo["matches"][0]
print(f"Top Match: #{top['problem_id']}, Distance: {top['distance_meters']}m, Similarity: {top['image_similarity']}, Is Duplicate: {top['is_potential_duplicate']}")
assert res_dup_geo.status_code == 200
assert data_dup_geo["potential_match"] is True
assert top["problem_id"] == "101"
assert top["is_potential_duplicate"] is True

print("\n====================================================")
print("ALL BACKWARD COMPATIBILITY TESTS PASSED!")
print("====================================================")
