import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectRoleTitle,
  enforceExactDuration,
  generateDeterministicPlan,
  VALID_DURATIONS
} from '../src/services/instantPlanService.js';

test('valid durations include strictly 6, 12, and 18 hours', () => {
  assert.deepEqual(VALID_DURATIONS, [6, 12, 18]);
});

test('detectRoleTitle identifies standard role titles from text', () => {
  assert.equal(detectRoleTitle('We are looking for a skilled Frontend Developer with modern web experience.'), 'Frontend Developer');
  assert.equal(detectRoleTitle('Hiring a Senior Data Analyst for business intelligence.'), 'Data Analyst');
  assert.equal(detectRoleTitle('Looking for a Python Developer proficient in Django and PostgreSQL.'), 'Python Developer');
  assert.equal(detectRoleTitle(''), null);
});

test('enforceExactDuration guarantees sum(durationMinutes) === durationHours * 60', () => {
  // Test 6 hours (360 minutes)
  const steps6 = [
    { order: 1, skill: 'React', durationMinutes: 140 },
    { order: 2, skill: 'TypeScript', durationMinutes: 100 },
    { order: 3, skill: 'Review', durationMinutes: 100 }
  ];
  const rebalanced6 = enforceExactDuration(steps6, 6);
  const sum6 = rebalanced6.reduce((acc, s) => acc + s.durationMinutes, 0);
  assert.equal(sum6, 360);

  // Test 12 hours (720 minutes)
  const steps12 = [
    { order: 1, skill: 'SQL', durationMinutes: 200 },
    { order: 2, skill: 'Python', durationMinutes: 250 },
    { order: 3, skill: 'Docker', durationMinutes: 150 },
    { order: 4, skill: 'Verification', durationMinutes: 100 }
  ];
  const rebalanced12 = enforceExactDuration(steps12, 12);
  const sum12 = rebalanced12.reduce((acc, s) => acc + s.durationMinutes, 0);
  assert.equal(sum12, 720);

  // Test 18 hours (1080 minutes)
  const steps18 = [
    { order: 1, skill: 'Java', durationMinutes: 350 },
    { order: 2, skill: 'Spring Boot', durationMinutes: 300 },
    { order: 3, skill: 'PostgreSQL', durationMinutes: 200 },
    { order: 4, skill: 'Project', durationMinutes: 200 }
  ];
  const rebalanced18 = enforceExactDuration(steps18, 18);
  const sum18 = rebalanced18.reduce((acc, s) => acc + s.durationMinutes, 0);
  assert.equal(sum18, 1080);
});

test('generateDeterministicPlan generates a 6-hour plan equaling exactly 360 minutes', () => {
  const missingSkills = ['React', 'TypeScript'];
  const prioritizedGaps = [
    { skill: 'React', priority: 'High', reason: 'Core library' },
    { skill: 'TypeScript', priority: 'High', reason: 'Type safety' }
  ];

  const plan = generateDeterministicPlan({
    missingSkills,
    prioritizedGaps,
    durationHours: 6,
    roleContext: 'Frontend Developer'
  });

  assert.equal(plan.totalMinutes, 360);
  const stepSum = plan.steps.reduce((sum, s) => sum + s.durationMinutes, 0);
  assert.equal(stepSum, 360);

  // Check structure of each step
  for (const step of plan.steps) {
    assert.ok(step.order >= 1);
    assert.ok(typeof step.skill === 'string' && step.skill.length > 0);
    assert.ok(step.durationMinutes > 0);
    assert.ok(Array.isArray(step.learn) && step.learn.length > 0);
    assert.ok(Array.isArray(step.practice) && step.practice.length > 0);
    assert.ok(typeof step.outcome === 'string' && step.outcome.length > 0);
  }

  // Check finalSkillCheck
  assert.ok(plan.finalSkillCheck);
  assert.ok(plan.finalSkillCheck.title);
  assert.ok(Array.isArray(plan.finalSkillCheck.tasks) && plan.finalSkillCheck.tasks.length > 0);
  assert.ok(Array.isArray(plan.finalSkillCheck.questions) && plan.finalSkillCheck.questions.length > 0);
});

