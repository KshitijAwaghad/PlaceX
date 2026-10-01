import { listCampusApplicationsForManagement } from './applicationService.js';
import { listCampusJobsForManagement } from './jobService.js';
import { listStudentProfilesForTpo, normalizeSocialLinks, profileCompletion } from './profileService.js';
import { uniqueSkills } from './skillNormalization.js';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function placementStatus(applications) {
  return applications.some((application) => application.status === 'Offer') ? 'Placed' : 'Seeking placement';
}

function publicStudent(profile, applications = []) {
  return {
    studentId: String(profile.userId),
    fullName: String(profile.fullName || '').trim(),
    profilePhotoUrl: typeof profile.profilePhotoUrl === 'string' ? profile.profilePhotoUrl : null,
    branch: String(profile.branch || '').trim(),
    cgpa: numberOrNull(profile.cgpa),
    backlogs: numberOrNull(profile.backlogs),
    graduationYear: numberOrNull(profile.graduationYear),
    skills: uniqueSkills(profile.skills),
    projects: Array.isArray(profile.projects) ? profile.projects.map((project) => ({
      title: String(project?.title || ''),
      description: String(project?.description || ''),
      technologies: uniqueSkills(project?.technologies || project?.skills),
      githubUrl: String(project?.githubUrl || ''),
      liveUrl: String(project?.liveUrl || project?.url || '')
    })) : [],
    resume: profile.resume && typeof profile.resume === 'object' ? {
      originalName: String(profile.resume.originalName || ''),
      fileType: String(profile.resume.fileType || ''),
      updatedAt: String(profile.resume.updatedAt || '')
    } : null,
    socialLinks: normalizeSocialLinks(profile.socialLinks, { validate: false }),
    profileComplete: profileCompletion(profile).missingMandatory.length === 0,
    placementStatus: placementStatus(applications),
    applicationCount: applications.length,
    applications
  };
}

function mapApplicationsByStudent(applications) {
  const byStudent = new Map();
  for (const application of applications) {
    const studentApplications = byStudent.get(application.studentId) || [];
    studentApplications.push(application);
    byStudent.set(application.studentId, studentApplications);
  }
  return byStudent;
}

function branchPlacement(students) {
  const branches = new Map();
  for (const student of students) {
    const branch = student.branch || 'Not provided';
    const summary = branches.get(branch) || { branch, totalStudents: 0, placedStudents: 0 };
    summary.totalStudents += 1;
    if (student.placementStatus === 'Placed') summary.placedStudents += 1;
    branches.set(branch, summary);
  }
  return [...branches.values()]
    .map((branch) => ({ ...branch, placementPercentage: branch.totalStudents ? (branch.placedStudents / branch.totalStudents) * 100 : 0 }))
    .sort((left, right) => right.totalStudents - left.totalStudents || left.branch.localeCompare(right.branch));
}

function statusDistribution(applications) {
  const counts = new Map();
  for (const application of applications) counts.set(application.status, (counts.get(application.status) || 0) + 1);
  return [...counts.entries()]
    .map(([status, count]) => ({ status, applications: count }))
    .sort((left, right) => right.applications - left.applications || left.status.localeCompare(right.status));
}

function attachStudentToApplication(application, studentsById) {
  const student = studentsById.get(application.studentId);
  return {
    ...application,
    student: student ? {
      studentId: student.studentId,
      fullName: student.fullName,
      branch: student.branch,
      cgpa: student.cgpa,
      graduationYear: student.graduationYear,
      placementStatus: student.placementStatus
    } : null
  };
}

export async function getTpoDataset() {
  const [profiles, drives] = await Promise.all([
    listStudentProfilesForTpo(),
    listCampusJobsForManagement()
  ]);
  const applications = await listCampusApplicationsForManagement(drives);
  const applicationsByStudent = mapApplicationsByStudent(applications);
  const students = profiles.map((profile) => publicStudent(profile, applicationsByStudent.get(String(profile.userId)) || []));
  const studentsById = new Map(students.map((student) => [student.studentId, student]));
  return { students, applications: applications.map((application) => attachStudentToApplication(application, studentsById)), drives };
}

export async function getTpoDashboard() {
  const { students, applications, drives } = await getTpoDataset();
  const now = Date.now();
  const activeDrives = drives.filter((drive) => drive.jobStatus === 'PUBLISHED' && drive.status === 'active');
  const upcomingDrives = activeDrives
    .filter((drive) => drive.deadline && new Date(drive.deadline).getTime() >= now)
    .sort((left, right) => new Date(left.deadline || 0).getTime() - new Date(right.deadline || 0).getTime())
    .slice(0, 6);
  const placedStudents = students.filter((student) => student.placementStatus === 'Placed').length;
  return {
    summary: {
      totalStudents: students.length,
      completeProfiles: students.filter((student) => student.profileComplete).length,
      activeDrives: activeDrives.length,
      totalApplications: applications.length,
      shortlistedStudents: new Set(applications.filter((application) => application.status === 'Shortlisted').map((application) => application.studentId)).size,
      studentsPlaced: placedStudents,
      studentsSeekingPlacement: students.length - placedStudents
    },
    upcomingDrives,
    recentApplications: applications.slice(0, 8),
    recentPlacementActivity: applications.filter((application) => ['Offer', 'Shortlisted', 'Interview'].includes(application.status)).slice(0, 8),
    branchPlacement: branchPlacement(students),
    applicationStatusDistribution: statusDistribution(applications),
    placementDataModelNote: 'Placement is currently derived from recorded Offer-stage applications. Dedicated placement-status and CTC records are not stored yet.'
  };
}

export async function getTpoStudents() {
  const { students } = await getTpoDataset();
  return students;
}

export async function getTpoStudent(studentId) {
  const students = await getTpoStudents();
  return students.find((student) => student.studentId === String(studentId)) || null;
}

export async function getTpoApplications() {
  const { applications } = await getTpoDataset();
  return applications;
}

export async function getTpoNotifications() {
  const dashboard = await getTpoDashboard();
  const deadlineItems = dashboard.upcomingDrives.map((drive) => ({
    id: `deadline-${drive.id}`,
    type: 'drive_deadline',
    title: `${drive.companyName || 'Campus drive'} deadline approaching`,
    message: `${drive.role || 'Role'} closes on ${drive.deadline ? new Date(drive.deadline).toLocaleDateString('en-IN') : 'an upcoming date'}.`,
    createdAt: drive.deadline,
    relatedJobId: drive.id
  }));
  const applicationItems = dashboard.recentApplications.map((application) => ({
    id: `application-${application.id}`,
    type: 'application',
    title: `Application: ${application.job?.companyName || 'Campus drive'}`,
    message: `${application.student?.fullName || 'A student'} is currently ${String(application.status || '').toLowerCase() || 'in process'}.`,
    createdAt: application.updatedAt || application.appliedAt,
    relatedJobId: application.jobId
  }));
  return [...deadlineItems, ...applicationItems]
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 20);
}
