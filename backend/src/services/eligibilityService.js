import { normalizeSkill, uniqueSkills } from './skillNormalization.js';
import { normalizeBranch } from './profileNormalization.js';

function strings(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function numberOrNull(value, integer = false) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && (!integer || Number.isInteger(number)) ? number : null;
}

function checkCgpa(profile, job) {
  const studentValue = numberOrNull(profile.cgpa);
  const requiredValue = numberOrNull(job.minimumCgpa);
  return { passed: requiredValue === null || (studentValue !== null && studentValue >= requiredValue), studentValue, requiredValue };
}

function checkBacklogs(profile, job) {
  const studentValue = numberOrNull(profile.backlogs, true);
  const maximumAllowed = numberOrNull(job.maximumBacklogs, true);
  return { passed: maximumAllowed === null || (studentValue !== null && studentValue <= maximumAllowed), studentValue, maximumAllowed };
}

function checkBranch(profile, job) {
  const eligibleBranches = strings(job.eligibleBranches);
  const studentValue = String(profile.branch || '');
  const passed = eligibleBranches.length === 0 || eligibleBranches.some((branch) => normalizeBranch(branch) === normalizeBranch(studentValue) || normalizeBranch(branch) === 'all');
  return { passed, studentValue, eligibleBranches };
}

function checkGraduationYear(profile, job) {
  const eligibleYears = strings(job.graduationYears).map((year) => numberOrNull(year, true)).filter((year) => year !== null);
  const studentValue = numberOrNull(profile.graduationYear, true);
  return { passed: eligibleYears.length === 0 || (studentValue !== null && eligibleYears.includes(studentValue)), studentValue, eligibleYears };
}

function checkSkills(profile, job) {
  const required = uniqueSkills(job.requiredSkills);
  const studentSkills = uniqueSkills(profile.skills);
  const normalizedStudentSkills = new Set(studentSkills.map(normalizeSkill));
  const matched = required.filter((skill) => normalizedStudentSkills.has(normalizeSkill(skill)));
  const missing = required.filter((skill) => !normalizedStudentSkills.has(normalizeSkill(skill)));
  return { passed: missing.length === 0, matched, missing, required, studentSkillCount: studentSkills.length };
}

export function evaluateEligibility(profile, job) {
  const checks = {
    cgpa: checkCgpa(profile, job),
    backlogs: checkBacklogs(profile, job),
    branch: checkBranch(profile, job),
    graduationYear: checkGraduationYear(profile, job),
    skills: checkSkills(profile, job)
  };
  const reasons = [];
  if (!checks.cgpa.passed) reasons.push(`CGPA requirement is ${checks.cgpa.requiredValue}; your profile shows ${checks.cgpa.studentValue ?? 'not provided'}.`);
  if (!checks.backlogs.passed) reasons.push(`Maximum allowed backlogs are ${checks.backlogs.maximumAllowed}; your profile shows ${checks.backlogs.studentValue ?? 'not provided'}.`);
  if (!checks.branch.passed) reasons.push(`Your branch (${checks.branch.studentValue || 'not provided'}) is not in the eligible branches.`);
  if (!checks.graduationYear.passed) reasons.push(`Your graduation year (${checks.graduationYear.studentValue ?? 'not provided'}) is not eligible.`);
  if (!checks.skills.passed) reasons.push(`Missing required skills: ${checks.skills.missing.join(', ')}.`);
  const eligible = Object.values(checks).every((check) => check.passed);
  return {
    eligible,
    profileComplete: Object.values(checks).every((check) => check.passed || check.requiredValue === null || check.maximumAllowed === null),
    branchEligible: checks.branch.passed,
    cgpaEligible: checks.cgpa.passed,
    backlogEligible: checks.backlogs.passed,
    graduationYearEligible: checks.graduationYear.passed,
    matchedSkills: checks.skills.matched,
    missingSkills: checks.skills.missing,
    criteriaSource: job.sourceType === 'OFF_CAMPUS' ? 'EXTERNAL_REQUIREMENTS' : 'OFFICIAL_TPO_ELIGIBILITY',
    checks,
    reasons
  };
}
