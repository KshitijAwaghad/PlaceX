import { createRequire } from 'node:module';
import { getGeminiInstantPlan, resources, priorityFor } from './aiService.js';
import { findCareerAnalysis, listCareerAnalyses } from './analysisHistoryService.js';
import { getJobsCollection, getInstantPlansCollection } from './database.js';
import { getStudentProfile } from './profileService.js';
import { normalizeSkill, uniqueSkills } from './skillNormalization.js';

const require = createRequire(import.meta.url);
const profileCatalog = require('../../../shared/profileCatalog.json');

export const VALID_DURATIONS = [6, 12, 18];

export const roleSkillMap = Object.freeze({
  'Software Engineer': ['Problem Solving', 'Data Analysis', 'Java', 'Python', 'SQL', 'Git', 'REST API', 'System Design'],
  'Software Developer': ['JavaScript', 'Python', 'Java', 'SQL', 'Git', 'REST API'],
  'Full Stack Developer': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Express.js', 'MongoDB', 'REST API', 'Git'],
  'Frontend Developer': ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'REST API', 'Git'],
  'Backend Developer': ['Node.js', 'Express.js', 'REST API', 'SQL', 'PostgreSQL', 'MongoDB', 'Git'],
  'React Developer': ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Redux', 'REST API', 'Git'],
  'Node.js Developer': ['Node.js', 'Express.js', 'JavaScript', 'TypeScript', 'REST API', 'MongoDB', 'SQL', 'Git'],
  'Java Developer': ['Java', 'Spring', 'Spring Boot', 'SQL', 'MySQL', 'REST API', 'Git', 'JUnit'],
  'Python Developer': ['Python', 'Django', 'Flask', 'FastAPI', 'SQL', 'PostgreSQL', 'REST API', 'Git'],
  'Data Analyst': ['SQL', 'Python', 'Excel', 'Power BI', 'Tableau', 'Data Analysis', 'Data Visualization', 'Data Cleaning'],
  'Data Scientist': ['Python', 'SQL', 'Machine Learning', 'Pandas', 'NumPy', 'Scikit-learn', 'Data Analysis', 'Statistical Analysis'],
  'Machine Learning Engineer': ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'Docker'],
  'AI Engineer': ['Python', 'Artificial Intelligence', 'Deep Learning', 'NLP', 'Generative AI', 'LLM', 'LangChain', 'REST API'],
  'DevOps Engineer': ['Linux', 'Git', 'Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions', 'AWS', 'Terraform'],
  'Cloud Engineer': ['AWS', 'Microsoft Azure', 'Docker', 'Kubernetes', 'Linux', 'Git', 'REST API'],
  'Cybersecurity Analyst': ['Linux', 'Python', 'Communication', 'Problem Solving'],
  'QA Engineer': ['Jest', 'Cypress', 'Selenium', 'Postman', 'JavaScript', 'Git'],
  'Automation Test Engineer': ['Selenium', 'Cypress', 'JUnit', 'Postman', 'Python', 'Java', 'Git'],
  'Embedded Systems Engineer': ['Embedded Systems', 'C', 'C++', 'ARM', 'UART', 'SPI', 'I2C', 'PCB Design', 'MATLAB/Simulink'],
  'IoT Engineer': ['IoT', 'Arduino', 'Raspberry Pi', 'ESP32', 'Python', 'MQTT', 'Embedded Systems'],
  'Business Analyst': ['Excel', 'SQL', 'Power BI', 'Tableau', 'Business Intelligence', 'KPIs', 'Communication']
});

export function detectRoleTitle(text) {
  if (!text || typeof text !== 'string') return null;
  for (const role of profileCatalog.roleOptions) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      return role;
    }
  }
  for (const [alias, canonicalRole] of Object.entries(profileCatalog.roleAliases || {})) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
      return canonicalRole;
    }
  }
  const firstLine = text.split('\n')[0]?.trim();
  if (firstLine && firstLine.length <= 60 && !firstLine.includes('.')) {
    return firstLine;
  }
  return null;
}

