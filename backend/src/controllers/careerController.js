import { analyzeCareer } from '../services/aiService.js';

export async function simulateCareer(req, res, next) {
  const { resumeText, jobDescription, addedSkills = [] } = req.body;

  if (typeof resumeText !== 'string' || typeof jobDescription !== 'string' || !Array.isArray(addedSkills)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SCENARIO', message: 'resumeText, jobDescription, and addedSkills are required.' }
    });
  }

  try {
    const baseline = await analyzeCareer({ resumeText, jobDescription });
    const projected = await analyzeCareer({ resumeText, jobDescription, addedSkills });
    return res.status(200).json({ success: true, data: { readinessScore: projected.matchPercentage, scoreChange: projected.matchPercentage - baseline.matchPercentage, analysis: projected } });
  } catch (error) {
    return next(error);
  }
}
