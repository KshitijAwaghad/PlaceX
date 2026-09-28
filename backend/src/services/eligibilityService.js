function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function strings(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function checkCgpa(profile, job) {
  const studentValue = Number.isFinite(profile.cgpa) ? profile.cgpa : null;
  const requiredValue = Number(job.minimumCgpa || 0);
  return { passed: studentValue !== null && studentValue >= requiredValue, studentValue, requiredValue };
}

function checkBacklogs(profile, job) {
  const studentValue = Number.isInteger(profile.backlogs) ? profile.backlogs : null;
  const maximumAllowed = Number(job.maximumBacklogs ?? 0);
  return { passed: studentValue !== null && studentValue <= maximumAllowed, studentValue, maximumAllowed };
}

function checkBranch(profile, job) {
  const eligibleBranches = strings(job.eligibleBranches);
  const studentValue = String(profile.branch || '');
  const passed = eligibleBranches.length === 0 || eligibleBranches.some((branch) => normalized(branch) === normalized(studentValue) || normalized(branch) === 'all');
  return { passed, studentValue, eligibleBranches };
}

function checkGraduationYear(profile, job) {
  const eligibleYears = strings(job.graduationYears).map(Number).filter(Number.isInteger);
  const studentValue = Number.isInteger(profile.graduationYear) ? profile.graduationYear : null;
  return { passed: eligibleYears.length === 0 || (studentValue !== null && eligibleYears.includes(studentValue)), studentValue, eligibleYears };
}

function checkSkills(profile, job) {
  const required = strings(job.requiredSkills);
  const studentSkills = strings(profile.skills);
  const normalizedStudentSkills = new Set(studentSkills.map(normalized));
  const matched = required.filter((skill) => normalizedStudentSkills.has(normalized(skill)));
  const missing = required.filter((skill) => !normalizedStudentSkills.has(normalized(skill)));
  return { passed: missing.length === 0, matched, missing, required };
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
  return { eligible: Object.values(checks).every((check) => check.passed), checks, reasons };
}