export async function resolveMissingSkillsForUser(user, requestedAnalysisId = null) {
  // Priority 1: Missing skills from existing role/fit analysis if provided or available
  if (requestedAnalysisId) {
    const saved = await findCareerAnalysis(user.id, requestedAnalysisId);
    if (saved && Array.isArray(saved.analysis?.missingSkills) && saved.analysis.missingSkills.length > 0) {
      const detected = detectRoleTitle(saved.jobDescription) || detectRoleTitle(saved.resume?.originalName);
      const roleName = detected || 'Role Analysis';
      return {
        source: {
          type: 'role_analysis',
          role: roleName,
          label: `${roleName} Analysis`,
          analysisId: saved.id
        },
        missingSkills: saved.analysis.missingSkills,
        prioritizedGaps: saved.analysis.prioritizedGaps || saved.analysis.missingSkills.map((skill) => ({
          skill,
          priority: priorityFor(saved.jobDescription, skill),
          reason: `Requirement in analyzed job description.`
        })),
        context: saved.jobDescription
      };
    }
  }

  // If no analysisId was explicitly provided, check if the student has a recent saved career analysis
  const recentAnalyses = await listCareerAnalyses(user.id, 3);
  const candidateSaved = recentAnalyses.find((item) => Array.isArray(item.missingSkills) && item.missingSkills.length > 0);
  if (candidateSaved) {
    const fullSaved = await findCareerAnalysis(user.id, candidateSaved.id);
    if (fullSaved && Array.isArray(fullSaved.analysis?.missingSkills) && fullSaved.analysis.missingSkills.length > 0) {
      const detected = detectRoleTitle(fullSaved.jobDescription);
      const roleName = detected || 'Role Analysis';
      return {
        source: {
          type: 'role_analysis',
          role: roleName,
          label: `${roleName} Analysis`,
          analysisId: fullSaved.id
        },
        missingSkills: fullSaved.analysis.missingSkills,
        prioritizedGaps: fullSaved.analysis.prioritizedGaps || fullSaved.analysis.missingSkills.map((skill) => ({
          skill,
          priority: priorityFor(fullSaved.jobDescription, skill),
          reason: `Requirement in analyzed job description.`
        })),
        context: fullSaved.jobDescription
      };
    }
  }

  // Priority 2: Missing skills derived from student's profile and target role
  const profile = await getStudentProfile(user);
  const preferredRoles = Array.isArray(profile.preferredRoles) ? profile.preferredRoles : [];
  const studentSkillSet = new Set(uniqueSkills(profile.skills || []).map(normalizeSkill));

  if (preferredRoles.length > 0) {
    const targetRole = preferredRoles[0];
    let requiredSkills = [];

    // Check if there is an active job in the system matching this role
    try {
      const matchingJob = await (await getJobsCollection()).findOne({
        role: { $regex: new RegExp(targetRole, 'i') },
        requiredSkills: { $exists: true, $ne: [] }
      });
      if (matchingJob?.requiredSkills?.length) {
        requiredSkills = uniqueSkills(matchingJob.requiredSkills);
      }
    } catch {
      // Continue with catalog mapping if database query encounters any error
    }

    if (!requiredSkills.length) {
      requiredSkills = roleSkillMap[targetRole] || roleSkillMap[profileCatalog.roleAliases?.[targetRole.toLowerCase()]] || [];
    }

    const missing = requiredSkills.filter((s) => !studentSkillSet.has(normalizeSkill(s)));
    if (missing.length > 0) {
      const prioritizedGaps = missing.map((skill, index) => ({
        skill,
        priority: index < 2 ? 'High' : (index < 4 ? 'Medium' : 'Low'),
        reason: `Target requirement for ${targetRole}.`
      }));
      return {
        source: {
          type: 'profile_role',
          role: targetRole,
          label: `${targetRole} Role (from Profile)`
        },
        missingSkills: missing,
        prioritizedGaps,
        context: `Target Role: ${targetRole}`
      };
    }
  }

  // Priority 3: Existing profile-based skill gap logic
  const profileSkills = uniqueSkills(profile.skills || []);
  if (profileSkills.length > 0) {
    const complementary = [];
    const has = (s) => studentSkillSet.has(normalizeSkill(s));

    if (has('React') || has('HTML') || has('CSS')) {
      ['TypeScript', 'REST API', 'Git', 'Testing', 'CI/CD'].forEach((s) => {
        if (!has(s)) complementary.push(s);
      });
    } else if (has('Node.js') || has('Express.js')) {
      ['PostgreSQL', 'Docker', 'REST API', 'Redis', 'Testing'].forEach((s) => {
        if (!has(s)) complementary.push(s);
      });
    } else if (has('Python')) {
      ['SQL', 'FastAPI', 'Docker', 'Data Analysis', 'Git'].forEach((s) => {
        if (!has(s)) complementary.push(s);
      });
    } else if (has('Java')) {
      ['Spring Boot', 'SQL', 'REST API', 'Docker', 'Git'].forEach((s) => {
        if (!has(s)) complementary.push(s);
      });
    } else {
      ['Git', 'SQL', 'REST API', 'Problem Solving', 'Docker'].forEach((s) => {
        if (!has(s)) complementary.push(s);
      });
    }

    const uniqueGaps = [...new Set(complementary)].slice(0, 5);
    if (uniqueGaps.length > 0) {
      const prioritizedGaps = uniqueGaps.map((skill, index) => ({
        skill,
        priority: index < 2 ? 'High' : (index < 4 ? 'Medium' : 'Low'),
        reason: `High-value complementary skill for your profile.`
      }));
      return {
        source: {
          type: 'profile',
          role: 'Your Profile',
          label: 'Your Current Profile'
        },
        missingSkills: uniqueGaps,
        prioritizedGaps,
        context: 'Profile skills'
      };
    }
  }

  // Edge Case: No meaningful missing skills detected
  return {
    source: {
      type: 'empty',
      role: '',
      label: 'Your Current Profile'
    },
    missingSkills: [],
    prioritizedGaps: [],
    context: ''
  };
}

