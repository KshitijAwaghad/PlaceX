import { createRequire } from 'node:module';
import { isCatalogSkill, uniqueSkills } from './skillNormalization.js';

const require = createRequire(import.meta.url);
const profileCatalog = require('../../../shared/profileCatalog.json');

function comparable(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function values(value) {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? value.split(',') : [];
}

function titleCase(value) {
  return String(value || '').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueLabels(value, options, aliases = {}, formatUnknown = (item) => item) {
  const lookup = new Map([
    ...options.map((option) => [comparable(option), option]),
    ...Object.entries(aliases).map(([alias, option]) => [comparable(alias), option])
  ]);
  const seen = new Set();
  return values(value).map((item) => {
    const raw = String(item || '').trim().replace(/\s+/g, ' ');
    return lookup.get(comparable(raw)) || formatUnknown(raw);
  }).filter((item) => {
    const key = comparable(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeProfileSkills(value) {
  const skills = uniqueSkills(value);
  return {
    skills: skills.filter(isCatalogSkill),
    legacySkills: skills.filter((skill) => !isCatalogSkill(skill))
  };
}

export function normalizeRoles(value) {
  return uniqueLabels(value, profileCatalog.roleOptions, profileCatalog.roleAliases);
}

export function normalizeLocations(value) {
  return uniqueLabels(value, profileCatalog.locationOptions, profileCatalog.locationAliases, titleCase);
}

export function normalizeBranch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
