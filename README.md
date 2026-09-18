# FUSIONX 1.0 — Transparent AI-Assisted Civic Lifecycle Management System

**FUSIONX** is a civic problem management and lifecycle resolution platform featuring multi-modal AI verification, duplicate detection, transparent priority ranking, and role-based operational workflows.

---

## 🏛️ Architecture Overview

```
                         FUSIONX 1.0
        AI-BASED CIVIC PROBLEM MANAGEMENT ENGINE
                              │
                    ┌─────────▼─────────┐
                    │  React / Vite UI  │
                    │   Role-Based UI   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Express Gateway  │
                    │  (Port 3001)      │
                    │  Role Auth & SLA  │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌───────────────────┐           ┌───────────────────┐
    │  FastAPI Engine   │           │ In-Memory Stores  │
    │  (Port 8000)      │           │ - Problems        │
    │ - DINOv2 Base     │           │ - Audit Events    │
    │ - BART Large MNLI │           │ - Work Orders     │
    │ - CLIP ViT-B/32   │           │ - Inspections     │
    │ - YOLOv11 Nano    │           │ - Feedback        │
    │ - BLIP Captioning │           │ - Notifications   │
    └───────────────────┘           └───────────────────┘
```

---

## 🚀 Key Completed Phases

### 🔹 Phase 1: DINOv2 Image Embeddings & Similarity
* Pre-trained `facebook/dinov2-base` extracting 768-dimensional normalized visual embeddings.
* Pairwise cosine similarity calculation for visual incident comparison.

### 🔹 Phase 2: GPS Radius + DINOv2 Duplicate Detection
* Haversine formula geospatial distance calculation (`DUPLICATE_RADIUS_METERS = 100`).
* Dual-criteria potential duplicate detection (within $100$m radius AND DINOv2 visual similarity $\ge 0.80$).
* Citizen endorsement flow: `"I'm Affected"`.

### 🔹 Phase 3: Multimodal Evidence Strength Score
* Weighted multimodal consistency engine ($0–100$):
  * **Category Consistency (40%)**: Cross-verifies BART zero-shot text classification with CLIP zero-shot image classification.
  * **Caption Consistency (25%)**: Cross-verifies BLIP generated image captions against reported category semantics.
  * **Object Evidence (20%)**: YOLOv11 foreground civic object detection.
  * **Image Validity (15%)**: Image integrity and accessibility verification.

### 🔹 Phase 4: Transparent AI-Assisted Priority Engine
* Deterministic, explainable civic priority scoring formula ($0–100$):
  $$\text{Priority Score} = 100 \times \left(0.30 \cdot s_{\text{sev}} + 0.20 \cdot s_{\text{evi}} + 0.20 \cdot s_{\text{com}} + 0.15 \cdot s_{\text{cri}} + 0.10 \cdot s_{\text{dur}} + 0.05 \cdot s_{\text{gro}}\right)$$
* Queue Levels: `CRITICAL` ($80–100$), `HIGH` ($60–79$), `MEDIUM` ($40–59$), `LOW` ($20–39$), `VERY LOW` ($0–19$).
* Admin Priority Queue endpoint: `GET /api/admin/problems/priority`.

### 🔹 Phase 5: Role-Based Civic Workflow & Backend Lifecycle
* **Three Strict Roles**: `CITIZEN`, `ADMIN`, `CIVIC_OFFICER`.
* **State Machine**: `REPORTED` $\rightarrow$ `AI_ANALYZED` $\rightarrow$ `ADMIN_REVIEW` $\rightarrow$ `OFFICER_ASSIGNED` $\rightarrow$ `INSPECTION` $\rightarrow$ `WORK_REPORT_SUBMITTED` $\rightarrow$ `WORK_APPROVED` $\rightarrow$ `WORKER_ALLOCATED` $\rightarrow$ `WORK_STARTED` $\rightarrow$ `WORK_IN_PROGRESS` $\rightarrow$ `WORK_COMPLETED` $\rightarrow$ `OFFICER_VERIFIED` $\rightarrow$ `ADMIN_CLOSED` $\rightarrow$ `RESOLVED` $\rightarrow$ `REOPENED`.
* **Public vs Internal Separation**: Public citizens see sanitized status without exposing internal priority scores or officer notes.
* **Preserved Multi-Stage Evidence Chain**: Citizen evidence $\rightarrow$ Officer inspection evidence $\rightarrow$ Completion evidence $\rightarrow$ Citizen resolution feedback.
* **Configurable Civic SLA Engine**: Priority-based deadlines (`CRITICAL`: 24h, `HIGH`: 72h, `MEDIUM`: 7d, `LOW`: 14d, `VERY LOW`: 21d).
* **Role-Based Notifications & Immutable Audit Trail**: Tracks every lifecycle transition event.

---

## 🛠️ Project Structure

```text
civic-ai-engine/
├── fusionx-ai/
│   ├── ai-engine/               # FastAPI AI Microservice
│   │   ├── api.py               # FastAPI endpoints (/ai/embed, /ai/evidence, /ai/priority)
│   │   ├── models/              # DINOv2, BART, CLIP, YOLO, BLIP model wrappers
│   │   ├── services/            # Similarity, Evidence, and Priority scoring services
│   │   ├── requirements.txt     # Python dependencies
│   │   └── test_*.py            # Automated test suites for AI services
│   ├── backend/                 # Node.js / Express API Gateway
│   │   ├── server.js            # Main Express server with role-based routing
│   │   ├── src/
│   │   │   ├── middleware/      # Role-based authentication & access control
│   │   │   └── services/        # Store, Duplicate, Geospatial, SLA, Workflow, Notifications
│   │   ├── package.json
│   │   └── test_*.py / *.js     # Integration & security test suites
│   └── demo-frontend/           # Vite / React Dashboard
│       ├── src/
│       ├── package.json
│       └── vite.config.js
├── brlit.jpg                    # Test asset: Streetlight
├── garbbage.webp                # Test asset: Garbage / cavity
├── garbbage_cropped.webp        # Test asset: Visual similarity crop
├── waterleakage.webp            # Test asset: Water leakage
├── yolo11n.pt                   # Local YOLOv11 model weights
└── README.md
```

---

## 🧪 Running Automated Tests

```bash
# Phase 1 & FastAPI Endpoint Regression
python fusionx-ai/ai-engine/test_fastapi_endpoints.py

# Phase 2 Duplicate Detection (100m GPS + DINOv2)
node fusionx-ai/backend/test_phase2_duplicate.js

# Phase 3 Multimodal Evidence Strength Score
python fusionx-ai/ai-engine/test_phase3_evidence.py

# Phase 4 Transparent Priority Engine
python fusionx-ai/ai-engine/test_phase4_priority.py

# Phase 5 Role-Based Access Control Security Tests
python fusionx-ai/backend/test_phase5_security.py

# Phase 5 Complete 21-Step Civic Lifecycle End-to-End Test
python fusionx-ai/backend/test_phase5_workflow.py
```
