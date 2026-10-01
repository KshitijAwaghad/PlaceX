import { evaluateEligibility } from './eligibilityService.js';
import { uniqueSkills } from './skillNormalization.js';

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentage(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function applicationStatusByStudent(applications) {
  return new Map(
    applications
      .filter((application) => application?.userId)
      .map((application) => [String(application.userId), typeof application.status === 'string' ? application.status : null])
  );
}

function createBranchSummary(branch) {
  return {
    branch,
    totalStudents: 0,
    eligibleStudents: 0,
    partialMatchStudents: 0,
    notEligibleStudents: 0,
    trainingCandidates: 0,
    skillGaps: new Map()
  };
}

function publicStudent(profile, eligibility, applicationStatus) {
  const requiredSkillCount = eligibility.checks.skills.required.length;
  const matchedSkillCount = eligibility.matchedSkills.length;
  return {
    studentId: String(profile.userId),
    fullName: String(profile.fullName || profile.userId || '').trim(),
    branch: String(profile.branch || '').trim(),
    cgpa: asNumber(profile.cgpa),
    skills: uniqueSkills(profile.skills),
    matchedSkills: eligibility.matchedSkills,
    missingSkills: eligibility.missingSkills,
    skillMatch: {
      matchedSkills: matchedSkillCount,
      requiredSkills: requiredSkillCount,
      percentage: percentage(matchedSkillCount, requiredSkillCount)
    },
    applicationStatus
  };
}

/**
 * Builds live drive analytics from already-loaded student profiles and the
 * canonical eligibility result. It intentionally has no persistence layer so
 * every request reflects the current student and drive records.
 */
export function buildDriveAnalytics(drive, studentProfiles, applications = []) {
  const profiles = Array.isArray(studentProfiles) ? studentProfiles : [];
  const statusByStudent = applicationStatusByStudent(Array.isArray(applications) ? applications : []);
  const skillGapCounts = new Map();
  const branchSummaries = new Map();
  const classifiedStudents = { eligible: [], partialMatch: [], notEligible: [] };

  for (const profile of profiles) {
    const eligibility = evaluateEligibility(profile, drive);
    const satisfiesFixedCriteria = eligibility.branchEligible
      && eligibility.cgpaEligible
      && eligibility.backlogEligible
      && eligibility.graduationYearEligible;
    const category = eligibility.eligible
      ? 'eligible'
      : satisfiesFixedCriteria && eligibility.missingSkills.length > 0
        ? 'partialMatch'
        : 'notEligible';
    const branch = String(profile.branch || '').trim() || 'Not provided';
    const branchSummary = branchSummaries.get(branch) || createBranchSummary(branch);
    const student = publicStudent(profile, eligibility, statusByStudent.get(String(profile.userId)) || null);

    branchSummary.totalStudents += 1;
    if (category === 'eligible') branchSummary.eligibleStudents += 1;
    if (category === 'partialMatch') {
      branchSummary.partialMatchStudents += 1;
      branchSummary.trainingCandidates += 1;
    }
    if (category === 'notEligible') branchSummary.notEligibleStudents += 1;

    for (const skill of eligibility.missingSkills) {
      skillGapCounts.set(skill, (skillGapCounts.get(skill) || 0) + 1);
      branchSummary.skillGaps.set(skill, (branchSummary.skillGaps.get(skill) || 0) + 1);
    }

    branchSummaries.set(branch, branchSummary);
    classifiedStudents[category].push(student);
  }

  const totalStudents = profiles.length;
  const skillGaps = [...skillGapCounts.entries()]
    .map(([skill, studentsMissing]) => ({ skill, studentsMissing, percentage: percentage(studentsMissing, totalStudents) }))
    .sort((left, right) => right.studentsMissing - left.studentsMissing || left.skill.localeCompare(right.skill));
  const branchAnalysis = [...branchSummaries.values()]
    .map((branch) => ({
      branch: branch.branch,
      totalStudents: branch.totalStudents,
      eligibleStudents: branch.eligibleStudents,
      partialMatchStudents: branch.partialMatchStudents,
      notEligibleStudents: branch.notEligibleStudents,
      trainingCandidates: branch.trainingCandidates,
      readinessPercentage: percentage(branch.eligibleStudents, branch.totalStudents)
    }))
    .sort((left, right) => right.totalStudents - left.totalStudents || left.branch.localeCompare(right.branch));
  const branchSkillGaps = [...branchSummaries.values()]
    .map((branch) => ({
      branch: branch.branch,
      totalStudents: branch.totalStudents,
      skillGaps: [...branch.skillGaps.entries()]
        .map(([skill, studentsMissing]) => ({ skill, studentsMissing }))
        .sort((left, right) => right.studentsMissing - left.studentsMissing || left.skill.localeCompare(right.skill))
    }))
    .sort((left, right) => right.totalStudents - left.totalStudents || left.branch.localeCompare(right.branch));

  return {
    drive: { id: drive.id, companyName: drive.companyName, role: drive.role, requiredSkills: uniqueSkills(drive.requiredSkills) },
    summary: {
      totalStudents,
      eligible: classifiedStudents.eligible.length,
      partialMatch: classifiedStudents.partialMatch.length,
      notEligible: classifiedStudents.notEligible.length,
      driveEligibilityReadiness: percentage(classifiedStudents.eligible.length, totalStudents)
    },
    skillGaps,
    branchAnalysis,
    branchSkillGaps,
    trainingPriorities: skillGaps.map((gap, index) => ({ rank: index + 1, ...gap })),
    eligibleStudents: classifiedStudents.eligible,
    trainingCandidates: classifiedStudents.partialMatch,
    notEligibleStudents: classifiedStudents.notEligible
  };
}
