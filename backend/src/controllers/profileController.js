import fs from 'node:fs/promises';
import { getStudentProfile, profileCompletion, removeProfilePhoto, replaceProfilePhoto, updateStudentProfile } from '../services/profileService.js';
import { profilePhotoPathFromUrl } from '../middleware/upload.js';

async function deleteStoredProfilePhoto(profilePhotoUrl) {
  const filePath = profilePhotoPathFromUrl(profilePhotoUrl);
  if (filePath) await fs.unlink(filePath).catch(() => {});
}

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

export async function uploadProfilePhotoFile(req, res, next) {
  if (!req.file) {
    const error = new Error('Attach a profile photo using the "photo" field.');
    error.statusCode = 400;
    error.code = 'PROFILE_PHOTO_REQUIRED';
    return next(error);
  }
  const profilePhotoUrl = `/profile-photos/${req.file.filename}`;
  try {
    const previousPhotoUrl = await replaceProfilePhoto(req.user.id, profilePhotoUrl);
    await deleteStoredProfilePhoto(previousPhotoUrl);
    const profile = await getStudentProfile(req.user);
    return res.status(201).json({ success: true, data: { profile, completion: profileCompletion(profile) } });
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    return next(error);
  }
}

export async function deleteProfilePhoto(req, res, next) {
  try {
    const previousPhotoUrl = await removeProfilePhoto(req.user.id);
    await deleteStoredProfilePhoto(previousPhotoUrl);
    const profile = await getStudentProfile(req.user);
    return res.status(200).json({ success: true, data: { profile, completion: profileCompletion(profile) } });
  } catch (error) { return next(error); }
}
