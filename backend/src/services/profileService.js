import { getStudentProfilesCollection } from './database.js';

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'INVALID_PROFILE';
  return error;
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function list(value, maxItems = 30, maxLength = 80) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(source.map((item) => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function numberOrNull(value, label, min, max, integer = false) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw validationError(`${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`);
  }
  return number;
}

function phone(value) {
  const cleaned = String(value || '').replace(/[\s()\-]/g, '');
  if (cleaned && !/^\+?\d{7,15}$/.test(cleaned)) throw validationError('Enter a valid phone number with 7 to 15 digits.');
  return cleaned;
}

function projects(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((project) => {
    const item = project && typeof project === 'object' ? project : {};
    return {
      title: text(item.title, 120),
      description: text(item.description, 500),
      url: text(item.url, 300)
    };
  }).filter((project) => project.title || project.description || project.url);
}

function normalizePartial(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw validationError('Profile data must be an object.');
  const next = {};
  if (own(input, 'fullName')) next.fullName = text(input.fullName, 120);
  if (own(input, 'phone')) next.phone = phone(input.phone);
  if (own(input, 'branch')) next.branch = text(input.branch, 120);
  if (own(input, 'college')) next.college = text(input.college, 160);
  if (own(input, 'cgpa')) next.cgpa = numberOrNull(input.cgpa, 'CGPA', 0, 10);
  if (own(input, 'backlogs')) next.backlogs = numberOrNull(input.backlogs, 'Backlogs', 0, 50, true);
  if (own(input, 'graduationYear')) next.graduationYear = numberOrNull(input.graduationYear, 'Graduation year', 2020, 2045, true);
  if (own(input, 'skills')) next.skills = list(input.skills, 50);
  if (own(input, 'projects')) next.projects = projects(input.projects);
  if (own(input, 'preferredRoles')) next.preferredRoles = list(input.preferredRoles, 15);
  if (own(input, 'preferredLocations')) next.preferredLocations = list(input.preferredLocations, 15);
  return next;
}

function toProfile(user, document) {
  const profile = document || {};
  return {
    fullName: profile.fullName || '',
    phone: profile.phone || '',
    branch: profile.branch || '',
    college: profile.college || '',
    cgpa: profile.cgpa ?? null,
    backlogs: profile.backlogs ?? null,
    graduationYear: profile.graduationYear ?? null,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    projects: Array.isArray(profile.projects) ? profile.projects : [],
    preferredRoles: Array.isArray(profile.preferredRoles) ? profile.preferredRoles : [],
    preferredLocations: Array.isArray(profile.preferredLocations) ? profile.preferredLocations : [],
    resume: profile.resume || null,
    email: user.email
  };
}

function present(value) {
  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== '';
}

export function profileCompletion(profile) {
  const fields = [
    ['fullName', 'Full name', true], ['phone', 'Phone number', true], ['branch', 'Branch / department', true],
    ['college', 'College', true], ['cgpa', 'CGPA', true], ['backlogs', 'Backlogs', true],
    ['graduationYear', 'Graduation year', true], ['skills', 'Skills', true], ['projects', 'Projects', false],
    ['resume', 'Resume', false], ['preferredRoles', 'Preferred job roles', true], ['preferredLocations', 'Preferred locations', true]
  ].map(([key, label, mandatory]) => ({ key, label, mandatory, completed: present(profile[key]) }));
  const completed = fields.filter((field) => field.completed).length;
  return {
    percentage: Math.round((completed / fields.length) * 100),
    fields,
    missingMandatory: fields.filter((field) => field.mandatory && !field.completed).map((field) => field.label)
  };
}

export async function getStudentProfile(user) {
  const document = await (await getStudentProfilesCollection()).findOne({ userId: user.id });
  return toProfile(user, document);
}

export async function updateStudentProfile(user, input) {
  const changes = normalizePartial(input);
  const profiles = await getStudentProfilesCollection();
  const now = new Date().toISOString();
  await profiles.updateOne(
    { userId: user.id },
    { $set: { ...changes, updatedAt: now }, $setOnInsert: { userId: user.id, createdAt: now } },
    { upsert: true }
  );
  return getStudentProfile(user);
}

export async function setProfileResume(userId, resume) {
  const now = new Date().toISOString();
  await (await getStudentProfilesCollection()).updateOne(
    { userId },
    {
      $set: { resume: { originalName: text(resume.originalName, 180), fileType: text(resume.fileType, 20), updatedAt: now }, updatedAt: now },
      $setOnInsert: { userId, createdAt: now }
    },
    { upsert: true }
  );
}
