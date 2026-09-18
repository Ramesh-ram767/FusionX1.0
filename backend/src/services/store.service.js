import { INTERNAL_STATUS, getPublicStatus } from './workflow.service.js';

// Chennai-area seed problems for visible map + end-to-end demo
const initialProblems = [
  {
    id: '101',
    title: 'Main Road Pothole near School Zone',
    description: 'Large pothole causing vehicle damage; school-zone safety risk.',
    category: 'road',
    latitude: 13.0852,
    longitude: 80.2731,
    image_path: null,
    created_by: 'citizen-101',
    language: 'en',
    internal_status: INTERNAL_STATUS.OFFICER_ASSIGNED,
    status: getPublicStatus(INTERNAL_STATUS.OFFICER_ASSIGNED),
    assignment: {
      officer_id: 'OFF-001',
      assigned_at: new Date(Date.now() - 3600000).toISOString(),
      assigned_by: 'admin-1',
      assignment_status: 'ASSIGNED',
      remarks: 'P1 school-zone pothole — inspect today',
    },
    inspection: null,
    work_report: null,
    work_order: null,
    completion_verification: null,
    resolution_feedback: [],
    supports: [
      { id: 'sup-1', user_id: 'citizen_2', explanation: 'Affects school commute', created_at: new Date().toISOString() },
      { id: 'sup-2', user_id: 'citizen_5', explanation: 'Two-wheeler hazard', created_at: new Date().toISOString() },
    ],
    priority_analysis: {
      priority_score: 86,
      priority_level: 'HIGH',
      explanation: ['School zone', 'Multiple citizen supports', 'Safety risk'],
    },
    evidence_analysis: { evidence_strength: 78, interpretation: 'Strong multimodal evidence' },
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '102',
    title: 'Drainage blockage — School Lane',
    description: 'Open drain overflow after rains; foul smell and mosquito breeding.',
    category: 'drainage',
    latitude: 13.0801,
    longitude: 80.2684,
    image_path: null,
    created_by: 'citizen_3',
    language: 'en',
    internal_status: INTERNAL_STATUS.ADMIN_REVIEW,
    status: getPublicStatus(INTERNAL_STATUS.ADMIN_REVIEW),
    assignment: null,
    inspection: null,
    work_report: null,
    work_order: null,
    completion_verification: null,
    resolution_feedback: [],
    supports: [
      { id: 'sup-3', user_id: 'citizen_8', explanation: 'Water entering compound', created_at: new Date().toISOString() },
    ],
    priority_analysis: {
      priority_score: 74,
      priority_level: 'HIGH',
      explanation: ['Health risk', 'Clustered reports'],
    },
    evidence_analysis: { evidence_strength: 65 },
    created_at: new Date(Date.now() - 14400000).toISOString(),
    updated_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: '103',
    title: 'Streetlight outage — Park Avenue',
    description: 'Pole #44 dark since Monday evening.',
    category: 'streetlight',
    latitude: 13.0788,
    longitude: 80.2755,
    image_path: null,
    created_by: 'citizen_4',
    language: 'en',
    internal_status: INTERNAL_STATUS.ADMIN_REVIEW,
    status: getPublicStatus(INTERNAL_STATUS.ADMIN_REVIEW),
    assignment: null,
    inspection: null,
    work_report: null,
    work_order: null,
    completion_verification: null,
    resolution_feedback: [],
    supports: [],
    priority_analysis: { priority_score: 42, priority_level: 'MEDIUM', explanation: ['Night safety'] },
    created_at: new Date(Date.now() - 21600000).toISOString(),
    updated_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: '104',
    title: 'Garbage overflow — Market Road',
    description: 'Community bin overflowing for 3 days near vegetable stalls.',
    category: 'garbage',
    latitude: 13.0864,
    longitude: 80.2692,
    image_path: null,
    created_by: 'citizen_6',
    language: 'en',
    internal_status: INTERNAL_STATUS.ADMIN_REVIEW,
    status: getPublicStatus(INTERNAL_STATUS.ADMIN_REVIEW),
    assignment: null,
    inspection: null,
    work_report: null,
    work_order: null,
    completion_verification: null,
    resolution_feedback: [],
    supports: [],
    priority_analysis: { priority_score: 55, priority_level: 'MEDIUM', explanation: ['Public hygiene'] },
    created_at: new Date(Date.now() - 10800000).toISOString(),
    updated_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: '105',
    title: 'Pothole patch completed — Ring Road',
    description: 'Earlier pothole complaint; work finished — awaiting citizen verification.',
    category: 'road',
    latitude: 13.0835,
    longitude: 80.2660,
    image_path: null,
    created_by: 'citizen-101',
    language: 'en',
    internal_status: INTERNAL_STATUS.OFFICER_VERIFIED,
    status: getPublicStatus(INTERNAL_STATUS.OFFICER_VERIFIED),
    assignment: {
      officer_id: 'OFF-001',
      assigned_at: new Date(Date.now() - 86400000).toISOString(),
      assigned_by: 'admin-1',
      assignment_status: 'ASSIGNED',
      remarks: 'Completed — verify',
    },
    inspection: {
      location_verified: true,
      issue_exists: true,
      severity: 3,
      remarks: 'Patched and barricades removed',
      inspected_at: new Date(Date.now() - 43200000).toISOString(),
      inspected_by: 'OFF-001',
    },
    work_report: null,
    work_order: null,
    completion_verification: {
      completed: true,
      remarks: 'Asphalt patch complete',
      verified_at: new Date(Date.now() - 7200000).toISOString(),
      verified_by: 'OFF-001',
    },
    resolution_feedback: [],
    supports: [],
    priority_analysis: { priority_score: 40, priority_level: 'LOW' },
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

class ProblemStore {
  constructor() {
    this.problems = JSON.parse(JSON.stringify(initialProblems));
    this.auditEvents = [];
    this.resolutionFeedbacks = [];
  }

  getAll() {
    return [...this.problems];
  }

  getOpen() {
    return this.problems.filter(
      (p) => !['RESOLVED', 'ADMIN_CLOSED', 'CLOSED'].includes(String(p.internal_status || p.status).toUpperCase())
    );
  }

  getById(id) {
    return this.problems.find((p) => String(p.id) === String(id)) || null;
  }

  create(problemData) {
    const id = String(Date.now());
    const internalStatus = problemData.internal_status || INTERNAL_STATUS.ADMIN_REVIEW;

    const newProblem = {
      id,
      title: problemData.title || 'Untitled Problem',
      description: problemData.description || '',
      category: problemData.category || 'general',
      latitude: Number(problemData.latitude),
      longitude: Number(problemData.longitude),
      image_path: problemData.image_path || null,
      voice_note_text: problemData.voice_note_text || null,
      language: problemData.language || 'en',
      created_by: problemData.created_by || 'citizen-anonymous',
      internal_status: internalStatus,
      status: getPublicStatus(internalStatus),
      assignment: null,
      inspection: null,
      work_report: null,
      work_order: null,
      completion_verification: null,
      resolution_feedback: [],
      supports: [],
      evidence_analysis: problemData.evidence_analysis || null,
      priority_analysis: problemData.priority_analysis || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.problems.unshift(newProblem);
    return newProblem;
  }

  update(id, fields) {
    const problem = this.getById(id);
    if (!problem) return null;
    Object.assign(problem, fields);
    problem.updated_at = new Date().toISOString();
    return problem;
  }

  addSupport(problemId, supportData) {
    const problem = this.getById(problemId);
    if (!problem) return null;

    if (!problem.supports) problem.supports = [];

    const userId = supportData.user_id || 'anonymous_user';
    const alreadySupported = problem.supports.some((s) => s.user_id === userId);
    if (alreadySupported) {
      const error = new Error('User has already supported this problem');
      error.statusCode = 400;
      throw error;
    }

    const supportRecord = {
      id: `sup-${Date.now()}`,
      user_id: userId,
      explanation: supportData.explanation || '',
      latitude: supportData.latitude ? Number(supportData.latitude) : null,
      longitude: supportData.longitude ? Number(supportData.longitude) : null,
      image_path: supportData.image_path || null,
      created_at: new Date().toISOString(),
    };

    problem.supports.push(supportRecord);
    problem.updated_at = new Date().toISOString();
    return { problem, support: supportRecord };
  }

  addAuditEvent(event) {
    this.auditEvents.push(event);
    return event;
  }

  getAuditEvents(problemId) {
    return this.auditEvents.filter((e) => String(e.problem_id) === String(problemId));
  }

  getAllAuditEvents() {
    return [...this.auditEvents];
  }

  addResolutionFeedback(problemId, feedback) {
    const problem = this.getById(problemId);
    if (!problem) return null;

    const record = {
      id: `fb-${Date.now()}`,
      problem_id: String(problemId),
      resolved: Boolean(feedback.resolved),
      comment: feedback.comment || '',
      photo: feedback.photo || null,
      user_id: feedback.user_id || 'citizen-anonymous',
      submitted_at: new Date().toISOString(),
    };

    if (!problem.resolution_feedback) {
      problem.resolution_feedback = [];
    }
    problem.resolution_feedback.push(record);
    this.resolutionFeedbacks.push(record);

    return record;
  }

  resetToInitial() {
    this.problems = JSON.parse(JSON.stringify(initialProblems));
    this.auditEvents = [];
    this.resolutionFeedbacks = [];
  }
}

export const store = new ProblemStore();
