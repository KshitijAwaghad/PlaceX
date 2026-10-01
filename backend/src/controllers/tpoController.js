import { getTpoApplications, getTpoDashboard, getTpoNotifications, getTpoStudent, getTpoStudents } from '../services/tpoService.js';

function studentNotFound() {
  const error = new Error('That student was not found.');
  error.statusCode = 404;
  error.code = 'STUDENT_NOT_FOUND';
  return error;
}

export async function tpoDashboard(req, res, next) {
  try { return res.status(200).json({ success: true, data: await getTpoDashboard() }); }
  catch (error) { return next(error); }
}

export async function tpoStudents(req, res, next) {
  try { return res.status(200).json({ success: true, data: { items: await getTpoStudents() } }); }
  catch (error) { return next(error); }
}

export async function tpoStudent(req, res, next) {
  try {
    const student = await getTpoStudent(req.params.studentId);
    if (!student) throw studentNotFound();
    return res.status(200).json({ success: true, data: student });
  } catch (error) { return next(error); }
}

export async function tpoApplications(req, res, next) {
  try { return res.status(200).json({ success: true, data: { items: await getTpoApplications() } }); }
  catch (error) { return next(error); }
}

export async function tpoNotifications(req, res, next) {
  try { return res.status(200).json({ success: true, data: { items: await getTpoNotifications() } }); }
  catch (error) { return next(error); }
}

export function tpoProfile(req, res) {
  return res.status(200).json({ success: true, data: { user: req.user } });
}
