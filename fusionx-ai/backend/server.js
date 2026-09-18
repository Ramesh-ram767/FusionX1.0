import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const aiRoot = path.join(projectRoot, 'ai-engine');
const venvPython = 'C:/Users/rames/civic-ai-engine/venv/Scripts/python.exe';

import { store } from './src/services/store.service.js';
import {
  checkDuplicateReports,
  IMAGE_SIMILARITY_THRESHOLD,
} from './src/services/duplicate.service.js';
import { DUPLICATE_RADIUS_METERS } from './src/services/geospatial.service.js';
import { evaluateEvidenceStrength, calculatePriority } from './src/services/aiBridge.service.js';
import {
  ROLES,
  authenticateUser,
  requireRole,
  verifyOfficerAssignment,
} from './src/middleware/auth.middleware.js';
import {
  INTERNAL_STATUS,
  PUBLIC_STATUS,
  getPublicStatus,
  transitionProblemStatus,
  sanitizeForCitizen,
} from './src/services/workflow.service.js';
import { calculateProblemSla, getSlaSummary } from './src/services/sla.service.js';
import { notificationService } from './src/services/notification.service.js';

const app = express();
const port = 3001;

const uploadDir = path.join(aiRoot, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}-${safeName}`;
    cb(null, unique);
  },
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadDir));
app.use(authenticateUser);

app.get('/', (_req, res) => {
  res.json({
    service: 'FUSIONX Backend API Gateway',
    status: 'online',
    phase: 'Phase 5: Role-Based Civic Workflow & Backend Lifecycle',
    roles: [ROLES.CITIZEN, ROLES.ADMIN, ROLES.CIVIC_OFFICER],
    endpoints: {
      health: 'GET /api/health',
      ai_health: 'GET /api/ai-health',
      citizen: {
        list_problems: 'GET /api/problems (Citizen Safe)',
        get_problem: 'GET /api/problems/:id',
        check_duplicate: 'POST /api/problems/check-duplicate',
        create_problem: 'POST /api/problems',
        support_problem: 'POST /api/problems/:id/support',
        my_reports: 'GET /api/citizen/my-reports',
        my_supports: 'GET /api/citizen/my-supports',
        resolution_feedback: 'POST /api/problems/:id/resolution-feedback',
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard',
        priority_queue: 'GET /api/admin/problems/priority',
        assign_officer: 'POST /api/admin/problems/:id/assign',
        approve_work: 'POST /api/admin/problems/:id/approve-work',
        work_order: 'POST /api/admin/problems/:id/work-order',
        work_status: 'POST /api/admin/problems/:id/work-status',
        close_problem: 'POST /api/admin/problems/:id/close',
        sla: 'GET /api/admin/sla',
        audit: 'GET /api/admin/problems/:id/audit',
      },
      officer: {
        dashboard_problems: 'GET /api/officer/problems',
        problem_details: 'GET /api/officer/problems/:id',
        inspection: 'POST /api/officer/problems/:id/inspection',
        work_report: 'POST /api/officer/problems/:id/work-report',
        completion_verification: 'POST /api/officer/problems/:id/completion-verification',
      },
      notifications: {
        list: 'GET /api/notifications',
        mark_read: 'POST /api/notifications/:id/read',
      },
    },
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'civic-ai-backend',
    phase: 'Phase 5: Role-Based Civic Workflow & Backend Lifecycle',
    config: {
      duplicate_radius_meters: DUPLICATE_RADIUS_METERS,
      image_similarity_threshold: IMAGE_SIMILARITY_THRESHOLD,
    },
  });
});

app.get('/api/ai-health', async (_req, res) => {
  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${aiEngineUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return res.json({
        success: true,
        node_backend: 'online',
        ai_engine: 'connected',
        ai_engine_url: aiEngineUrl,
        latency_ms: latency,
        ai_engine_details: data,
      });
    } else {
      return res.status(502).json({
        success: false,
        node_backend: 'online',
        ai_engine: 'error',
        status_code: response.status,
      });
    }
  } catch (error) {
    return res.status(503).json({
      success: false,
      node_backend: 'online',
      ai_engine: 'disconnected',
      error: error.message,
    });
  }
});

// Reset endpoint for clean automated test runs
app.post('/api/test/reset', (_req, res) => {
  store.resetToInitial();
  notificationService.reset();
  res.json({ success: true, message: 'Store reset to initial state' });
});

// ==========================================
// 1. CITIZEN ROUTES
// ==========================================

// List problems (Citizen safe view: strictly no internal admin signals)
app.get('/api/problems', (_req, res) => {
  const problems = store.getAll().map(sanitizeForCitizen);
  res.json({ success: true, count: problems.length, problems });
});

// Get single problem by ID (sanitized for citizens; full view for Admin / assigned Officer)
app.get('/api/problems/:id', (req, res) => {
  const problem = store.getById(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, error: 'Problem not found' });
  }

  const isPrivileged =
    req.user?.role === ROLES.ADMIN ||
    (req.user?.role === ROLES.CIVIC_OFFICER &&
      String(problem.assignment?.officer_id) === String(req.user.id));

  if (isPrivileged) {
    return res.json({ success: true, problem });
  }

  res.json({ success: true, problem: sanitizeForCitizen(problem) });
});

// Pre-submission duplicate check
app.post('/api/problems/check-duplicate', upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude, image_path } = req.body || {};
    const effectiveImage = req.file ? req.file.path : image_path || null;

    if (latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        error: 'Both latitude and longitude are required for duplicate analysis.',
      });
    }

    const duplicateResult = await checkDuplicateReports({
      latitude: Number(latitude),
      longitude: Number(longitude),
      image_path: effectiveImage,
    });

    res.json({ success: true, ...duplicateResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit a problem (Atomic AI lifecycle: Duplicate Check -> Evidence Analysis -> Priority Calculation -> Store Problem -> ADMIN_REVIEW)
app.post('/api/problems', upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      latitude,
      longitude,
      force_create,
      voice_note_text,
      language,
    } = req.body || {};
    const uploadedImage = req.file ? req.file.path : req.body?.image_path || null;

    if (!title || latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        error: 'Title, latitude, and longitude are required.',
      });
    }

    const shouldForceCreate = force_create === true || force_create === 'true';

    // 1. Nearby duplicate search
    if (!shouldForceCreate) {
      const duplicateAnalysis = await checkDuplicateReports({
        latitude: Number(latitude),
        longitude: Number(longitude),
        image_path: uploadedImage,
      });

      if (duplicateAnalysis.potential_match) {
        return res.status(200).json({
          success: true,
          potential_match: true,
          message: 'This problem may already be reported nearby.',
          duplicate_analysis: duplicateAnalysis,
        });
      }
    }

    // 2. Multimodal evidence strength analysis (Phase 3)
    const reportText = `${title}. ${description || ''}`.trim();
    let evidenceAnalysis = null;
    try {
      evidenceAnalysis = await evaluateEvidenceStrength(reportText, uploadedImage);
    } catch (e) {
      console.warn('[AI] Evidence evaluation failed, using neutral fallback:', e.message);
      evidenceAnalysis = {
        evidence_strength: 50,
        interpretation: 'Neutral baseline applied',
        explanation: ['AI Evidence engine temporarily unreachable; neutral baseline stored'],
      };
    }

    // 3. Priority calculation (Phase 4)
    let priorityAnalysis = null;
    try {
      priorityAnalysis = await calculatePriority({
        severity: null, // field verification pending
        evidence_strength: evidenceAnalysis?.evidence_strength,
        support_count: 0,
        criticality: null,
        created_at: new Date().toISOString(),
      });
    } catch (pErr) {
      console.warn('[AI] Priority calculation failed, using fallback:', pErr.message);
      priorityAnalysis = {
        priority_score: 35,
        priority_level: 'LOW',
        explanation: ['AI Priority engine temporarily unreachable; default baseline stored'],
      };
    }

    // 4. Create problem in store
    const created = store.create({
      title,
      description,
      category,
      latitude: Number(latitude),
      longitude: Number(longitude),
      image_path: uploadedImage,
      voice_note_text: voice_note_text || null,
      language: language || 'en',
      created_by: req.user?.id || 'citizen-anonymous',
      internal_status: INTERNAL_STATUS.ADMIN_REVIEW,
      evidence_analysis: evidenceAnalysis,
      priority_analysis: priorityAnalysis,
    });

    // 5. Record immutable audit events (REPORTED -> AI_ANALYZED -> ADMIN_REVIEW)
    store.addAuditEvent({
      id: `evt-${Date.now()}-1`,
      problem_id: String(created.id),
      from_status: INTERNAL_STATUS.REPORTED,
      to_status: INTERNAL_STATUS.AI_ANALYZED,
      public_status: PUBLIC_STATUS.AI_ANALYZED,
      actor_id: req.user?.id || 'citizen-anonymous',
      actor_role: ROLES.CITIZEN,
      remarks: 'Civic issue submitted; multimodal evidence analyzed.',
      timestamp: new Date().toISOString(),
    });

    store.addAuditEvent({
      id: `evt-${Date.now()}-2`,
      problem_id: String(created.id),
      from_status: INTERNAL_STATUS.AI_ANALYZED,
      to_status: INTERNAL_STATUS.ADMIN_REVIEW,
      public_status: PUBLIC_STATUS.REPORTED,
      actor_id: 'system',
      actor_role: 'SYSTEM',
      remarks: `Issue queued for Admin review & triage with priority score ${priorityAnalysis?.priority_score || 'N/A'}.`,
      timestamp: new Date().toISOString(),
    });

    // 6. Notify Citizen
    notificationService.notify({
      recipient_role: ROLES.CITIZEN,
      recipient_id: created.created_by,
      title: 'Problem Reported',
      message: `Your report #${created.id} ("${created.title}") was successfully submitted and queued for review.`,
      problem_id: created.id,
      type: 'SUCCESS',
    });

    // 7. Notify Admin if critical
    if (priorityAnalysis?.priority_level === 'CRITICAL') {
      notificationService.notify({
        recipient_role: ROLES.ADMIN,
        title: 'Critical Problem Reported',
        message: `High priority problem #${created.id} reported in ${created.category}. Immediate triage recommended.`,
        problem_id: created.id,
        type: 'ALERT',
      });
    }

    res.status(201).json({
      success: true,
      potential_match: false,
      problem: sanitizeForCitizen(created),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Citizen support ("I'm Affected")
app.post('/api/problems/:id/support', upload.single('image'), async (req, res) => {
  try {
    const problemId = req.params.id;
    const { explanation, latitude, longitude } = req.body || {};
    const userId = req.user?.id || req.body?.user_id || 'anonymous_user';
    const uploadedImage = req.file ? req.file.path : null;

    const result = store.addSupport(problemId, {
      user_id: userId,
      explanation,
      latitude,
      longitude,
      image_path: uploadedImage,
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    // Recalculate priority with updated community support count
    try {
      const updatedPriority = await calculatePriority({
        ...result.problem,
        supports: result.problem.supports,
        severity: result.problem.inspection?.severity ?? result.problem.severity ?? null,
      });
      result.problem.priority_analysis = updatedPriority;
    } catch (priorityErr) {
      console.warn('[Priority] Recalculation on support failed:', priorityErr.message);
    }

    store.addAuditEvent({
      id: `evt-${Date.now()}-sup`,
      problem_id: String(problemId),
      from_status: result.problem.internal_status,
      to_status: result.problem.internal_status,
      public_status: result.problem.status,
      actor_id: userId,
      actor_role: ROLES.CITIZEN,
      remarks: `Citizen endorsement ("I'm Affected") recorded by ${userId}. Total supporters: ${result.problem.supports.length}`,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Support recorded successfully',
      problem: sanitizeForCitizen(result.problem),
      support: result.support,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// Citizen: view own reported problems
app.get('/api/citizen/my-reports', requireRole(ROLES.CITIZEN), (req, res) => {
  const citizenId = req.user.id;
  const myReports = store
    .getAll()
    .filter((p) => String(p.created_by) === String(citizenId))
    .map(sanitizeForCitizen);

  res.json({ success: true, count: myReports.length, problems: myReports });
});

// Citizen: view problems they supported
app.get('/api/citizen/my-supports', requireRole(ROLES.CITIZEN), (req, res) => {
  const citizenId = req.user.id;
  const mySupports = store
    .getAll()
    .filter((p) => Array.isArray(p.supports) && p.supports.some((s) => String(s.user_id) === String(citizenId)))
    .map(sanitizeForCitizen);

  res.json({ success: true, count: mySupports.length, problems: mySupports });
});

// Citizen: Resolution feedback ("Issue resolved" vs "Still not resolved")
app.post('/api/problems/:id/resolution-feedback', requireRole(ROLES.CITIZEN), upload.single('photo'), (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const { resolved, comment } = req.body || {};
    const isResolved = resolved === true || resolved === 'true';
    const photo = req.file ? req.file.path : req.body?.photo || null;

    const feedbackRecord = store.addResolutionFeedback(problem.id, {
      resolved: isResolved,
      comment: comment || '',
      photo,
      user_id: req.user.id,
    });

    if (isResolved) {
      store.addAuditEvent({
        id: `evt-${Date.now()}-res-ok`,
        problem_id: String(problem.id),
        from_status: problem.internal_status,
        to_status: problem.internal_status,
        public_status: problem.status,
        actor_id: req.user.id,
        actor_role: ROLES.CITIZEN,
        remarks: `Citizen verified problem as resolved: "${comment || 'Satisfactory'}"`,
        timestamp: new Date().toISOString(),
      });

      notificationService.notify({
        recipient_role: ROLES.CITIZEN,
        recipient_id: req.user.id,
        title: 'Resolution Confirmed',
        message: `Thank you for confirming resolution of issue #${problem.id}.`,
        problem_id: problem.id,
        type: 'SUCCESS',
      });

      return res.json({
        success: true,
        message: 'Resolution confirmed by citizen.',
        feedback: feedbackRecord,
        problem: sanitizeForCitizen(problem),
      });
    } else {
      // Citizen says "Still not resolved" -> transition to REOPENED -> ADMIN_REVIEW
      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.REOPENED,
        req.user,
        `Citizen reported problem still not resolved: "${comment || 'Unresolved'}"`,
        { feedback: feedbackRecord },
        store
      );

      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.ADMIN_REVIEW,
        { id: 'system', role: 'SYSTEM' },
        'Reopened problem queued for Admin re-verification and reassessment',
        {},
        store
      );

      notificationService.notify({
        recipient_role: ROLES.ADMIN,
        title: 'Problem Reopened by Citizen',
        message: `Problem #${problem.id} was reopened by citizen: "${comment || 'Unresolved'}". Re-verification required.`,
        problem_id: problem.id,
        type: 'WARNING',
      });

      return res.json({
        success: true,
        message: 'Problem marked as still not resolved. Reopened and sent for Admin re-verification.',
        feedback: feedbackRecord,
        problem: sanitizeForCitizen(problem),
      });
    }
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. ADMIN ROUTES
// ==========================================

// Admin Command Center Dashboard metrics
app.get('/api/admin/dashboard', requireRole(ROLES.ADMIN), (_req, res) => {
  try {
    const allProblems = store.getAll();
    const openProblems = store.getOpen();

    let criticalCount = 0;
    let newReportsCount = 0;
    let pendingAssignmentsCount = 0;
    let resolvedCount = 0;
    let reopenedCount = 0;

    for (const p of allProblems) {
      const isClosed = ['RESOLVED', 'ADMIN_CLOSED'].includes(String(p.internal_status || p.status).toUpperCase());

      if (isClosed) {
        resolvedCount++;
      } else {
        const pLevel = p.priority_analysis?.priority_level || 'MEDIUM';
        if (pLevel === 'CRITICAL' || (p.priority_analysis?.priority_score || 0) >= 80) {
          criticalCount++;
        }
        if (p.internal_status === INTERNAL_STATUS.ADMIN_REVIEW) {
          newReportsCount++;
        }
        if (!p.assignment?.officer_id) {
          pendingAssignmentsCount++;
        }
      }

      if (p.internal_status === INTERNAL_STATUS.REOPENED || (p.resolution_feedback && p.resolution_feedback.some((f) => !f.resolved))) {
        reopenedCount++;
      }
    }

    const slaSummary = getSlaSummary(allProblems);

    res.json({
      success: true,
      metrics: {
        total_active_issues: openProblems.length,
        critical_issues: criticalCount,
        new_reports: newReportsCount,
        pending_assignments: pendingAssignmentsCount,
        sla_due_today: slaSummary.due_today,
        overdue_issues: slaSummary.overdue,
        critical_overdue: slaSummary.critical_overdue,
        resolved_issues: resolvedCount,
        reopened_issues: reopenedCount,
        average_resolution_time_days: slaSummary.average_resolution_time_days,
      },
      sla: slaSummary,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Priority Queue (Phase 4 Priority Engine output sorted descending)
app.get('/api/admin/problems/priority', requireRole(ROLES.ADMIN), async (_req, res) => {
  try {
    const openProblems = store.getOpen();

    const queuePromises = openProblems.map(async (problem) => {
      let priority = problem.priority_analysis;
      if (!priority) {
        priority = await calculatePriority({
          ...problem,
          evidence_strength: problem.evidence_analysis?.evidence_strength,
          severity: problem.inspection?.severity ?? problem.severity ?? null,
        });
        problem.priority_analysis = priority;
      }

      const createdDate = new Date(problem.created_at);
      const durationDays = !isNaN(createdDate.getTime())
        ? Math.round(((Date.now() - createdDate.getTime()) / 86400000) * 10) / 10
        : 0;

      const supportCount = Array.isArray(problem.supports) ? problem.supports.length : 0;
      const recentGrowth = priority.signals?.growth ? Math.round(priority.signals.growth * 10) : 0;

      return {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        category: problem.category,
        location: {
          latitude: problem.latitude,
          longitude: problem.longitude,
        },
        status: problem.status,
        internal_status: problem.internal_status,
        assigned_officer: problem.assignment?.officer_id || 'UNASSIGNED',
        severity: problem.inspection?.severity ?? problem.severity ?? 'Pending Verification (3/5 baseline)',
        evidence_strength: problem.evidence_analysis?.evidence_strength != null
          ? problem.evidence_analysis.evidence_strength
          : Math.round((priority.signals?.evidence || 0.5) * 100),
        support_count: supportCount,
        criticality: problem.criticality || 'Standard Zone',
        duration_days: durationDays,
        growth: recentGrowth,
        priority_score: priority.priority_score,
        priority_level: priority.priority_level,
        signals: priority.signals,
        weights: priority.weights,
        explanation: priority.explanation,
        created_at: problem.created_at,
      };
    });

    const queue = await Promise.all(queuePromises);
    queue.sort((a, b) => b.priority_score - a.priority_score);

    res.json({
      success: true,
      count: queue.length,
      queue,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Assign Civic Officer to problem
app.post('/api/admin/problems/:id/assign', requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const { officer_id, remarks } = req.body || {};
    if (!officer_id) {
      return res.status(400).json({ success: false, error: 'officer_id is required' });
    }

    problem.assignment = {
      officer_id: String(officer_id).trim(),
      assigned_at: new Date().toISOString(),
      assigned_by: req.user.id,
      assignment_status: 'ASSIGNED',
      remarks: remarks || '',
    };

    transitionProblemStatus(
      problem,
      INTERNAL_STATUS.OFFICER_ASSIGNED,
      req.user,
      `Assigned to Civic Officer ${officer_id}. Remarks: ${remarks || 'None'}`,
      { officer_id },
      store
    );

    // Notify assigned officer
    notificationService.notify({
      recipient_role: ROLES.CIVIC_OFFICER,
      recipient_id: officer_id,
      title: 'New Task Assignment',
      message: `You have been assigned to inspect problem #${problem.id} ("${problem.title}").`,
      problem_id: problem.id,
      type: 'INFO',
    });

    // Notify citizen
    notificationService.notify({
      recipient_role: ROLES.CITIZEN,
      recipient_id: problem.created_by,
      title: 'Officer Assigned',
      message: `A Civic Officer has been assigned to inspect your reported issue #${problem.id}.`,
      problem_id: problem.id,
      type: 'INFO',
    });

    res.json({
      success: true,
      message: `Problem #${problem.id} assigned to officer ${officer_id}.`,
      problem,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// Admin: Review & Approve/Reject Officer Work Report
app.post('/api/admin/problems/:id/approve-work', requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const { approved, remarks } = req.body || {};
    const isApproved = approved === true || approved === 'true';

    if (isApproved) {
      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.WORK_APPROVED,
        req.user,
        `Admin approved work plan: ${remarks || 'Approved for resource allocation'}`,
        { remarks },
        store
      );

      if (problem.assignment?.officer_id) {
        notificationService.notify({
          recipient_role: ROLES.CIVIC_OFFICER,
          recipient_id: problem.assignment.officer_id,
          title: 'Work Plan Approved',
          message: `Work plan for problem #${problem.id} was approved by Admin.`,
          problem_id: problem.id,
          type: 'SUCCESS',
        });
      }

      res.json({ success: true, message: 'Work plan approved.', problem });
    } else {
      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.WORK_REVIEW_REQUIRED,
        req.user,
        `Admin requested revision on work plan: ${remarks || 'Needs review'}`,
        { remarks },
        store
      );

      if (problem.assignment?.officer_id) {
        notificationService.notify({
          recipient_role: ROLES.CIVIC_OFFICER,
          recipient_id: problem.assignment.officer_id,
          title: 'Work Plan Needs Revision',
          message: `Work plan for problem #${problem.id} was returned for revision: ${remarks || 'Review required'}.`,
          problem_id: problem.id,
          type: 'WARNING',
        });
      }

      res.json({ success: true, message: 'Work plan returned for review.', problem });
    }
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// Admin: Allocate workers and resources (Work Order)
app.post('/api/admin/problems/:id/work-order', requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const {
      workers_allocated,
      planned_start,
      planned_completion,
      materials,
      instructions,
    } = req.body || {};

    problem.work_order = {
      workers_allocated: Number(workers_allocated || 1),
      planned_start: planned_start || new Date().toISOString(),
      planned_completion: planned_completion || null,
      materials: materials || [],
      instructions: instructions || '',
      allocated_at: new Date().toISOString(),
      allocated_by: req.user.id,
    };

    transitionProblemStatus(
      problem,
      INTERNAL_STATUS.WORKER_ALLOCATED,
      req.user,
      `Allocated ${problem.work_order.workers_allocated} workers. Instructions: ${instructions || 'Standard repair procedure'}`,
      { work_order: problem.work_order },
      store
    );

    // Notify officer
    if (problem.assignment?.officer_id) {
      notificationService.notify({
        recipient_role: ROLES.CIVIC_OFFICER,
        recipient_id: problem.assignment.officer_id,
        title: 'Workers Allocated',
        message: `Work order issued for problem #${problem.id}: ${problem.work_order.workers_allocated} workers allocated.`,
        problem_id: problem.id,
        type: 'INFO',
      });
    }

    res.json({
      success: true,
      message: 'Worker resources allocated successfully.',
      work_order: problem.work_order,
      problem,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// Admin: Progress work execution status
app.post('/api/admin/problems/:id/work-status', requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const { status, remarks } = req.body || {};
    const validStates = [
      INTERNAL_STATUS.WORK_STARTED,
      INTERNAL_STATUS.WORK_IN_PROGRESS,
      INTERNAL_STATUS.WORK_COMPLETED,
    ];

    if (!validStates.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStates.join(', ')}`,
      });
    }

    transitionProblemStatus(
      problem,
      status,
      req.user,
      remarks || `Work execution status transitioned to ${status}`,
      {},
      store
    );

    // If completed, alert officer to perform completion verification
    if (status === INTERNAL_STATUS.WORK_COMPLETED && problem.assignment?.officer_id) {
      notificationService.notify({
        recipient_role: ROLES.CIVIC_OFFICER,
        recipient_id: problem.assignment.officer_id,
        title: 'Completion Verification Required',
        message: `Physical repair for problem #${problem.id} is marked complete. Please conduct on-site completion verification.`,
        problem_id: problem.id,
        type: 'INFO',
      });
    }

    res.json({
      success: true,
      message: `Problem work status updated to ${status}.`,
      problem,
    });
  } catch (error) {
    const s = error.statusCode || 500;
    res.status(s).json({ success: false, error: error.message });
  }
});

// Admin: Final review and closure
app.post('/api/admin/problems/:id/close', requireRole(ROLES.ADMIN), (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const { approved, remarks } = req.body || {};
    const isApproved = approved !== false && approved !== 'false';

    if (!isApproved) {
      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.ADMIN_REVIEW,
        req.user,
        `Admin declined final closure: ${remarks || 'Further inspection needed'}`,
        { remarks },
        store
      );

      return res.json({
        success: true,
        message: 'Problem closure declined; returned to Admin Review.',
        problem,
      });
    }

    // Transition to ADMIN_CLOSED then RESOLVED
    transitionProblemStatus(
      problem,
      INTERNAL_STATUS.ADMIN_CLOSED,
      req.user,
      `Admin verified physical completion: ${remarks || 'Issue resolved satisfactory'}`,
      { remarks },
      store
    );

    transitionProblemStatus(
      problem,
      INTERNAL_STATUS.RESOLVED,
      { id: 'system', role: 'SYSTEM' },
      'Civic problem officially marked RESOLVED in municipal registry.',
      {},
      store
    );

    // Notify citizen creator
    notificationService.notify({
      recipient_role: ROLES.CITIZEN,
      recipient_id: problem.created_by,
      title: 'Problem Resolved',
      message: `Your reported problem #${problem.id} ("${problem.title}") has been officially resolved. Please rate or verify the resolution.`,
      problem_id: problem.id,
      type: 'SUCCESS',
    });

    res.json({
      success: true,
      message: `Problem #${problem.id} verified and marked RESOLVED.`,
      problem,
    });
  } catch (error) {
    const s = error.statusCode || 500;
    res.status(s).json({ success: false, error: error.message });
  }
});

// Admin: SLA Overview
app.get('/api/admin/sla', requireRole(ROLES.ADMIN), (_req, res) => {
  try {
    const allProblems = store.getAll();
    const slaSummary = getSlaSummary(allProblems);
    res.json({ success: true, ...slaSummary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Audit Event Trail for a problem
app.get('/api/admin/problems/:id/audit', requireRole(ROLES.ADMIN), (req, res) => {
  const events = store.getAuditEvents(req.params.id);
  res.json({ success: true, problem_id: req.params.id, count: events.length, events });
});

// ==========================================
// 3. CIVIC OFFICER ROUTES
// ==========================================

// Civic Officer: Dashboard task queue (strictly assigned to caller)
app.get('/api/officer/problems', requireRole(ROLES.CIVIC_OFFICER), (req, res) => {
  try {
    const officerId = String(req.user.id);
    const assignedProblems = store.getAll().filter((p) => {
      const assigned = p.assignment?.officer_id;
      return assigned && String(assigned) === officerId;
    });

    const todayTasks = [];
    const criticalTasks = [];
    const dueSoonTasks = [];
    const overdueTasks = [];
    const completedTasks = [];

    for (const p of assignedProblems) {
      const sla = calculateProblemSla(p);
      const isClosed = ['RESOLVED', 'ADMIN_CLOSED', 'WORK_COMPLETED', 'OFFICER_VERIFIED'].includes(
        String(p.internal_status).toUpperCase()
      );

      if (isClosed) {
        completedTasks.push(p);
      } else {
        if (sla.due_today) todayTasks.push(p);
        if (sla.priority_level === 'CRITICAL') criticalTasks.push(p);
        if (sla.is_approaching) dueSoonTasks.push(p);
        if (sla.is_overdue) overdueTasks.push(p);
      }
    }

    res.json({
      success: true,
      officer_id: officerId,
      total_assigned: assignedProblems.length,
      categories: {
        assigned_issues: assignedProblems,
        today_tasks: todayTasks,
        critical_tasks: criticalTasks,
        due_soon_tasks: dueSoonTasks,
        overdue_tasks: overdueTasks,
        completed_tasks: completedTasks,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Civic Officer: Problem task details (with security access check)
app.get('/api/officer/problems/:id', requireRole(ROLES.CIVIC_OFFICER), verifyOfficerAssignment((id) => store.getById(id)), (req, res) => {
  const problem = req.problem;

  res.json({
    success: true,
    task: {
      problem_id: problem.id,
      title: problem.title,
      description: problem.description,
      category: problem.category,
      location: {
        latitude: problem.latitude,
        longitude: problem.longitude,
      },
      citizen_evidence: {
        image_path: problem.image_path,
        voice_note_text: problem.voice_note_text,
        reported_at: problem.created_at,
      },
      priority_summary: {
        priority_score: problem.priority_analysis?.priority_score ?? null,
        priority_level: problem.priority_analysis?.priority_level ?? null,
        signals: problem.priority_analysis?.signals ?? null,
        explanation: problem.priority_analysis?.explanation ?? [],
      },
      supports_count: Array.isArray(problem.supports) ? problem.supports.length : 0,
      assignment: problem.assignment,
      inspection: problem.inspection,
      work_report: problem.work_report,
      work_order: problem.work_order,
      completion_verification: problem.completion_verification,
      internal_status: problem.internal_status,
      public_status: problem.status,
    },
  });
});

// Civic Officer: Submit on-site field inspection
app.post(
  '/api/officer/problems/:id/inspection',
  requireRole(ROLES.CIVIC_OFFICER),
  verifyOfficerAssignment((id) => store.getById(id)),
  async (req, res) => {
    try {
      const problem = req.problem;
      const {
        location_verified,
        issue_exists,
        severity,
        current_condition,
        remarks,
        photos,
        videos,
        voice_note_text,
      } = req.body || {};

      const exists = issue_exists !== false && issue_exists !== 'false';
      const verifiedSeverity = Math.max(1, Math.min(5, Number(severity) || 3));

      // 1. Store separate inspection evidence without overwriting citizen evidence
      problem.inspection = {
        location_verified: location_verified !== false && location_verified !== 'false',
        issue_exists: exists,
        severity: verifiedSeverity,
        current_condition: current_condition || '',
        remarks: remarks || '',
        photos: photos || [],
        videos: videos || [],
        voice_note_text: voice_note_text || null,
        inspected_at: new Date().toISOString(),
        inspected_by: req.user.id,
      };

      // 2. Automatically recalculate priority score using field-verified severity
      try {
        const updatedPriority = await calculatePriority({
          ...problem,
          severity: verifiedSeverity,
          evidence_strength: problem.evidence_analysis?.evidence_strength,
          supports: problem.supports,
        });
        problem.priority_analysis = updatedPriority;
      } catch (pErr) {
        console.warn('[Priority] Officer inspection recalculation failed:', pErr.message);
      }

      // 3. Status transition
      if (!exists) {
        problem.field_verification_flag = 'ISSUE_NOT_FOUND';
        transitionProblemStatus(
          problem,
          INTERNAL_STATUS.ADMIN_REVIEW,
          req.user,
          `Officer reported problem does not exist on site: "${remarks || 'Not found'}"`,
          { inspection: problem.inspection },
          store
        );

        notificationService.notify({
          recipient_role: ROLES.ADMIN,
          title: 'Problem Not Found on Site',
          message: `Officer ${req.user.id} reported problem #${problem.id} not found during inspection. Admin review required.`,
          problem_id: problem.id,
          type: 'ALERT',
        });

        return res.json({
          success: true,
          message: 'Inspection submitted. Issue flagged as not found on site; sent to Admin review.',
          inspection: problem.inspection,
          problem,
        });
      }

      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.INSPECTION,
        req.user,
        `Field inspection completed. Verified severity: ${verifiedSeverity}/5. Condition: ${current_condition || 'Inspected'}`,
        { inspection: problem.inspection },
        store
      );

      notificationService.notify({
        recipient_role: ROLES.ADMIN,
        title: 'Inspection Completed',
        message: `Officer ${req.user.id} completed field inspection for problem #${problem.id} (Verified severity: ${verifiedSeverity}/5).`,
        problem_id: problem.id,
        type: 'INFO',
      });

      res.json({
        success: true,
        message: 'Field inspection submitted successfully.',
        inspection: problem.inspection,
        updated_priority: problem.priority_analysis,
        problem,
      });
    } catch (error) {
      const s = error.statusCode || 500;
      res.status(s).json({ success: false, error: error.message });
    }
  }
);

// Civic Officer: Submit work report (resource estimation)
app.post(
  '/api/officer/problems/:id/work-report',
  requireRole(ROLES.CIVIC_OFFICER),
  verifyOfficerAssignment((id) => store.getById(id)),
  (req, res) => {
    try {
      const problem = req.problem;
      const {
        workers_required,
        estimated_hours,
        materials,
        remarks,
        urgency_notes,
        additional_evidence,
      } = req.body || {};

      problem.work_report = {
        workers_required: Number(workers_required || 1),
        estimated_hours: Number(estimated_hours || 4),
        materials: materials || [],
        remarks: remarks || '',
        urgency_notes: urgency_notes || '',
        additional_evidence: additional_evidence || [],
        submitted_at: new Date().toISOString(),
        submitted_by: req.user.id,
      };

      transitionProblemStatus(
        problem,
        INTERNAL_STATUS.WORK_REPORT_SUBMITTED,
        req.user,
        `Submitted work estimation: ${problem.work_report.workers_required} workers, ~${problem.work_report.estimated_hours} hours.`,
        { work_report: problem.work_report },
        store
      );

      notificationService.notify({
        recipient_role: ROLES.ADMIN,
        title: 'Work Estimation Submitted',
        message: `Officer ${req.user.id} submitted work estimate for problem #${problem.id}. Ready for approval.`,
        problem_id: problem.id,
        type: 'INFO',
      });

      res.json({
        success: true,
        message: 'Work report submitted and awaiting Admin approval.',
        work_report: problem.work_report,
        problem,
      });
    } catch (error) {
      const s = error.statusCode || 500;
      res.status(s).json({ success: false, error: error.message });
    }
  }
);

// Civic Officer: Completion verification (Stage 3 AFTER evidence)
app.post(
  '/api/officer/problems/:id/completion-verification',
  requireRole(ROLES.CIVIC_OFFICER),
  verifyOfficerAssignment((id) => store.getById(id)),
  (req, res) => {
    try {
      const problem = req.problem;
      const { completed, remarks, photos, videos } = req.body || {};
      const isComplete = completed !== false && completed !== 'false';

      problem.completion_verification = {
        completed: isComplete,
        remarks: remarks || '',
        photos: photos || [],
        videos: videos || [],
        verified_at: new Date().toISOString(),
        verified_by: req.user.id,
      };

      if (isComplete) {
        transitionProblemStatus(
          problem,
          INTERNAL_STATUS.OFFICER_VERIFIED,
          req.user,
          `Officer verified physical repair completion: ${remarks || 'Complete'}`,
          { completion_verification: problem.completion_verification },
          store
        );

        notificationService.notify({
          recipient_role: ROLES.ADMIN,
          title: 'Completion Verified by Officer',
          message: `Officer ${req.user.id} verified completion of problem #${problem.id}. Ready for final admin closure.`,
          problem_id: problem.id,
          type: 'SUCCESS',
        });

        res.json({
          success: true,
          message: 'Completion verified by officer. Ready for final Admin closure.',
          completion_verification: problem.completion_verification,
          problem,
        });
      } else {
        transitionProblemStatus(
          problem,
          INTERNAL_STATUS.WORK_IN_PROGRESS,
          req.user,
          `Officer verified work is incomplete: ${remarks || 'Pending further work'}`,
          { completion_verification: problem.completion_verification },
          store
        );

        notificationService.notify({
          recipient_role: ROLES.ADMIN,
          title: 'Work Incomplete',
          message: `Officer ${req.user.id} verified problem #${problem.id} is not yet finished. Returned to IN_PROGRESS.`,
          problem_id: problem.id,
          type: 'WARNING',
        });

        res.json({
          success: true,
          message: 'Work marked incomplete; returned to IN_PROGRESS.',
          completion_verification: problem.completion_verification,
          problem,
        });
      }
    } catch (error) {
      const s = error.statusCode || 500;
      res.status(s).json({ success: false, error: error.message });
    }
  }
);

// ==========================================
// 4. NOTIFICATIONS
// ==========================================

app.get('/api/notifications', (req, res) => {
  const role = req.user?.role;
  const userId = req.user?.id;
  const unreadOnly = req.query.unread === 'true';

  const userNotifs = notificationService.getForUser({
    role,
    user_id: userId,
    unread_only: unreadOnly,
  });

  res.json({ success: true, count: userNotifs.length, notifications: userNotifs });
});

app.post('/api/notifications/:id/read', (req, res) => {
  const updated = notificationService.markRead(req.params.id);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Notification not found' });
  }
  res.json({ success: true, notification: updated });
});

// ==========================================
// 5. DIRECT AI SERVICES (Phases 1-4 Passthrough)
// ==========================================

// Multimodal evidence strength evaluation
app.post('/api/evidence', upload.single('image'), async (req, res) => {
  try {
    const text = req.body?.text || `${req.body?.title || ''} ${req.body?.description || ''}`.trim();
    const effectiveImage = req.file ? req.file.path : req.body?.image_path || null;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text description is required for evidence evaluation.',
      });
    }

    const evidenceResult = await evaluateEvidenceStrength(text, effectiveImage);
    res.json({ success: true, ...evidenceResult });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Direct priority calculation service endpoint
app.post('/api/priority', async (req, res) => {
  try {
    const result = await calculatePriority(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate or override priority for a specific problem (e.g. Officer verification update)
app.post('/api/problems/:id/priority', async (req, res) => {
  try {
    const problem = store.getById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, error: 'Problem not found' });
    }

    const overrides = req.body || {};
    const mergedInput = {
      ...problem,
      ...overrides,
      severity: overrides.severity != null ? overrides.severity : (problem.inspection?.severity ?? problem.severity ?? null),
      evidence_strength: overrides.evidence_strength != null
        ? overrides.evidence_strength
        : (problem.evidence_analysis?.evidence_strength ?? null),
      criticality: overrides.criticality ?? (problem.criticality ?? null),
      supports: problem.supports || [],
    };

    const priorityResult = await calculatePriority(mergedInput);

    if (overrides.severity != null) problem.severity = Number(overrides.severity);
    if (overrides.criticality != null) problem.criticality = overrides.criticality;
    problem.priority_analysis = priorityResult;

    res.json({
      success: true,
      problem_id: problem.id,
      priority: priorityResult,
      problem,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/predict', upload.single('image'), async (req, res) => {
  const { model = 'clip', text = '' } = req.body || {};
  const uploadedImage = req.file ? req.file.path : null;

  const rawLabels = Array.isArray(req.body?.labels)
    ? req.body.labels
    : req.body?.labels
      ? [req.body.labels]
      : [];

  const labelList = rawLabels
    .flatMap((label) => String(label).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  const finalLabels = labelList.length
    ? labelList
    : [
        'a photograph of a pothole',
        'a photograph of a damaged road',
        'a photograph of garbage',
        'a photograph of a flooded road',
        'a photograph of a broken streetlight',
        'a photograph of a normal road',
        'a photograph of water leakage',
      ];

  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const params = new URLSearchParams({
      model,
      text: text || '',
      labels: finalLabels.join(', '),
    });
    if (uploadedImage) {
      params.append('image_path', uploadedImage);
    }
    const fastApiRes = await fetch(`${aiEngineUrl}/ai/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (fastApiRes.ok) {
      const data = await fastApiRes.json();
      return res.json({ ...data, source: 'fastapi-warm' });
    }
  } catch (_err) {
    // Fall back to CLI
  }

  const args = ['main.py', '--model', model];
  if (uploadedImage) args.push('--image', uploadedImage);
  if (text) args.push('--text', text);
  if (finalLabels.length) {
    args.push('--labels');
    finalLabels.forEach((label) => args.push(label));
  }

  const pythonProcess = spawn(venvPython, args, {
    cwd: aiRoot,
    env: {
      ...process.env,
      PYTHONPATH: aiRoot,
    },
  });

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  pythonProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: stderr || 'Model execution failed',
      });
    }

    try {
      const payload = JSON.parse(stdout);
      res.json({ success: true, ...payload });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Invalid model output',
        raw: stdout,
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Civic AI backend running on http://localhost:${port}`);
});
