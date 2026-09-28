import { findCareerAnalysis, listCareerAnalyses } from '../services/analysisHistoryService.js';

function historyNotFound() {
  const error = new Error('That saved analysis was not found.');
  error.statusCode = 404;
  error.code = 'ANALYSIS_NOT_FOUND';
  return error;
}

export async function listHistory(req, res, next) {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 20;
    const items = await listCareerAnalyses(req.user.id, limit);
    return res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    return next(error);
  }
}

export async function getHistoryItem(req, res, next) {
  try {
    const item = await findCareerAnalysis(req.user.id, req.params.historyId);
    if (!item) throw historyNotFound();
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
}
