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

export type DriveAnalyticsStudent = {
  studentId: string
  fullName: string
  branch: string
  cgpa: number | null
  skills: string[]
  matchedSkills: string[]
  missingSkills: string[]
  skillMatch: { matchedSkills: number; requiredSkills: number; percentage: number }
  applicationStatus: string | null
}

export type DriveSkillGap = { skill: string; studentsMissing: number; percentage: number }

export type DriveAnalytics = {
  drive: { id: string; companyName: string | null; role: string | null; requiredSkills: string[] }
  summary: { totalStudents: number; eligible: number; partialMatch: number; notEligible: number; driveEligibilityReadiness: number }
  skillGaps: DriveSkillGap[]
  branchAnalysis: {
    branch: string
    totalStudents: number
    eligibleStudents: number
    partialMatchStudents: number
    notEligibleStudents: number
    trainingCandidates: number
    readinessPercentage: number
  }[]
  branchSkillGaps: { branch: string; totalStudents: number; skillGaps: { skill: string; studentsMissing: number }[] }[]
  trainingPriorities: (DriveSkillGap & { rank: number })[]
  eligibleStudents: DriveAnalyticsStudent[]
  trainingCandidates: DriveAnalyticsStudent[]
  notEligibleStudents: DriveAnalyticsStudent[]
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

export type TpoStudent = {
  studentId: string
  fullName: string
  profilePhotoUrl: string | null
  branch: string
  cgpa: number | null
  backlogs: number | null
  graduationYear: number | null
  skills: string[]
  projects: StudentProject[]
  resume: { originalName: string; fileType: string; updatedAt: string } | null
  socialLinks: StudentSocialLinks
  profileComplete: boolean
  placementStatus: 'Placed' | 'Seeking placement'
  applicationCount: number
  applications: TpoApplication[]
}

export type TpoApplication = {
  id: string
  studentId: string
  jobId: string
  status: ApplicationStatus
  appliedAt: string
  updatedAt: string
  job: PlacementJob | null
  student: Pick<TpoStudent, 'studentId' | 'fullName' | 'branch' | 'cgpa' | 'graduationYear' | 'placementStatus'> | null
}

export type TpoDashboard = {
  summary: { totalStudents: number; completeProfiles: number; activeDrives: number; totalApplications: number; shortlistedStudents: number; studentsPlaced: number; studentsSeekingPlacement: number }
  upcomingDrives: PlacementJob[]
  recentApplications: TpoApplication[]
  recentPlacementActivity: TpoApplication[]
  branchPlacement: { branch: string; totalStudents: number; placedStudents: number; placementPercentage: number }[]
  applicationStatusDistribution: { status: string; applications: number }[]
  placementDataModelNote: string
}

export type TpoNotification = { id: string; type: string; title: string; message: string; createdAt: string | null; relatedJobId: string | null }
