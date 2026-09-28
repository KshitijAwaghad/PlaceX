import type { ResumeData } from './career'

export type StudentProject = { title: string; description: string; url: string }

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
  projects: StudentProject[]
  preferredRoles: string[]
  preferredLocations: string[]
  resume: Pick<ResumeData, 'originalName' | 'fileType'> & { updatedAt: string } | null
}

export type ProfileCompletion = {
  percentage: number
  fields: { key: string; label: string; mandatory: boolean; completed: boolean }[]
  missingMandatory: string[]
}

export type EligibilityResult = {
  eligible: boolean
  reasons: string[]
  checks: {
    cgpa: { passed: boolean; studentValue: number | null; requiredValue: number }
    backlogs: { passed: boolean; studentValue: number | null; maximumAllowed: number }
    branch: { passed: boolean; studentValue: string; eligibleBranches: string[] }
    graduationYear: { passed: boolean; studentValue: number | null; eligibleYears: number[] }
    skills: { passed: boolean; matched: string[]; missing: string[]; required: string[] }
  }
}

export type PlacementJob = {
  id: string
  companyName: string
  role: string
  jobDescription: string
  ctc: string
  ctcLpa: number
  location: string
  deadline: string
  minimumCgpa: number
  maximumBacklogs: number
  eligibleBranches: string[]
  graduationYears: number[]
  requiredSkills: string[]
  additionalCriteria: string
  status: 'active' | 'expired'
  eligibility: EligibilityResult
}

export type ApplicationStatus = 'Applied' | 'Assessment' | 'Interview' | 'Offer' | 'Rejected'

export type PlacementApplication = {
  id: string
  jobId: string
  appliedAt: string
  status: ApplicationStatus
  notes: string
  updatedAt: string
  job: PlacementJob | null
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