function skillDomain(skill) {
  const s = String(skill || '').toLowerCase();
  if (/\b(react|angular|vue|next\.?js|redux|frontend|css|html|tailwind|ui)\b/.test(s)) return 'frontend';
  if (/\b(node|express|nest|spring|django|flask|fastapi|backend|api)\b/.test(s)) return 'backend';
  if (/\b(sql|mysql|postgres|mongodb|database|redis|sqlite)\b/.test(s)) return 'database';
  if (/\b(docker|kubernetes|aws|cloud|azure|devops|terraform|ci\/?cd|git|linux)\b/.test(s)) return 'cloud_devops';
  if (/\b(data analysis|data cleaning|pandas|numpy|power bi|tableau|bi|analytics|visualization|excel|r)\b/.test(s)) return 'data_analytics';
  if (/\b(machine learning|deep learning|nlp|ai|llm|tensorflow|pytorch|scikit)\b/.test(s)) return 'ai_ml';
  if (/\b(testing|jest|cypress|selenium|postman|junit|qa)\b/.test(s)) return 'testing';
  if (/\b(typescript)\b/.test(s)) return 'typescript';
  return 'general';
}

function generateStepContent(skill, roleContext) {
  const domain = skillDomain(skill);
  switch (domain) {
    case 'frontend':
      return {
        title: `${skill} Component Architecture & State`,
        learn: [
          `Component lifecycle and state management fundamentals with ${skill}`,
          'Props contracts, component reusability, and handling async data streams',
          'Responsive layouts, loading states, and client-side form validation',
          'Error boundaries and performance optimization best practices'
        ],
        practice: [
          `Build a functional ${skill} component featuring search/filter controls and dynamic list rendering`,
          'Connect the component to a mock REST endpoint and handle loading and error states',
          'Add user interaction feedback and state validation'
        ],
        outcome: `Able to design, build, and debug interactive ${skill} UI components ready for production use.`
      };
    case 'typescript':
      return {
        title: 'TypeScript Type Safety & Interfaces',
        learn: [
          'Static typing vs dynamic typing, type inference, and primitive annotations',
          'Interfaces, custom type aliases, and union / intersection types',
          'Generics and utility types (Partial, Pick, Omit)',
          'Strict null checks, narrowing, and type assertions'
        ],
        practice: [
          'Define structured TypeScript interfaces for API requests and response payloads',
          'Refactor untyped functions to strictly typed generic helpers',
          'Implement discriminating union types for handling multi-state application flows'
        ],
        outcome: 'Able to write type-safe code that eliminates runtime type errors and documents data models cleanly.'
      };
    case 'backend':
      return {
        title: `${skill} RESTful Services & Middleware`,
        learn: [
          `Request-response lifecycle and routing architecture in ${skill}`,
          'Middleware patterns for authentication, logging, and error handling',
          'Input validation, sanitization, and HTTP status codes',
          'Database connectivity and environment configuration management'
        ],
        practice: [
          `Implement REST API endpoints using ${skill} with CRUD operations`,
          'Add centralized error-handling middleware that returns clean JSON responses',
          'Validate incoming payload schemas and write a test request script'
        ],
        outcome: `Able to engineer modular, secure REST endpoints using ${skill} with standard HTTP protocols.`
      };
    case 'database':
      return {
        title: `${skill} Schema Modeling & Efficient Queries`,
        learn: [
          `Core data storage paradigms and schema design in ${skill}`,
          'Writing multi-table joins, aggregations, and grouped metric queries',
          'Indexing strategies to prevent slow table scans',
          'Transactions, data integrity constraints, and query execution plans'
        ],
        practice: [
          `Design a relational or document schema using ${skill} for a core application feature`,
          'Write multi-step queries with aggregations and date filtering',
          'Profile a query execution plan and add an index to optimize performance'
        ],
        outcome: `Able to model reliable data schemas and craft high-performance queries using ${skill}.`
      };
    case 'cloud_devops':
      return {
        title: `${skill} Containerization & Deployment Workflows`,
        learn: [
          `Foundations, architecture, and configuration conventions of ${skill}`,
          'Resource definitions, networking, and secret/environment variable management',
          'Automation triggers, build stages, and artifact distribution',
          'Observability, logging, and troubleshooting runtime deployment errors'
        ],
        practice: [
          `Author a clean configuration file or pipeline script for ${skill}`,
          'Deploy and run a service locally or in a sandbox environment',
          'Simulate a configuration change and verify service health checks'
        ],
        outcome: `Able to automate build and runtime infrastructure using ${skill} following industry standards.`
      };
    case 'data_analytics':
      return {
        title: `${skill} Data Wrangling & KPI Insights`,
        learn: [
          `Data cleaning workflows, handling missing values, and outlier mitigation in ${skill}`,
          'Aggregating business metrics, cohort breakdowns, and ratio calculations',
          'Visual hierarchy principles and building decision-ready dashboards',
          'Translating raw datasets into actionable recommendations for stakeholders'
        ],
        practice: [
          `Import and profile an unclean dataset using ${skill} to fix anomalies`,
          'Calculate top-line KPIs and segment comparisons',
          'Create an executive visual dashboard with filter controls and narrative highlights'
        ],
        outcome: `Able to clean datasets and deliver trustworthy data visualizations using ${skill}.`
      };
    case 'ai_ml':
      return {
        title: `${skill} Model Workflows & Practical Implementation`,
        learn: [
          `Problem framing, data preparation, and feature representations for ${skill}`,
          'Training pipelines, evaluation metrics (accuracy, precision, recall, F1)',
          'Prompt engineering / inference optimization and context handling',
          'Integrating inference outputs into software applications'
        ],
        practice: [
          `Build an end-to-end script using ${skill} that takes raw input and generates predictions/embeddings`,
          'Evaluate model outputs against baseline test samples',
          'Wrap the workflow into a reusable function with schema validation'
        ],
        outcome: `Able to implement and evaluate practical ${skill} solutions integrated into software workflows.`
      };
    case 'testing':
      return {
        title: `${skill} Automated Test Suites & Quality Assurance`,
        learn: [
          'The testing pyramid: unit tests, integration tests, and end-to-end flows',
          `Assertion libraries, matchers, and test lifecycle hooks in ${skill}`,
          'Mocking external network requests, database layers, and timed events',
          'Code coverage reports and identifying critical edge cases'
        ],
        practice: [
          `Write comprehensive unit tests with ${skill} for core business calculations`,
          'Construct an integration test that mocks an external service response',
          'Set up automated test execution and verify passing exit codes'
        ],
        outcome: `Able to create reliable test suites using ${skill} that catch regressions before deployment.`
      };
    default:
      return {
        title: `${skill} Core Principles & Practical Application`,
        learn: [
          `Core concepts, design paradigms, and foundational syntax of ${skill}`,
          `Industry standard patterns and best practices for ${skill} in a modern tech stack`,
          'Debugging techniques and understanding common failure modes',
          'Integrating the skill into larger software architecture'
        ],
        practice: [
          `Build a focused, standalone exercise that demonstrates working proficiency with ${skill}`,
          'Test boundary conditions and document configuration choices',
          'Refactor the implementation for readability and maintainability'
        ],
        outcome: `Able to apply ${skill} effectively to solve job-relevant technical requirements.`
      };
  }
}

