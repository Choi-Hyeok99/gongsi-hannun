import type {
  AlertPreference,
  AlertPreferenceRepository,
  NotificationCenterItem,
  NotificationCenterRepository,
} from "@/domain/notification-center";

export function ensureDefaultAlertPreference(
  repository: AlertPreferenceRepository,
  userId: string,
  companyId: string,
): Promise<void> {
  return repository.ensureDefault(userId, companyId);
}

export function listAlertPreferences(
  repository: AlertPreferenceRepository,
  userId: string,
  companyIds: readonly string[],
): Promise<ReadonlyMap<string, AlertPreference>> {
  return repository.findByCompanyIds(userId, companyIds);
}

export function updateAlertPreference(
  repository: AlertPreferenceRepository,
  userId: string,
  preference: AlertPreference,
): Promise<void> {
  return repository.update(userId, preference);
}

export function countUnreadNotifications(
  repository: NotificationCenterRepository,
  userId: string,
): Promise<number> {
  return repository.countUnread(userId);
}

export function listNotifications(
  repository: NotificationCenterRepository,
  userId: string,
): Promise<readonly NotificationCenterItem[]> {
  return repository.list(userId);
}

export function readNotification(
  repository: NotificationCenterRepository,
  userId: string,
  notificationId: string,
): Promise<NotificationCenterItem | null> {
  return repository.markRead(userId, notificationId);
}

export function readAllNotifications(repository: NotificationCenterRepository, userId: string): Promise<void> {
  return repository.markAllRead(userId);
}
