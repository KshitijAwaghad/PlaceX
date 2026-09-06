import type { CareerAnalysis, LearningResource, ResumeData } from '../types/career'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

type AnalysisPayload = Partial<CareerAnalysis>

type PlanStep = CareerAnalysis['plan30Days'][number]

const defaultBreakdown: CareerAnalysis['scoreBreakdown'] = {
  skillsMatch: 0, experienceMatch: 0, projectMatch: 0, educationMatch: null,
  weights: { skills: 0.6, experience: 0.2, projects: 0.2, education: 0 }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function normalizePlan(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) return []
  return value.map((step, index) => {
    const item = step && typeof step === 'object' ? step as Record<string, unknown> : {}
    const resourceList = Array.isArray(item.resources) ? item.resources : []
    return {
      week: Number(item.week) || index + 1,
      title: String(item.title || `Week ${index + 1}`),
      goal: String(item.goal || ''),
      tasks: stringArray(item.tasks),
      expectedEvidence: String(item.expectedEvidence || ''),
      interviewPreparation: String(item.interviewPreparation || ''),
      resources: resourceList.filter((resource) => resource && typeof resource === 'object').map((resource) => resource as LearningResource)
    }
  })
}

function normalizeAnalysis(payload: AnalysisPayload): CareerAnalysis {
  const breakdown = payload.scoreBreakdown
    ? {
        skillsMatch: Number(payload.scoreBreakdown.skillsMatch ?? 0),
        experienceMatch: Number(payload.scoreBreakdown.experienceMatch ?? 0),
        projectMatch: Number(payload.scoreBreakdown.projectMatch ?? 0),
        educationMatch: payload.scoreBreakdown.educationMatch === null ? null : Number(payload.scoreBreakdown.educationMatch ?? 0),
        weights: {
          skills: Number(payload.scoreBreakdown.weights?.skills ?? 0.6),
          experience: Number(payload.scoreBreakdown.weights?.experience ?? 0.2),
          projects: Number(payload.scoreBreakdown.weights?.projects ?? 0.2),
          education: Number(payload.scoreBreakdown.weights?.education ?? 0)
        }
      }
    : defaultBreakdown

  return {
    matchPercentage: Number(payload.matchPercentage ?? 0),
    matchingSkills: stringArray(payload.matchingSkills),
    missingSkills: stringArray(payload.missingSkills),
    experienceMatch: Number(payload.experienceMatch ?? 0),
    projectMatch: Number(payload.projectMatch ?? 0),
    scoreBreakdown: breakdown,
    scoreExplanation: payload.scoreExplanation ?? { formula: '', components: [], reasons: [] },
    skillEvidence: Array.isArray(payload.skillEvidence) ? payload.skillEvidence : [],
    prioritizedGaps: Array.isArray(payload.prioritizedGaps) ? payload.prioritizedGaps : [],
    recommendations: stringArray(payload.recommendations),
    plan30Days: normalizePlan(payload.plan30Days)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new Error('Unable to connect to the analysis service. Please make sure the backend is running.')
  }

  let payload: { data?: T; error?: { message?: string } } | null = null
  try {
    payload = await response.json()
  } catch {
    throw new Error('The analysis service returned an invalid response.')
  }
  if (!response.ok) throw new Error(payload?.error?.message || 'Something went wrong.')
  if (!payload || !('data' in payload)) throw new Error('The analysis service returned an incomplete response.')
  return payload.data as T
}

export function uploadResume(file: File) {
  const body = new FormData()
  body.append('resume', file)
  return request<{ resume: ResumeData }>('/resume/upload', { method: 'POST', body })
}

export function analyzeResume(resumeText: string, jobDescription: string, addedSkills: string[] = []) {
  return request<AnalysisPayload>('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText, jobDescription, addedSkills }) }).then(normalizeAnalysis)
}

export function simulateCareer(resumeText: string, description: string, addedSkills: string[]) {
  return request<{ readinessScore: number; scoreChange: number; analysis?: AnalysisPayload }>('/career/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeText, jobDescription: description, addedSkills }) }).then((result) => ({ ...result, analysis: normalizeAnalysis(result.analysis || {}) }))
}
