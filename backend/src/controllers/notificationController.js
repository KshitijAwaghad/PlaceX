import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationService.js';

function notificationNotFound() {
  const error = new Error('That notification was not found.');
  error.statusCode = 404;
  error.code = 'NOTIFICATION_NOT_FOUND';
  return error;
}

export async function getNotifications(req, res, next) {
  try {
    const items = await listNotifications(req.user);
    return res.status(200).json({ success: true, data: { items, unreadCount: items.filter((item) => !item.read).length } });
  } catch (error) { return next(error); }
}

export async function markRead(req, res, next) {
  try {
    const notification = await markNotificationRead(req.user.id, req.params.notificationId);
    if (!notification) throw notificationNotFound();
    return res.status(200).json({ success: true, data: notification });
  } catch (error) { return next(error); }
}

export async function markAllRead(req, res, next) {
  try {
    const updated = await markAllNotificationsRead(req.user.id);
    return res.status(200).json({ success: true, data: { updated } });
  } catch (error) { return next(error); }
}
