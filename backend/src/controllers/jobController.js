import { analyzeCareer } from '../services/aiService.js';
import { saveCareerAnalysis } from '../services/analysisHistoryService.js';

export async function analyzeJobDescription(req, res, next) {
  const { resumeText, resumeName, resumeFileType, resumeSize, jobDescription, addedSkills = [] } = req.body;

  if (typeof resumeText !== 'string' || resumeText.trim().length < 20 || typeof jobDescription !== 'string' || jobDescription.trim().length < 30) {
    return res.status(400).json({
      success: false,
      error: { code: 'ANALYSIS_INPUT_REQUIRED', message: 'Upload a readable resume and provide a job description with at least 30 characters.' }
    });
  }

  try {
    const analysis = await analyzeCareer({ resumeText, jobDescription, addedSkills });
    const history = await saveCareerAnalysis({
      userId: req.user.id,
      resume: { originalName: resumeName, fileType: resumeFileType, size: resumeSize, resumeText },
      jobDescription,
      analysis
    });
    return res.status(200).json({
      success: true,
      message: 'Resume compared against job description successfully.',
      data: { ...analysis, historyId: history.id }
    });
  } catch (error) {
    return next(error);
  }
}
