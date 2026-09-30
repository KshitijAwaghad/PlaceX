import { getStudentProfilesCollection } from './database.js';
import { normalizeLocations, normalizeProfileSkills, normalizeRoles } from './profileNormalization.js';

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

function skillState(value) {
  const normalized = normalizeProfileSkills(value);
  return {
    skills: normalized.skills.map((skill) => text(skill, 80)).slice(0, 50),
    legacySkills: normalized.legacySkills.map((skill) => text(skill, 80)).slice(0, 50)
  };
}

function savedSkills(value) {
  const normalized = skillState(value);
  if (normalized.legacySkills.length) {
    throw validationError(`Choose skills from the catalog instead of unsupported entries: ${normalized.legacySkills.join(', ')}.`);
  }
  return normalized.skills;
}

function storedNumber(value, integer = false) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && (!integer || Number.isInteger(number)) ? number : null;
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

const socialLinkDefinitions = Object.freeze({
  github: { label: 'GitHub', domain: 'github.com' },
  linkedin: { label: 'LinkedIn', domain: 'linkedin.com' },
  portfolio: { label: 'Portfolio' },
  leetcode: { label: 'LeetCode', domain: 'leetcode.com' }
});

export const emptySocialLinks = Object.freeze({ github: '', linkedin: '', portfolio: '', leetcode: '' });

function socialUrl(value, definition) {
  const candidate = text(value, 300);
  if (!candidate) return '';
  let parsed;
  try { parsed = new URL(candidate); } catch { throw validationError(`${definition.label} must be a valid http or https URL.`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw validationError(`${definition.label} must be a valid http or https URL.`);
  }
  if (definition.domain && parsed.hostname !== definition.domain && !parsed.hostname.endsWith(`.${definition.domain}`)) {
    throw validationError(`Enter a ${definition.label} URL hosted on ${definition.domain}.`);
  }
  return parsed.toString();
}

export function normalizeSocialLinks(value, { validate = true } = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(socialLinkDefinitions).map(([key, definition]) => {
    try { return [key, socialUrl(source[key], definition)]; }
    catch (error) {
      if (validate) throw error;
      return [key, ''];
    }
  }));
}

function storedProfilePhotoUrl(value) {
  const url = text(value, 300);
  return /^\/profile-photos\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(url) ? url : null;
}

function projects(value, validateTechnologies = false) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((project) => {
    const item = project && typeof project === 'object' ? project : {};
    const technologies = skillState(item.technologies ?? item.skills);
    if (validateTechnologies && technologies.legacySkills.length) {
      throw validationError(`Choose project technologies from the catalog instead of unsupported entries: ${technologies.legacySkills.join(', ')}.`);
    }
    return {
      title: text(item.title, 120),
      description: text(item.description, 500),
      technologies: technologies.skills,
      githubUrl: text(item.githubUrl, 300),
      liveUrl: text(item.liveUrl || item.url, 300),
      startDate: text(item.startDate, 10),
      endDate: text(item.endDate, 10)
    };
  }).filter((project) => project.title || project.description || project.technologies.length || project.githubUrl || project.liveUrl);
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
  if (own(input, 'skills')) next.skills = savedSkills(input.skills);
  if (own(input, 'projects')) next.projects = projects(input.projects, true);
  if (own(input, 'preferredRoles')) next.preferredRoles = normalizeRoles(input.preferredRoles).map((role) => text(role, 80)).slice(0, 15);
  if (own(input, 'preferredLocations')) next.preferredLocations = normalizeLocations(input.preferredLocations).map((location) => text(location, 80)).slice(0, 15);
  if (own(input, 'socialLinks')) next.socialLinks = normalizeSocialLinks(input.socialLinks);
  return next;
}

function toProfile(user, document) {
  const profile = document || {};
  const skills = skillState(profile.skills);
  return {
    fullName: profile.fullName || '',
    phone: profile.phone || '',
    branch: profile.branch || '',
    college: profile.college || '',
    cgpa: storedNumber(profile.cgpa),
    backlogs: storedNumber(profile.backlogs, true),
    graduationYear: storedNumber(profile.graduationYear, true),
    skills: skills.skills,
    legacySkills: skills.legacySkills,
    projects: projects(profile.projects),
    preferredRoles: normalizeRoles(profile.preferredRoles),
    preferredLocations: normalizeLocations(profile.preferredLocations),
    resume: profile.resume || null,
    profilePhotoUrl: storedProfilePhotoUrl(profile.profilePhotoUrl),
    socialLinks: normalizeSocialLinks(profile.socialLinks, { validate: false }),
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
    missingFields: fields.filter((field) => !field.completed).map((field) => field.label),
    missingMandatory: fields.filter((field) => field.mandatory && !field.completed).map((field) => field.label)
  };
}

export async function getStudentProfile(user) {
  const document = await (await getStudentProfilesCollection()).findOne({ userId: user.id });
  return toProfile(user, document);
}

export async function listStudentProfiles() {
  const profiles = await (await getStudentProfilesCollection()).find({}).toArray();
  return profiles.map((profile) => ({ ...profile, id: String(profile._id) }));
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

export async function replaceProfilePhoto(userId, profilePhotoUrl) {
  const profiles = await getStudentProfilesCollection();
  const current = await profiles.findOne({ userId }, { projection: { profilePhotoUrl: 1 } });
  const now = new Date().toISOString();
  await profiles.updateOne(
    { userId },
    { $set: { profilePhotoUrl: storedProfilePhotoUrl(profilePhotoUrl), updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
    { upsert: true }
  );
  return storedProfilePhotoUrl(current?.profilePhotoUrl);
}

export async function removeProfilePhoto(userId) {
  const profiles = await getStudentProfilesCollection();
  const current = await profiles.findOne({ userId }, { projection: { profilePhotoUrl: 1 } });
  if (!current) return null;
  const now = new Date().toISOString();
  await profiles.updateOne({ userId }, { $unset: { profilePhotoUrl: '' }, $set: { updatedAt: now } });
  return storedProfilePhotoUrl(current.profilePhotoUrl);
}
