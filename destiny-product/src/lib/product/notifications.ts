export type WorkspaceNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  destination_path: string | null;
  read_at: string | null;
  created_at: string;
  website_id: string;
  website_name: string;
  source?: "comms_batch";
  event_ids?: string[];
  message_id?: string;
};

export function unreadNotificationCount(notifications: WorkspaceNotification[]): number {
  return notifications.filter((notification) => !notification.read_at).length;
}

export function notificationButtonLabel(unread: number): string {
  return unread > 0 ? `Open notifications, ${unread} unread` : "Open notifications";
}

export function notificationTitleForWebsite(title: string, websiteName: string) {
  const cleanTitle = title.trim();
  const cleanWebsite = websiteName.trim();
  if (!cleanWebsite || cleanTitle.toLocaleLowerCase().startsWith(cleanWebsite.toLocaleLowerCase())) return cleanTitle;
  return `${cleanWebsite}: ${cleanTitle}`;
}
