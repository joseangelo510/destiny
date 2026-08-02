export type WorkspaceNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  destination_path: string | null;
  read_at: string | null;
  created_at: string;
};

export function unreadNotificationCount(notifications: WorkspaceNotification[]): number {
  return notifications.filter((n) => n.read_at === null).length;
}

export function notificationButtonLabel(notifications: WorkspaceNotification[]): string {
  const count = unreadNotificationCount(notifications);
  if (count === 0) return "Open notifications";
  return `Open notifications, ${count} unread`;
}
