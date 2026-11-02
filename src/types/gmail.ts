export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
}

export interface ParsedAddress {
  name: string;
  email: string;
  raw: string;
}

export interface EmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: number;
  dateFormatted: string;
  subject: string;
  from: ParsedAddress;
  to: string;
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
  labelIds: string[];
  sizeEstimate: number;
}

export interface EmailAttachment {
  partId: string;
  attachmentId?: string;
  inlineData?: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface EmailMessageDetail extends EmailMessageSummary {
  cc: string;
  replyTo: string;
  htmlBody: string | null;
  textBody: string | null;
  attachments: EmailAttachment[];
}

export interface EmailThreadDetail {
  id: string;
  messages: EmailMessageDetail[];
}

export type MailboxFilter = 'all' | 'unread' | 'attachments';

export interface SystemFolder {
  id: string;
  label: string;
  query?: string;
  labelId?: string;
}

export type JobApplicationStatus = 'accepted' | 'rejected' | 'waiting';

export type JobApplicationSubStage =
  | 'offer'
  | 'interview'
  | 'rejected'
  | 'sent_no_reply'
  | 'application_received';

export interface ClassifiedJobThread {
  threadId: string;
  thread: EmailThreadDetail;
  companyName: string;
  roleOrSubject: string;
  status: JobApplicationStatus;
  subStage: JobApplicationSubStage;
  statusLabel: string;
  reason: string;
  lastActivityDate: number;
  appliedDate: number;
  daysSinceApplied: number;
  messageCount: number;
  sentByUser: boolean;
  hasAttachments: boolean;
  isUnread: boolean;
  isManualOverride?: boolean;
}

export type JobFilterTab = 'all' | 'accepted' | 'waiting' | 'rejected';
