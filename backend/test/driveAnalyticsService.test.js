import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAdmin } from '../src/middleware/requireAdmin.js';
import { buildDriveAnalytics } from '../src/services/driveAnalyticsService.js';

const drive = {
  id: 'drive-1',
  companyName: 'Example Corp',
  role: 'Developer',
  minimumCgpa: 7,
  maximumBacklogs: 0,
  eligibleBranches: ['Computer Engineering', 'Information Technology'],
  graduationYears: [2027],
  requiredSkills: ['Java', 'Node.js', 'React']
};

function student(userId, skills, overrides = {}) {
  return {
    userId,
    fullName: userId,
    branch: 'Computer Engineering',
    cgpa: 8,
    backlogs: 0,
    graduationYear: 2027,
    skills,
    ...overrides
  };
}

function middlewareResult(role) {
  return new Promise((resolve) => {
    requireAdmin({ user: { role } }, {}, (error) => resolve(error || null));
  });
}

test('builds fit categories and skill-gap analytics from eligibility results', () => {
  const analytics = buildDriveAnalytics(drive, [
    student('eligible', ['Java', 'Node.js', 'React']),
    student('training', ['Java', 'NodeJS'], { branch: 'Information Technology' }),
    student('wrong-branch', ['Java', 'Node.js', 'React'], { branch: 'Electronics' }),
    student('low-cgpa', ['Node.js'], { cgpa: 6.5 }),
    student('backlogs', ['Java', 'Node.js', 'React'], { backlogs: 1 })
  ], [{ userId: 'eligible', status: 'Shortlisted' }]);

  assert.deepEqual(analytics.summary, {
    totalStudents: 5,
    eligible: 1,
    partialMatch: 1,
    notEligible: 3,
    driveEligibilityReadiness: 20
  });
  assert.deepEqual(analytics.skillGaps, [
    { skill: 'React', studentsMissing: 2, percentage: 40 },
    { skill: 'Java', studentsMissing: 1, percentage: 20 }
  ]);
  assert.equal(analytics.trainingCandidates.length, 1);
  assert.equal(analytics.trainingCandidates[0].studentId, 'training');
  assert.deepEqual(analytics.trainingCandidates[0].missingSkills, ['React']);
  assert.equal(analytics.eligibleStudents[0].applicationStatus, 'Shortlisted');
  assert.equal(analytics.eligibleStudents[0].email, undefined);
  assert.equal(analytics.eligibleStudents[0].passwordHash, undefined);
});

test('keeps Java distinct from JavaScript while applying Node.js aliases', () => {
  const analytics = buildDriveAnalytics(
    { ...drive, requiredSkills: ['Java', 'Node.js'] },
    [student('aliases', ['JavaScript', 'node js'])]
  );

  assert.equal(analytics.summary.eligible, 0);
  assert.equal(analytics.summary.partialMatch, 1);
  assert.deepEqual(analytics.trainingCandidates[0].matchedSkills, ['Node.js']);
  assert.deepEqual(analytics.trainingCandidates[0].missingSkills, ['Java']);
});

test('handles empty student populations and drives without required skills', () => {
  const empty = buildDriveAnalytics(drive, []);
  assert.deepEqual(empty.summary, {
    totalStudents: 0,
    eligible: 0,
    partialMatch: 0,
    notEligible: 0,
    driveEligibilityReadiness: 0
  });
  assert.deepEqual(empty.skillGaps, []);

  const noSkillDrive = buildDriveAnalytics({ ...drive, requiredSkills: [] }, [student('ready', [])]);
  assert.equal(noSkillDrive.summary.eligible, 1);
  assert.equal(noSkillDrive.summary.partialMatch, 0);
});

test('summarizes real branch populations and leaves fixed-criteria failures out of training candidates', () => {
  const analytics = buildDriveAnalytics(drive, [
    student('it-training', ['Java'], { branch: 'Information Technology' }),
    student('ce-training', ['React'], { branch: 'Computer Engineering' }),
    student('wrong-year', ['Java'], { graduationYear: 2028, branch: 'Information Technology' })
  ]);

  assert.deepEqual(analytics.branchAnalysis.map(({ branch, totalStudents, trainingCandidates }) => ({ branch, totalStudents, trainingCandidates })), [
    { branch: 'Information Technology', totalStudents: 2, trainingCandidates: 1 },
    { branch: 'Computer Engineering', totalStudents: 1, trainingCandidates: 1 }
  ]);
  assert.equal(analytics.trainingCandidates.some((candidate) => candidate.studentId === 'wrong-year'), false);
  assert.equal(analytics.trainingPriorities[0].studentsMissing, 3);
});

test('allows TPO and admin management routes while rejecting a student analytics request', async () => {
  assert.equal(await middlewareResult('TPO'), null);
  assert.equal(await middlewareResult('ADMIN'), null);
  const error = await middlewareResult('STUDENT');
  assert.equal(error?.statusCode, 403);
  assert.equal(error?.code, 'ADMIN_ACCESS_REQUIRED');
});
