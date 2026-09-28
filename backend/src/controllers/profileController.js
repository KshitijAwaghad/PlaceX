import { getStudentProfile, profileCompletion, updateStudentProfile } from '../services/profileService.js';

export async function getProfile(req, res, next) {
  try {
    const profile = await getStudentProfile(req.user);
    return res.status(200).json({ success: true, data: { profile, completion: profileCompletion(profile) } });
  } catch (error) { return next(error); }
}

export async function updateProfile(req, res, next) {
  try {
    const profile = await updateStudentProfile(req.user, req.body);
    return res.status(200).json({ success: true, data: { profile, completion: profileCompletion(profile) } });
  } catch (error) { return next(error); }
}

export async function getProfileCompletion(req, res, next) {
  try {
    const profile = await getStudentProfile(req.user);
    return res.status(200).json({ success: true, data: profileCompletion(profile) });
  } catch (error) { return next(error); }
}
