export type LearningResource = { title: string; resourceType: 'YouTube' | 'Free Course' | 'Documentation' | 'Practice'; provider: string; url: string; free: true; description: string; estimatedLearningTime?: string }
export type PrioritizedGap = { skill: string; priority: 'High' | 'Medium' | 'Low'; reason: string }
export type SkillEvidence = { skill: string; evidence: string }
export type Plan30DayStep = { week: number; title: string; goal: string; tasks: string[]; expectedEvidence: string; interviewPreparation: string; resources: LearningResource[] }
export type ScoreExplanation = { formula: string; components: { label: string; score: number; weight: number; contribution: number }[]; reasons: string[] }

export type CareerAnalysis = {
  historyId?: string
  matchPercentage: number
  matchingSkills: string[]
  missingSkills: string[]
  experienceMatch: number
  projectMatch: number
  scoreBreakdown: { skillsMatch: number; experienceMatch: number; projectMatch: number; educationMatch: number | null; weights: { skills: number; experience: number; projects: number; education: number } }
  scoreExplanation: ScoreExplanation
  skillEvidence: SkillEvidence[]
  prioritizedGaps: PrioritizedGap[]
  recommendations: string[]
  plan30Days: Plan30DayStep[]
}

export type ResumeData = { originalName: string; fileType?: string; size: number; resumeText: string }

export type CareerHistorySummary = {
  id: string
  resumeName: string
  jobPreview: string
  matchPercentage: number
  missingSkills: string[]
  createdAt: string
}

export type CareerHistoryDetail = CareerHistorySummary & {
  resume: ResumeData
  jobDescription: string
  analysis: CareerAnalysis
}
