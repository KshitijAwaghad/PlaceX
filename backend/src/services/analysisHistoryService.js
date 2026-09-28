import { randomUUID } from 'node:crypto';
import { getCareerAnalysesCollection } from './database.js';

function text(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function summary(record) {
  return {
    id: String(record._id),
    resumeName: record.resume.originalName,
    jobPreview: text(record.jobDescription, 180),
    matchPercentage: Number(record.analysis.matchPercentage || 0),
    missingSkills: Array.isArray(record.analysis.missingSkills) ? record.analysis.missingSkills.map(String) : [],
    createdAt: record.createdAt
  };
}

export async function saveCareerAnalysis({ userId, resume, jobDescription, analysis }) {
  const record = {
    _id: randomUUID(),
    userId,
    resume: {
      originalName: text(resume?.originalName, 180) || 'Uploaded resume',
      fileType: text(resume?.fileType, 20) || undefined,
      size: Number(resume?.size) || 0,
      resumeText: String(resume?.resumeText || '')
    },
    jobDescription: String(jobDescription || ''),
    analysis,
    createdAt: new Date().toISOString()
  };
  await (await getCareerAnalysesCollection()).insertOne(record);
  return summary(record);
}

export async function listCareerAnalyses(userId, limit = 20) {
  const records = await (await getCareerAnalysesCollection())
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return records.map(summary);
}

export async function findCareerAnalysis(userId, historyId) {
  const record = await (await getCareerAnalysesCollection()).findOne({ _id: historyId, userId });
  if (!record) return null;
  return {
    ...summary(record),
    resume: record.resume,
    jobDescription: record.jobDescription,
    analysis: record.analysis
  };
}
