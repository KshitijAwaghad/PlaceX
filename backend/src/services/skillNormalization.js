import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const profileCatalog = require('../../../shared/profileCatalog.json');
const skillPropertyNames = ['name', 'skill', 'skillName', 'label', 'value'];

function comparable(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const canonicalSkills = [...new Set(profileCatalog.skillCategories.flatMap((category) => category.skills))];
const skillAliases = new Map([
  ...canonicalSkills.map((skill) => [comparable(skill), skill]),
  ...Object.entries(profileCatalog.skillAliases).map(([alias, skill]) => [comparable(alias), skill])
]);

function sourceItems(value) {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' ? value.split(',') : [];
}

export function extractSkillName(value) {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

  for (const propertyName of skillPropertyNames) {
    if (typeof value[propertyName] === 'string') return value[propertyName].trim();
  }
  return '';
}

export function canonicalSkill(value) {
  const skill = extractSkillName(value);
  return skillAliases.get(comparable(skill)) || skill;
}

export function normalizeSkill(value) {
  return comparable(canonicalSkill(value));
}

export function extractSkills(value) {
  return sourceItems(value).map(extractSkillName).filter(Boolean);
}

export function uniqueSkills(value) {
  const seen = new Set();
  return extractSkills(value).map(canonicalSkill).filter((skill) => {
    const comparable = normalizeSkill(skill);
    if (!comparable || seen.has(comparable)) return false;
    seen.add(comparable);
    return true;
  });
}

export function isCatalogSkill(value) {
  const canonical = canonicalSkill(value);
  return canonicalSkills.includes(canonical);
}

export function catalogSkills() {
  return [...canonicalSkills];
}