export function enforceExactDuration(steps, durationHours) {
  const targetMinutes = durationHours * 60;
  if (!Array.isArray(steps) || steps.length === 0) return steps;

  const currentTotal = steps.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
  if (currentTotal === targetMinutes) return steps;

  // Scale proportionately then round to nearest 5 minutes
  const scaled = steps.map((s) => {
    const raw = (Number(s.durationMinutes) || (targetMinutes / steps.length)) * (targetMinutes / Math.max(currentTotal, 1));
    const rounded = Math.max(15, Math.round(raw / 5) * 5);
    return { ...s, durationMinutes: rounded };
  });

  const scaledTotal = scaled.reduce((sum, s) => sum + s.durationMinutes, 0);
  const remainder = targetMinutes - scaledTotal;
  // Apply remainder to the final step or largest step so sum exactly equals targetMinutes
  scaled[scaled.length - 1].durationMinutes += remainder;

  return scaled;
}

export function generateDeterministicPlan({ missingSkills, prioritizedGaps = [], durationHours = 12, roleContext = '' }) {
  const targetMinutes = durationHours * 60;
  const sortedGaps = [...prioritizedGaps].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });

  const gaps = sortedGaps.length > 0 ? sortedGaps : missingSkills.map((s, i) => ({
    skill: s,
    priority: i === 0 ? 'High' : (i === 1 ? 'Medium' : 'Low')
  }));

  const steps = [];

  if (durationHours === 6) {
    // 6-HOUR PLAN: 360 minutes sprint
    if (gaps.length === 1) {
      const g1 = gaps[0];
      const c1 = generateStepContent(g1.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 240,
        title: `${g1.skill} Core Sprint`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g1.skill,
        priority: 'High',
        durationMinutes: 120,
        title: 'Practical Build & Rapid Skill Check',
        learn: [
          'Review error scenarios and edge cases in the implementation',
          'Code refactoring for readability and maintainability'
        ],
        practice: [
          `Execute a timed coding task exercising ${g1.skill}`,
          'Test error handling and document results'
        ],
        outcome: `Self-validated fluency in ${g1.skill} demonstrated through hands-on code.`
      });
    } else if (gaps.length === 2) {
      const g1 = gaps[0];
      const g2 = gaps[1];
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 150,
        title: `${g1.skill}: Foundation & Hands-on`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 120,
        title: `${g2.skill}: Working Implementation`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: `${g1.skill} + ${g2.skill}`,
        priority: 'High',
        durationMinutes: 90,
        title: 'Integrated Practice & Final Skill Check',
        learn: [
          `Integration patterns connecting ${g1.skill} and ${g2.skill}`,
          'Common interview troubleshooting scenarios'
        ],
        practice: [
          `Build a unified mini-exercise connecting ${g1.skill} and ${g2.skill}`,
          'Verify execution and document findings'
        ],
        outcome: `Able to demonstrate working integration between ${g1.skill} and ${g2.skill}.`
      });
    } else {
      // 3 or more gaps
      const g1 = gaps[0];
      const g2 = gaps[1];
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 135,
        title: `${g1.skill}: High-Impact Focus`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 135,
        title: `${g2.skill}: Core Implementation`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: 'Cross-Skill Sprint',
        priority: 'High',
        durationMinutes: 90,
        title: 'Rapid Application & Skill Check',
        learn: [
          'Review key takeaways and architectural relationships',
          'Practice 2-minute technical elevator pitches'
        ],
        practice: [
          'Execute a rapid verification build incorporating the highest-impact gaps',
          'Self-evaluate against the job requirement checklist'
        ],
        outcome: 'Completed focused sprint addressing top blockers for the role.'
      });
    }
  } else if (durationHours === 12) {
    // 12-HOUR PLAN: 720 minutes
    if (gaps.length === 1) {
      const g1 = gaps[0];
      const c1 = generateStepContent(g1.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 300,
        title: `${g1.skill}: Foundations & Patterns`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g1.skill,
        priority: 'High',
        durationMinutes: 270,
        title: `${g1.skill}: Advanced Practical Build`,
        learn: [
          `Advanced architectural patterns and modular structure in ${g1.skill}`,
          'Handling performance bottlenecks, caching, and state synchronization',
          'Production error resilience and logging best practices'
        ],
        practice: [
          `Build an end-to-end functional feature using ${g1.skill}`,
          'Add automated tests or validation scripts',
          'Document architectural decisions in a README'
        ],
        outcome: `Deep, working command of ${g1.skill} ready for technical interviews and coding rounds.`
      });
      steps.push({
        order: 3,
        skill: g1.skill,
        priority: 'Medium',
        durationMinutes: 150,
        title: 'Comprehensive Practice & Final Skill Check',
        learn: [
          'Interview-oriented concept review and trade-off questions',
          'Live coding preparation and debugging walkthroughs'
        ],
        practice: [
          'Complete a timed problem-solving scenario',
          'Deliver an annotated walkthrough of the build'
        ],
        outcome: `Confident interview readiness and verified fluency in ${g1.skill}.`
      });
    } else if (gaps.length === 2) {
      const g1 = gaps[0];
      const g2 = gaps[1];
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 300,
        title: `${g1.skill}: Deep Dive & Implementation`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 270,
        title: `${g2.skill}: Practical Build & Patterns`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: `${g1.skill} + ${g2.skill}`,
        priority: 'High',
        durationMinutes: 150,
        title: 'System Integration & Final Skill Check',
        learn: [
          `Architectural boundaries between ${g1.skill} and ${g2.skill}`,
          'Data flow, serialization, and error propagation',
          'Technical communication and architecture review'
        ],
        practice: [
          `Connect ${g1.skill} and ${g2.skill} into a cohesive runnable project module`,
          'Write a checklist of key edge cases and test them'
        ],
        outcome: `Working integrated deliverable combining ${g1.skill} and ${g2.skill}.`
      });
    } else if (gaps.length === 3) {
      const [g1, g2, g3] = gaps;
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      const c3 = generateStepContent(g3.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 240,
        title: `${g1.skill}: Core Mastery`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 210,
        title: `${g2.skill}: Practical Application`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: g3.skill,
        priority: g3.priority,
        durationMinutes: 150,
        title: `${g3.skill}: Targeted Exercise`,
        learn: c3.learn,
        practice: c3.practice,
        outcome: c3.outcome,
        resources: resources[g3.skill] || []
      });
      steps.push({
        order: 4,
        skill: 'Integrated Build',
        priority: 'High',
        durationMinutes: 120,
        title: 'Project Integration & Final Skill Check',
        learn: [
          'End-to-end integration and technical storytelling',
          'Common interview pitfalls and debugging questions'
        ],
        practice: [
          'Assemble the components into a cohesive demo workflow',
          'Perform a timed technical walkthrough answering verification questions'
        ],
        outcome: 'Validated mastery of top 3 skill gaps with demonstrable proof.'
      });
    } else {
      // 4 or more gaps: focus on top 3 + integration
      const [g1, g2, g3] = gaps;
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      const c3 = generateStepContent(g3.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 210,
        title: `${g1.skill}: High-Priority Sprint`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 180,
        title: `${g2.skill}: Working Implementation`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: g3.skill,
        priority: g3.priority,
        durationMinutes: 180,
        title: `${g3.skill}: Practical Exercises`,
        learn: c3.learn,
        practice: c3.practice,
        outcome: c3.outcome,
        resources: resources[g3.skill] || []
      });
      steps.push({
        order: 4,
        skill: 'Multi-Skill Integration',
        priority: 'High',
        durationMinutes: 150,
        title: 'Synthesis, Review & Final Skill Check',
        learn: [
          'Combining multi-tier components into a coherent architecture',
          'Key interview discussion points and trade-off rationales'
        ],
        practice: [
          'Build an integrated prototype combining the learned skills',
          'Complete the final verification questions'
        ],
        outcome: 'Solid foundation in priority skills with verified project evidence.'
      });
    }
  } else {
    // 18-HOUR PLAN: 1080 minutes
    if (gaps.length === 1) {
      const g1 = gaps[0];
      const c1 = generateStepContent(g1.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 420,
        title: `${g1.skill}: Comprehensive Foundations & Patterns`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g1.skill,
        priority: 'High',
        durationMinutes: 390,
        title: `${g1.skill}: Production Build & Resilient Architecture`,
        learn: [
          `Advanced concurrency, state flow, and optimization in ${g1.skill}`,
          'Security best practices, input sanitization, and vulnerability checks',
          'Unit, integration, and contract testing conventions'
        ],
        practice: [
          `Architect and code a full-scale feature module in ${g1.skill}`,
          'Implement unit and integration tests with coverage assertions',
          'Simulate edge-case failures and verify graceful degradation'
        ],
        outcome: `Production-grade engineering fluency in ${g1.skill}.`
      });
      steps.push({
        order: 3,
        skill: g1.skill,
        priority: 'Medium',
        durationMinutes: 270,
        title: 'Interview Deep Dive & Final Skill Check',
        learn: [
          'System architecture trade-offs and performance tuning',
          'Mock technical interview questions and code review critique'
        ],
        practice: [
          'Perform a 30-minute live coding challenge',
          'Document a technical post-mortem describing design choices'
        ],
        outcome: `Interview-proven mastery and demonstrable code sample in ${g1.skill}.`
      });
    } else if (gaps.length === 2) {
      const [g1, g2] = gaps;
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 450,
        title: `${g1.skill}: Deep Dive & Mastery`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 390,
        title: `${g2.skill}: Comprehensive Implementation`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: `${g1.skill} + ${g2.skill}`,
        priority: 'High',
        durationMinutes: 240,
        title: 'End-to-End Build & Final Skill Check',
        learn: [
          `Full-stack cohesion connecting ${g1.skill} and ${g2.skill}`,
          'Automated validation, documentation, and interview walkthrough prep'
        ],
        practice: [
          `Implement an end-to-end workflow uniting ${g1.skill} and ${g2.skill}`,
          'Complete the final verification challenges'
        ],
        outcome: `Fully working, documented portfolio-grade feature uniting ${g1.skill} and ${g2.skill}.`
      });
    } else if (gaps.length === 3) {
      const [g1, g2, g3] = gaps;
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      const c3 = generateStepContent(g3.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 360,
        title: `${g1.skill}: Fundamentals & Hands-on`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 300,
        title: `${g2.skill}: Practical Implementation`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: g3.skill,
        priority: g3.priority,
        durationMinutes: 240,
        title: `${g3.skill}: Application & Patterns`,
        learn: c3.learn,
        practice: c3.practice,
        outcome: c3.outcome,
        resources: resources[g3.skill] || []
      });
      steps.push({
        order: 4,
        skill: 'Integrated Pipeline',
        priority: 'High',
        durationMinutes: 180,
        title: 'System Integration & Final Skill Check',
        learn: [
          'Multi-tier architectural communication and contract verification',
          'Packaging code into portfolio evidence and interview defense'
        ],
        practice: [
          'Build an integrated project module combining all 3 skills',
          'Verify execution with automated assertions and self-assessment questions'
        ],
        outcome: 'Comprehensive hands-on proficiency across all three priority skills.'
      });
    } else {
      const [g1, g2, g3, g4] = gaps;
      const c1 = generateStepContent(g1.skill, roleContext);
      const c2 = generateStepContent(g2.skill, roleContext);
      const c3 = generateStepContent(g3.skill, roleContext);
      const c4 = generateStepContent(g4.skill, roleContext);
      steps.push({
        order: 1,
        skill: g1.skill,
        priority: g1.priority,
        durationMinutes: 300,
        title: `${g1.skill}: Primary Gap Mastery`,
        learn: c1.learn,
        practice: c1.practice,
        outcome: c1.outcome,
        resources: resources[g1.skill] || []
      });
      steps.push({
        order: 2,
        skill: g2.skill,
        priority: g2.priority,
        durationMinutes: 270,
        title: `${g2.skill}: Implementation & Patterns`,
        learn: c2.learn,
        practice: c2.practice,
        outcome: c2.outcome,
        resources: resources[g2.skill] || []
      });
      steps.push({
        order: 3,
        skill: g3.skill,
        priority: g3.priority,
        durationMinutes: 240,
        title: `${g3.skill}: Practical Exercises`,
        learn: c3.learn,
        practice: c3.practice,
        outcome: c3.outcome,
        resources: resources[g3.skill] || []
      });
      steps.push({
        order: 4,
        skill: g4.skill,
        priority: g4.priority,
        durationMinutes: 150,
        title: `${g4.skill}: Targeted Implementation`,
        learn: c4.learn,
        practice: c4.practice,
        outcome: c4.outcome,
        resources: resources[g4.skill] || []
      });
      steps.push({
        order: 5,
        skill: 'Integrated Portfolio',
        priority: 'High',
        durationMinutes: 120,
        title: 'Project Assembly & Final Skill Check',
        learn: [
          'Coherent system architecture and end-to-end data flow',
          'Interview explanation practice and edge-case handling'
        ],
        practice: [
          'Connect the individual implementations into a runnable showcase',
          'Complete the final skill check assessment'
        ],
        outcome: 'Deep multi-skill capability with concrete implementation evidence.'
      });
    }
  }

  const primarySkill = gaps[0]?.skill || 'Core Skill';
  const secondarySkill = gaps[1]?.skill || primarySkill;

  const finalSkillCheck = {
    type: 'practical_validation',
    title: 'Final Skill Check & Practical Verification',
    description: `Validate what you have built and practiced for ${primarySkill}${secondarySkill !== primarySkill ? ` and ${secondarySkill}` : ''}.`,
    tasks: [
      `Run and verify your ${primarySkill} practical exercise with at least one non-trivial input.`,
      `Explain the technical trade-offs of your implementation and how it satisfies the role requirement.`
    ],
    questions: [
      `How does your implementation handle edge cases or unexpected errors in ${primarySkill}?`,
      `If you were asked in an interview to scale or refactor this code, what change would you make first?`
    ]
  };

  const rebalanced = enforceExactDuration(steps, durationHours);

  return {
    steps: rebalanced,
    finalSkillCheck,
    totalMinutes: targetMinutes
  };
}

