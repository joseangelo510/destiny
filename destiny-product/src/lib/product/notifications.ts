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
  return notifications.filter((notification) => !notification.read_at).length;
}

export function notificationButtonLabel(unread: number): string {
  return unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications";
}
