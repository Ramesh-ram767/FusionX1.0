/**
 * FUSIONX Civic In-Memory Notification Service
 * Dispatches and tracks role-based notifications without external providers.
 */

class NotificationService {
  constructor() {
    this.notifications = [];
  }

  /**
   * Dispatch a new notification.
   */
  notify({
    recipient_role,
    recipient_id = null,
    title,
    message,
    type = 'INFO',
    problem_id = null,
    metadata = {},
  }) {
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      recipient_role: recipient_role ? String(recipient_role).toUpperCase() : null,
      recipient_id: recipient_id ? String(recipient_id) : null,
      title: title || 'Civic Update',
      message: message || '',
      type, // INFO, WARNING, ALERT, SUCCESS
      problem_id: problem_id ? String(problem_id) : null,
      metadata,
      read: false,
      created_at: new Date().toISOString(),
    };

    this.notifications.unshift(notification);
    return notification;
  }

  /**
   * Retrieve notifications matching role and/or specific user ID.
   */
  getForUser({ role, user_id, unread_only = false }) {
    return this.notifications.filter((n) => {
      // 1. Role match check
      const roleMatch = !n.recipient_role || n.recipient_role === role;

      // 2. Recipient ID check (if targeted to a specific individual)
      const idMatch = !n.recipient_id || n.recipient_id === user_id;

      // 3. Unread check
      const unreadMatch = !unread_only || !n.read;

      return roleMatch && idMatch && unreadMatch;
    });
  }

  /**
   * Mark a notification as read.
   */
  markRead(notificationId) {
    const notif = this.notifications.find((n) => String(n.id) === String(notificationId));
    if (notif) {
      notif.read = true;
      return notif;
    }
    return null;
  }

  reset() {
    this.notifications = [];
  }
}

export const notificationService = new NotificationService();