test('generateDeterministicPlan generates a 12-hour plan equaling exactly 720 minutes', () => {
  const missingSkills = ['SQL', 'Python', 'Tableau'];
  const prioritizedGaps = [
    { skill: 'SQL', priority: 'High', reason: 'Essential query language' },
    { skill: 'Python', priority: 'High', reason: 'Core data analysis' },
    { skill: 'Tableau', priority: 'Medium', reason: 'Visualization tool' }
  ];

  const plan = generateDeterministicPlan({
    missingSkills,
    prioritizedGaps,
    durationHours: 12,
    roleContext: 'Data Analyst'
  });

  assert.equal(plan.totalMinutes, 720);
  const stepSum = plan.steps.reduce((sum, s) => sum + s.durationMinutes, 0);
  assert.equal(stepSum, 720);

  // Verifies actionable content
  assert.ok(plan.steps.length >= 3);
  const sqlStep = plan.steps.find((s) => s.skill === 'SQL');
  assert.ok(sqlStep, 'Step for SQL exists');
  assert.ok(sqlStep.learn.some((l) => l.toLowerCase().includes('query') || l.toLowerCase().includes('schema') || l.toLowerCase().includes('sql')));
  assert.ok(sqlStep.practice.length >= 2);
  assert.ok(sqlStep.outcome.length > 10);
});

test('generateDeterministicPlan generates an 18-hour plan equaling exactly 1080 minutes', () => {
  const missingSkills = ['Docker', 'Kubernetes', 'CI/CD'];
  const prioritizedGaps = [
    { skill: 'Docker', priority: 'High', reason: 'Containerization foundation' },
    { skill: 'Kubernetes', priority: 'High', reason: 'Container orchestration' },
    { skill: 'CI/CD', priority: 'Medium', reason: 'Deployment automation' }
  ];

  const plan = generateDeterministicPlan({
    missingSkills,
    prioritizedGaps,
    durationHours: 18,
    roleContext: 'DevOps Engineer'
  });

  assert.equal(plan.totalMinutes, 1080);
  const stepSum = plan.steps.reduce((sum, s) => sum + s.durationMinutes, 0);
  assert.equal(stepSum, 1080);
  assert.ok(plan.steps.length >= 3);
});

test('handles single missing skill properly with exact duration', () => {
  const missingSkills = ['GraphQL'];
  const plan = generateDeterministicPlan({
    missingSkills,
    durationHours: 6
  });

  assert.equal(plan.totalMinutes, 360);
  const sum = plan.steps.reduce((acc, s) => acc + s.durationMinutes, 0);
  assert.equal(sum, 360);
  assert.equal(plan.steps[0].skill, 'GraphQL');
});

test('rejects invalid duration numbers outside of 6, 12, 18', async () => {
  const { generateInstantSkillPlan } = await import('../src/services/instantPlanService.js');
  await assert.rejects(
    async () => {
      await generateInstantSkillPlan({ user: { id: 'u1' }, durationHours: 5 });
    },
    { code: 'INVALID_DURATION' }
  );

  await assert.rejects(
    async () => {
      await generateInstantSkillPlan({ user: { id: 'u1' }, durationHours: 24 });
    },
    { code: 'INVALID_DURATION' }
  );
});

test('deterministic plan strictly uses actual provided skills without hardcoding', () => {
  const customSkills = ['Rust', 'WebAssembly'];
  const plan = generateDeterministicPlan({
    missingSkills: customSkills,
    prioritizedGaps: customSkills.map((s) => ({ skill: s, priority: 'High', reason: 'System need' })),
    durationHours: 12
  });

  const stepSkills = plan.steps.map((s) => s.skill);
  assert.ok(stepSkills.includes('Rust'));
  assert.ok(stepSkills.includes('WebAssembly'));
  // Ensure no hardcoded skills like React or Python leaked in
  assert.equal(stepSkills.includes('React'), false);
  assert.equal(stepSkills.includes('Python'), false);
  assert.equal(plan.totalMinutes, 720);
});

