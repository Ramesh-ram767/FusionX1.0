import path from 'path';
import { INTERNAL_STATUS, getPublicStatus } from './workflow.service.js';

// Initial seed problems for testing real-world civic scenarios
const initialProblems = [
  {
    id: '101',
    title: 'Severe garbage accumulation near market entrance',
    description: 'Waste dump blocking pedestrian path and market access with strong odor.',
    category: 'garbage',
    latitude: 13.6288,
    longitude: 79.4192,
    image_path: 'C:/Users/rames/civic-ai-engine/garbbage.webp',
    created_by: 'citizen_1',
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
      {
        id: 'sup-1',
        user_id: 'citizen_2',
        explanation: 'The odor is very strong near the vegetable stalls.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '102',
    title: 'Main water pipeline leakage causing street flooding',
    description: 'Drinking water pipeline ruptured, flooding the intersection.',
    category: 'water_leakage',
    latitude: 13.635,
    longitude: 79.425,
    image_path: 'C:/Users/rames/civic-ai-engine/waterleakage.webp',
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
    supports: [],
    created_at: new Date(Date.now() - 14400000).toISOString(),
    updated_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: '103',
    title: 'Damaged streetlight pole and broken luminaire',
    description: 'Streetlight leaning dangerously and not turning on at night.',
    category: 'streetlight',
    latitude: 13.6289,
    longitude: 79.4193,
    image_path: 'C:/Users/rames/civic-ai-engine/brlit.jpg',
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
    created_at: new Date(Date.now() - 21600000).toISOString(),
    updated_at: new Date(Date.now() - 21600000).toISOString(),
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
