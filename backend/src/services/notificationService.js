import { getNotificationsCollection } from './database.js';
import { evaluateEligibility } from './eligibilityService.js';
import { listJobs } from './jobService.js';
import { getStudentProfile, profileCompletion } from './profileService.js';

function publicNotification(record) {
  const { _id, userId, ...details } = record;
  return { ...details, id: String(_id) };
}

async function upsertNotification(record) {
  const notifications = await getNotificationsCollection();
  await notifications.updateOne(
    { _id: record._id },
    {
      $set: { title: record.title, message: record.message, relatedJobId: record.relatedJobId || null, updatedAt: new Date().toISOString() },
      $setOnInsert: { userId: record.userId, type: record.type, read: false, createdAt: new Date().toISOString() }
    },
    { upsert: true }
  );
}

export async function refreshNotifications(user) {
  const profile = await getStudentProfile(user);
  const completion = profileCompletion(profile);
  const notifications = await getNotificationsCollection();
  const profileNotificationId = `profile-incomplete-${user.id}`;
  if (completion.missingMandatory.length) {
    await upsertNotification({
      _id: profileNotificationId,
      userId: user.id,
      type: 'profile',
      title: `Your profile is ${completion.percentage}% complete`,
      message: `Add ${completion.missingMandatory.join(', ')} to see accurate job eligibility.`
    });
  } else {
    await notifications.updateOne({ _id: profileNotificationId, userId: user.id }, { $set: { read: true, updatedAt: new Date().toISOString() } });
  }

  const jobs = await listJobs();
  const now = Date.now();
  for (const job of jobs) {
    const days = Math.ceil((new Date(job.deadline).getTime() - now) / (24 * 60 * 60 * 1000));
    if (job.status !== 'active' || days < 0 || days > 3 || !evaluateEligibility(profile, job).eligible) continue;
    await upsertNotification({
      _id: `job-deadline-${user.id}-${job.id}`,
      userId: user.id,
      type: 'deadline',
      title: `${job.companyName} closes ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`,
      message: `${job.role} in ${job.location} has an application deadline on ${new Date(job.deadline).toLocaleDateString('en-IN')}.`,
      relatedJobId: job.id
    });
  }
}

export async function listNotifications(user) {
  await refreshNotifications(user);
  const records = await (await getNotificationsCollection()).find({ userId: user.id }).sort({ read: 1, createdAt: -1 }).limit(50).toArray();
  return records.map(publicNotification);
}

export async function markNotificationRead(userId, notificationId) {
  const result = await (await getNotificationsCollection()).findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return result ? publicNotification(result) : null;
}

export async function markAllNotificationsRead(userId) {
  const result = await (await getNotificationsCollection()).updateMany(
    { userId, read: false },
    { $set: { read: true, updatedAt: new Date().toISOString() } }
  );
  return result.modifiedCount;
}
