import { MongoClient } from 'mongodb';

let databasePromise;

function configurationError(message) {
  const error = new Error(message);
  error.code = 'DATABASE_CONFIGURATION_ERROR';
  error.statusCode = 503;
  return error;
}

async function connectClient(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

function seedListUri(srvUri) {
  const hosts = process.env.MONGODB_SEED_HOSTS?.trim();
  if (!hosts || !srvUri.startsWith('mongodb+srv://')) return null;

  const authorityEnd = srvUri.indexOf('@');
  if (authorityEnd < 0) return null;
  const authority = srvUri.slice('mongodb+srv://'.length, authorityEnd);
  const query = new URL(srvUri).searchParams;
  query.set('tls', 'true');
  query.set('authSource', query.get('authSource') || 'admin');
  const replicaSet = process.env.MONGODB_REPLICA_SET?.trim();
  if (replicaSet) query.set('replicaSet', replicaSet);
  return `mongodb://${authority}@${hosts}/?${query.toString()}`;
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw configurationError('MongoDB is not configured. Set MONGODB_URI in backend/.env.');
  }

  if (!databasePromise) {
    databasePromise = (async () => {
      let client;
      try {
        client = await connectClient(uri);
      } catch (error) {
        const fallbackUri = seedListUri(uri);
        if (!fallbackUri || error?.code !== 'ECONNREFUSED') throw error;
        console.warn('MongoDB SRV DNS lookup failed; using the configured Atlas seed-list fallback.');
        client = await connectClient(fallbackUri);
      }
      const database = client.db(process.env.MONGODB_DB_NAME?.trim() || 'placenexus');
      await database.collection('users').createIndexes([
        { key: { email: 1 }, name: 'unique_user_email', unique: true },
        { key: { googleSubject: 1 }, name: 'unique_google_subject', unique: true, sparse: true }
      ]);
      await database.collection('career_analyses').createIndex(
        { userId: 1, createdAt: -1 },
        { name: 'career_analysis_history_by_user' }
      );
      await database.collection('student_profiles').createIndex(
        { userId: 1 },
        { name: 'unique_profile_user', unique: true }
      );
      await database.collection('jobs').createIndexes([
        { key: { deadline: 1 }, name: 'jobs_by_deadline' },
        { key: { status: 1 }, name: 'jobs_by_status' }
      ]);
      await database.collection('applications').createIndexes([
        { key: { userId: 1, jobId: 1 }, name: 'unique_user_job_application', unique: true },
        { key: { userId: 1, updatedAt: -1 }, name: 'applications_by_user' }
      ]);
      await database.collection('notifications').createIndex(
        { userId: 1, read: 1, createdAt: -1 },
        { name: 'notifications_by_user_and_read' }
      );
      return database;
    })().catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

export async function getUsersCollection() {
  return (await connectDatabase()).collection('users');
}

export async function getSystemSettingsCollection() {
  return (await connectDatabase()).collection('system_settings');
}

export async function getCareerAnalysesCollection() {
  return (await connectDatabase()).collection('career_analyses');
}

export async function getStudentProfilesCollection() {
  return (await connectDatabase()).collection('student_profiles');
}

export async function getJobsCollection() {
  return (await connectDatabase()).collection('jobs');
}

export async function getApplicationsCollection() {
  return (await connectDatabase()).collection('applications');
}

export async function getNotificationsCollection() {
  return (await connectDatabase()).collection('notifications');
}
