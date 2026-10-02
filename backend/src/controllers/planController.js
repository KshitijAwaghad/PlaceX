import { generateInstantSkillPlan, getLatestInstantSkillPlan, VALID_DURATIONS } from '../services/instantPlanService.js';

export async function createInstantPlan(req, res, next) {
  try {
    const rawHours = req.body?.durationHours !== undefined ? Number(req.body.durationHours) : 12;
    if (!VALID_DURATIONS.includes(rawHours)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DURATION',
          message: 'Duration must be 6, 12, or 18 hours.'
        }
      });
    }

    const analysisId = req.body?.analysisId ? String(req.body.analysisId).trim() : null;
    const plan = await generateInstantSkillPlan({
      user: req.user,
      durationHours: rawHours,
      analysisId
    });

    return res.status(200).json({
      success: true,
      message: 'Instant skill plan generated successfully.',
      data: plan
    });
  } catch (error) {
    return next(error);
  }
}

export async function getInstantPlan(req, res, next) {
  try {
    const durationParam = req.query?.durationHours ? Number(req.query.durationHours) : null;
    const analysisId = req.query?.analysisId ? String(req.query.analysisId).trim() : null;

    if (durationParam && !VALID_DURATIONS.includes(durationParam)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DURATION',
          message: 'Duration must be 6, 12, or 18 hours.'
        }
      });
    }

    // If specific duration or analysis requested, generate for that parameter
    if (durationParam || analysisId) {
      const plan = await generateInstantSkillPlan({
        user: req.user,
        durationHours: durationParam || 12,
        analysisId
      });
      return res.status(200).json({ success: true, data: plan });
    }

    // Otherwise check for existing saved plan or generate default
    const saved = await getLatestInstantSkillPlan(req.user.id);
    if (saved) {
      return res.status(200).json({ success: true, data: saved });
    }

    const plan = await generateInstantSkillPlan({
      user: req.user,
      durationHours: 12
    });

    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    return next(error);
  }
}
