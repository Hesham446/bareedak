import {
  EmailAttachment,
  EmailMessageDetail,
  EmailMessageSummary,
  EmailThreadDetail,
  GmailLabel,
  GmailProfile,
  ParsedAddress,
} from '../types/gmail';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailAuthError extends Error {
  constructor(message = 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.') {
    super(message);
    this.name = 'GmailAuthError';
  }
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePartBody {
  attachmentId?: string;
  size?: number;
  data?: string;
}

interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

interface GmailRawMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  sizeEstimate?: number;
  internalDate?: string;
  payload?: GmailMessagePart;
}

async function gmailFetch<T>(token: string, endpoint: string): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    throw new GmailAuthError();
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || '';
    } catch {
      // ignore json parse errors
    }
    throw new Error(
      errorDetail
        ? `تعذر الاتصال بـ Gmail: ${errorDetail}`
        : `تعذر جلب البيانات من Gmail (رمز الخطأ ${response.status})`
    );
  }

  return response.json() as Promise<T>;
}

export function decodeBase64UrlToBytes(base64Url: string): Uint8Array {
  const normalized = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function decodeBase64UrlToUtf8(base64Url?: string): string {
  if (!base64Url) return '';
  try {
    const bytes = decodeBase64UrlToBytes(base64Url);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (err) {
    console.error('Failed to decode base64url payload:', err);
    return '';
  }
}

export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return doc.documentElement.textContent || input;
}

function getHeader(headers: GmailHeader[] | undefined, targetName: string): string {
  if (!headers) return '';
  const lower = targetName.toLowerCase();
  const match = headers.find((h) => h.name.toLowerCase() === lower);
  return match?.value?.trim() || '';
}

export function parseAddressHeader(raw: string): ParsedAddress {
  if (!raw) {
    return { name: 'مُرسِل غير معروف', email: '', raw: '' };
  }
  const trimmed = raw.trim();
  const angleMatch = trimmed.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  if (angleMatch) {
    const rawName = angleMatch[1].replace(/^["']|["']$/g, '').trim();
    const email = angleMatch[2].trim();
    return {
      name: rawName || email,
      email,
      raw: trimmed,
    };
  }
  const cleanEmail = trimmed.replace(/^["'<]|["'>]$/g, '').trim();
  return {
    name: cleanEmail,
    email: cleanEmail,
    raw: trimmed,
  };
}

export function formatListDate(epochMs: number): string {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('ar-EG', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function formatFullDate(epochMs: number): string {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSummaryFromRaw(raw: GmailRawMessage): EmailMessageSummary {
  const headers = raw.payload?.headers;
  const internalDate = Number(raw.internalDate || 0);
  const subject = getHeader(headers, 'Subject') || '(بدون موضوع)';
  const fromRaw = getHeader(headers, 'From');
  const toRaw = getHeader(headers, 'To');
  const labelIds = raw.labelIds || [];

  return {
    id: raw.id,
    threadId: raw.threadId,
    snippet: decodeHtmlEntities(raw.snippet || ''),
    internalDate,
    dateFormatted: formatListDate(internalDate),
    subject,
    from: parseAddressHeader(fromRaw),
    to: toRaw,
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    isImportant: labelIds.includes('IMPORTANT'),
    labelIds,
    sizeEstimate: raw.sizeEstimate || 0,
  };
}

interface ExtractedMimeContent {
  htmlParts: string[];
  textParts: string[];
  attachments: EmailAttachment[];
  inlineCidMap: Record<string, string>;
}

function walkMimeParts(part: GmailMessagePart | undefined, acc: ExtractedMimeContent) {
  if (!part) return;

  const mimeType = (part.mimeType || '').toLowerCase();
  const filename = (part.filename || '').trim();
  const contentDisposition = getHeader(part.headers, 'Content-Disposition').toLowerCase();
  const contentIdRaw = getHeader(part.headers, 'Content-ID');
  const contentId = contentIdRaw.replace(/^<|>$/g, '').trim();

  // Inline image with direct base64 data (cid:...)
  if (contentId && part.body?.data && mimeType.startsWith('image/')) {
    const standardBase64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
    acc.inlineCidMap[contentId] = `data:${mimeType};base64,${standardBase64}`;
  }

  // Real attachment (either has a filename or attachment disposition)
  const isAttachment =
    (filename.length > 0 && (Boolean(part.body?.attachmentId) || Boolean(part.body?.data))) ||
    (contentDisposition.startsWith('attachment') && Boolean(part.body?.attachmentId));

  if (isAttachment && !contentId) {
    acc.attachments.push({
      partId: part.partId || `${acc.attachments.length}`,
      attachmentId: part.body?.attachmentId,
      inlineData: part.body?.data,
      filename: filename || 'ملف-مرفق',
      mimeType: mimeType || 'application/octet-stream',
      size: part.body?.size || 0,
    });
  } else if (mimeType === 'text/html' && part.body?.data) {
    acc.htmlParts.push(decodeBase64UrlToUtf8(part.body.data));
  } else if (mimeType === 'text/plain' && part.body?.data) {
    acc.textParts.push(decodeBase64UrlToUtf8(part.body.data));
  }

  if (part.parts && part.parts.length > 0) {
    for (const child of part.parts) {
      walkMimeParts(child, acc);
    }
  }
}

function buildDetailFromRaw(raw: GmailRawMessage): EmailMessageDetail {
  const summary = buildSummaryFromRaw(raw);
  const headers = raw.payload?.headers;
  const cc = getHeader(headers, 'Cc');
  const replyTo = getHeader(headers, 'Reply-To');

  const extracted: ExtractedMimeContent = {
    htmlParts: [],
    textParts: [],
    attachments: [],
    inlineCidMap: {},
  };

  walkMimeParts(raw.payload, extracted);

  let htmlBody = extracted.htmlParts.length > 0 ? extracted.htmlParts.join('\n') : null;
  if (htmlBody && Object.keys(extracted.inlineCidMap).length > 0) {
    for (const [cid, dataUri] of Object.entries(extracted.inlineCidMap)) {
      const escapedCid = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      htmlBody = htmlBody.replace(new RegExp(`cid:${escapedCid}`, 'gi'), dataUri);
    }
  }

  const textBody = extracted.textParts.length > 0 ? extracted.textParts.join('\n\n') : null;

  return {
    ...summary,
    cc,
    replyTo,
    htmlBody,
    textBody,
    attachments: extracted.attachments,
  };
}

export async function getUserProfile(token: string): Promise<GmailProfile> {
  return gmailFetch<GmailProfile>(token, '/profile');
}

export async function listLabels(token: string): Promise<{
  inboxLabel: GmailLabel | null;
  userLabels: GmailLabel[];
}> {
  const [listRes, inboxRes] = await Promise.all([
    gmailFetch<{ labels?: GmailLabel[] }>(token, '/labels'),
    gmailFetch<GmailLabel>(token, '/labels/INBOX').catch(() => null),
  ]);

  const allLabels = listRes.labels || [];
  const userLabels = allLabels
    .filter((l) => l.type === 'user' && !l.name.startsWith('['))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return {
    inboxLabel: inboxRes,
    userLabels,
  };
}

export interface ListMessagesParams {
  labelId?: string;
  query?: string;
  pageToken?: string;
  maxResults?: number;
}

export interface ListMessagesResult {
  messages: EmailMessageSummary[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export async function listMessagesWithMetadata(
  token: string,
  params: ListMessagesParams
): Promise<ListMessagesResult> {
  const searchParams = new URLSearchParams();
  searchParams.set('maxResults', String(params.maxResults || 25));

  if (params.labelId) {
    searchParams.append('labelIds', params.labelId);
  }
  if (params.query && params.query.trim()) {
    searchParams.set('q', params.query.trim());
  }
  if (params.pageToken) {
    searchParams.set('pageToken', params.pageToken);
  }

  const listData = await gmailFetch<{
    messages?: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(token, `/messages?${searchParams.toString()}`);

  const rawItems = listData.messages || [];
  if (rawItems.length === 0) {
    return {
      messages: [],
      nextPageToken: undefined,
      resultSizeEstimate: 0,
    };
  }

  const metadataQuery =
    'format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date';

  const details = await Promise.all(
    rawItems.map((item) =>
      gmailFetch<GmailRawMessage>(
        token,
        `/messages/${encodeURIComponent(item.id)}?${metadataQuery}`
      )
    )
  );

  return {
    messages: details.map(buildSummaryFromRaw),
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate || details.length,
  };
}

export async function getThreadDetail(
  token: string,
  threadId: string,
  fallbackMessageId?: string
): Promise<EmailThreadDetail> {
  try {
    const thread = await gmailFetch<{
      id: string;
      messages?: GmailRawMessage[];
    }>(token, `/threads/${encodeURIComponent(threadId)}?format=full`);

    const messages = (thread.messages || []).map(buildDetailFromRaw);
    return {
      id: thread.id,
      messages,
    };
  } catch (err) {
    if (err instanceof GmailAuthError || !fallbackMessageId) {
      throw err;
    }
    const singleMsg = await gmailFetch<GmailRawMessage>(
      token,
      `/messages/${encodeURIComponent(fallbackMessageId)}?format=full`
    );
    return {
      id: singleMsg.threadId || singleMsg.id,
      messages: [buildDetailFromRaw(singleMsg)],
    };
  }
}

export async function downloadAttachmentFile(
  token: string,
  messageId: string,
  attachment: EmailAttachment
): Promise<void> {
  let base64Data = attachment.inlineData;

  if (!base64Data && attachment.attachmentId) {
    const res = await gmailFetch<{ data?: string }>(
      token,
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.attachmentId)}`
    );
    base64Data = res.data;
  }

  if (!base64Data) {
    throw new Error('تعذر تحميل بيانات الملف المرفق.');
  }

  const bytes = decodeBase64UrlToBytes(base64Data);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: attachment.mimeType || 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.filename || 'attachment';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const OUTBOUND_JOBS_QUERY =
  'from:me (cv OR resume OR "cover letter" OR portfolio OR applying OR application OR vacancy OR hiring OR internship OR "سيرة ذاتية" OR السيرة OR وظيفة OR التقديم OR التقدم OR to:hr OR to:careers OR to:jobs OR to:recruitment OR to:talent OR filename:cv OR filename:resume) -in:trash -in:spam';

const INBOUND_JOBS_QUERY =
  '("thank you for applying" OR "thanks for applying" OR "application received" OR "your application" OR "unfortunately" OR "not moving forward" OR "other candidates" OR "regret to inform" OR "pleased to offer" OR "offer letter" OR "job offer" OR "invite you" OR "shortlisted" OR "hiring team" OR "talent acquisition" OR wuzzuf OR bayt OR greenhouse OR lever OR workday OR workable OR smartrecruiters OR "طلب التوظيف" OR "تم استلام طلبك" OR "يؤسفنا" OR "نعتذر عن عدم" OR "مقابلة عمل" OR "عرض عمل" OR "فريق التوظيف") -in:trash -in:spam';

export interface JobScanCursors {
  outboundPageToken?: string;
  inboundPageToken?: string;
}

export interface ScanJobThreadsResult {
  threads: EmailThreadDetail[];
  nextCursors: JobScanCursors;
  hasMore: boolean;
}

export async function scanRawJobThreads(
  token: string,
  options?: {
    cursors?: JobScanCursors;
    knownThreadIds?: Set<string>;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<ScanJobThreadsResult> {
  const isInitial = !options?.cursors;
  const shouldFetchOutbound = isInitial || Boolean(options?.cursors?.outboundPageToken);
  const shouldFetchInbound = isInitial || Boolean(options?.cursors?.inboundPageToken);

  const buildThreadSearchUrl = (query: string, max: number, pageToken?: string) => {
    const sp = new URLSearchParams();
    sp.set('q', query);
    sp.set('maxResults', String(max));
    if (pageToken) sp.set('pageToken', pageToken);
    return `/threads?${sp.toString()}`;
  };

  const [outboundRes, inboundRes] = await Promise.all([
    shouldFetchOutbound
      ? gmailFetch<{
          threads?: Array<{ id: string }>;
          nextPageToken?: string;
        }>(token, buildThreadSearchUrl(OUTBOUND_JOBS_QUERY, 35, options?.cursors?.outboundPageToken))
      : Promise.resolve({ threads: [], nextPageToken: undefined }),
    shouldFetchInbound
      ? gmailFetch<{
          threads?: Array<{ id: string }>;
          nextPageToken?: string;
        }>(token, buildThreadSearchUrl(INBOUND_JOBS_QUERY, 45, options?.cursors?.inboundPageToken))
      : Promise.resolve({ threads: [], nextPageToken: undefined }),
  ]);

  const seen = new Set<string>(options?.knownThreadIds ? Array.from(options.knownThreadIds) : []);
  const uniqueIds: string[] = [];

  for (const item of [...(outboundRes.threads || []), ...(inboundRes.threads || [])]) {
    if (item.id && !seen.has(item.id)) {
      seen.add(item.id);
      uniqueIds.push(item.id);
    }
  }

  const total = uniqueIds.length;
  if (options?.onProgress) {
    options.onProgress(0, total);
  }

  const fetchedThreads: EmailThreadDetail[] = [];
  const batchSize = 10;

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const chunk = uniqueIds.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((tid) => getThreadDetail(token, tid).catch(() => null))
    );
    for (const t of chunkResults) {
      if (t && t.messages.length > 0) {
        fetchedThreads.push(t);
      }
    }
    if (options?.onProgress) {
      options.onProgress(Math.min(i + chunk.length, total), total);
    }
  }

  const nextCursors: JobScanCursors = {
    outboundPageToken: outboundRes.nextPageToken,
    inboundPageToken: inboundRes.nextPageToken,
  };

  return {
    threads: fetchedThreads,
    nextCursors,
    hasMore: Boolean(nextCursors.outboundPageToken || nextCursors.inboundPageToken),
  };
}