export async function generateInstantSkillPlan({ user, durationHours = 12, analysisId = null }) {
  const duration = Number(durationHours);
  if (!VALID_DURATIONS.includes(duration)) {
    const error = new Error('Duration must be 6, 12, or 18 hours.');
    error.statusCode = 400;
    error.code = 'INVALID_DURATION';
    throw error;
  }

  const resolved = await resolveMissingSkillsForUser(user, analysisId);

  // If no missing skills are identified, return empty state with clear messaging
  if (!resolved.missingSkills.length) {
    return {
      durationHours: duration,
      source: resolved.source,
      missingSkills: [],
      steps: [],
      totalMinutes: 0,
      message: "Your current profile doesn't have enough detected skill gaps to build a personalized plan."
    };
  }

  const expectedMinutes = duration * 60;
  const missingSkillNames = resolved.missingSkills;
  const missingSkillSet = new Set(missingSkillNames.map(normalizeSkill));

  let planResult = null;

  // Try Gemini generation if API key is configured
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const geminiPlan = await getGeminiInstantPlan({
        missingSkills: resolved.missingSkills,
        prioritizedGaps: resolved.prioritizedGaps,
        durationHours: duration,
        roleContext: resolved.source.label
      });

      if (geminiPlan && Array.isArray(geminiPlan.steps) && geminiPlan.steps.length > 0) {
        // Enforce that steps only cover actual missing skills or multi-skill integration
        const validSteps = geminiPlan.steps.map((step, idx) => {
          const rawSkill = String(step.skill || '').trim();
          const isMatchingActualSkill = missingSkillSet.has(normalizeSkill(rawSkill));
          const safeSkill = isMatchingActualSkill
            ? missingSkillNames.find((s) => normalizeSkill(s) === normalizeSkill(rawSkill)) || rawSkill
            : (idx === geminiPlan.steps.length - 1 ? 'Integrated Practice & Verification' : missingSkillNames[idx % missingSkillNames.length]);

          return {
            order: idx + 1,
            skill: safeSkill,
            priority: ['High', 'Medium', 'Low'].includes(step.priority) ? step.priority : 'High',
            durationMinutes: Number(step.durationMinutes) || 120,
            title: String(step.title || `${safeSkill} Action Sprint`).trim(),
            learn: Array.isArray(step.learn) && step.learn.length ? step.learn.map(String) : [`Study core ${safeSkill} paradigms and patterns`],
            practice: Array.isArray(step.practice) && step.practice.length ? step.practice.map(String) : [`Build a practical hands-on exercise with ${safeSkill}`],
            outcome: String(step.outcome || `Able to apply ${safeSkill} effectively.`).trim(),
            resources: resources[safeSkill] || []
          };
        });

        const rebalancedSteps = enforceExactDuration(validSteps, duration);

        planResult = {
          steps: rebalancedSteps,
          finalSkillCheck: geminiPlan.finalSkillCheck || {
            type: 'practical_validation',
            title: 'Final Skill Check & Practical Verification',
            description: `Verify what you built for ${missingSkillNames.slice(0, 2).join(' and ')}.`,
            tasks: [
              `Execute your practical code exercise with live test inputs.`,
              `Walk through your design choices and explain one trade-off you made.`
            ],
            questions: [
              `How does this solution handle invalid or unexpected input?`,
              `How would you adapt this implementation to a production system?`
            ]
          },
          totalMinutes: expectedMinutes
        };
      }
    } catch (geminiError) {
      console.warn(`Gemini instant plan generation failed; using deterministic fallback: ${geminiError.message}`);
    }
  }

  // Fallback to deterministic plan if Gemini was not used or failed
  if (!planResult) {
    planResult = generateDeterministicPlan({
      missingSkills: resolved.missingSkills,
      prioritizedGaps: resolved.prioritizedGaps,
      durationHours: duration,
      roleContext: resolved.source.label
    });
  }

  // Final assertion: sum of step durations must strictly equal expected minutes
  const totalMinutes = planResult.steps.reduce((sum, s) => sum + s.durationMinutes, 0);
  if (totalMinutes !== expectedMinutes) {
    planResult.steps = enforceExactDuration(planResult.steps, duration);
  }

  const structuredResponse = {
    durationHours: duration,
    source: resolved.source,
    missingSkills: resolved.prioritizedGaps.map((g) => ({
      name: g.skill,
      priority: g.priority
    })),
    steps: planResult.steps,
    finalSkillCheck: planResult.finalSkillCheck,
    totalMinutes: expectedMinutes
  };

  // Save the latest instant plan to database for fast persistence
  try {
    const plansCollection = await getInstantPlansCollection();
    const now = new Date().toISOString();
    await plansCollection.updateOne(
      { userId: user.id },
      {
        $set: {
          ...structuredResponse,
          updatedAt: now
        },
        $setOnInsert: {
          userId: user.id,
          createdAt: now
        }
      },
      { upsert: true }
    );
  } catch (dbError) {
    console.warn(`Could not persist instant plan to database: ${dbError.message}`);
  }

  return structuredResponse;
}

export async function getLatestInstantSkillPlan(userId) {
  try {
    const plansCollection = await getInstantPlansCollection();
    const saved = await plansCollection.findOne({ userId });
    if (!saved) return null;
    const { _id, ...plan } = saved;
    return plan;
  } catch {
    return null;
  }
}
