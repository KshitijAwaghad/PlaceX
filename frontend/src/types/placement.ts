import type { ResumeData } from './career'

export type StudentProject = { title: string; description: string; technologies: string[]; githubUrl: string; liveUrl: string; startDate: string; endDate: string }
export type StudentSocialLinks = { github: string; linkedin: string; portfolio: string; leetcode: string }

export type StudentProfile = {
  fullName: string
  email: string
  phone: string
  branch: string
  college: string
  cgpa: number | null
  backlogs: number | null
  graduationYear: number | null
  skills: string[]
  legacySkills: string[]
  projects: StudentProject[]
  preferredRoles: string[]
  preferredLocations: string[]
  socialLinks: StudentSocialLinks
  profilePhotoUrl: string | null
  resume: Pick<ResumeData, 'originalName' | 'fileType'> & { updatedAt: string } | null
}

export type ProfileCompletion = {
  percentage: number
  fields: { key: string; label: string; mandatory: boolean; completed: boolean }[]
  missingFields: string[]
  missingMandatory: string[]
}

export type EligibilityResult = {
  eligible: boolean
  profileComplete: boolean
  branchEligible: boolean
  cgpaEligible: boolean
  backlogEligible: boolean
  graduationYearEligible: boolean
  matchedSkills: string[]
  missingSkills: string[]
  criteriaSource: 'OFFICIAL_TPO_ELIGIBILITY' | 'EXTERNAL_REQUIREMENTS'
  reasons: string[]
  checks: {
    cgpa: { passed: boolean; studentValue: number | null; requiredValue: number | null }
    backlogs: { passed: boolean; studentValue: number | null; maximumAllowed: number | null }
    branch: { passed: boolean; studentValue: string; eligibleBranches: string[] }
    graduationYear: { passed: boolean; studentValue: number | null; eligibleYears: number[] }
    skills: { passed: boolean; matched: string[]; missing: string[]; required: string[]; studentSkillCount: number }
  }
}

export type PlacementJob = {
  id: string
  sourceType: 'ON_CAMPUS' | 'OFF_CAMPUS'
  jobStatus: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'CLOSED' | 'ARCHIVED'
  source?: string | null
  requirementsSource?: 'PROVIDER' | 'INFERRED_FROM_DESCRIPTION' | 'NOT_PROVIDED'
  companyName: string | null
  role: string | null
  jobDescription: string | null
  ctc: string | null
  ctcLpa: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  location: string | null
  deadline: string | null
  postedAt: string | null
  minimumCgpa: number | null
  maximumBacklogs: number | null
  eligibleBranches: string[]
  graduationYears: number[]
  requiredSkills: string[]
  additionalCriteria?: string | null
  employmentType: string | null
  applicationUrl: string | null
  status: 'active' | 'expired'
  eligibility: EligibilityResult
}

export type ApplicationStatus = string

export type PlacementApplication = {
  id: string
  jobId: string
  appliedAt: string
  status: ApplicationStatus
  notes: string
  updatedAt: string
  hiringType: 'ON_CAMPUS' | 'OFF_CAMPUS'
  externalApplicationUrl: string | null
  source: string | null
  studentId?: string
  job: PlacementJob | null
}

export type ApplicationTrackingResult = {
  application: PlacementApplication
  alreadyApplied: boolean
}

export type InAppNotification = {
  id: string
  type: 'profile' | 'deadline'
  title: string
  message: string
  relatedJobId: string | null
  read: boolean
  createdAt: string
}
