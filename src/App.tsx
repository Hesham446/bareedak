import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Archive,
  Briefcase,
  FileText,
  Folder,
  Inbox,
  Loader2,
  MailWarning,
  RefreshCw,
  Search,
  Send,
  Star,
  X,
} from 'lucide-react';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  invalidateAccessToken,
  logout,
} from './services/auth';
import {
  downloadAttachmentFile,
  getThreadDetail,
  getUserProfile,
  GmailAuthError,
  JobScanCursors,
  listLabels,
  listMessagesWithMetadata,
  scanRawJobThreads,
} from './services/gmail';
import { classifyJobThread } from './services/jobClassifier';
import {
  ClassifiedJobThread,
  EmailAttachment,
  EmailMessageSummary,
  EmailThreadDetail,
  GmailLabel,
  GmailProfile,
  JobApplicationStatus,
  MailboxFilter,
  SystemFolder,
} from './types/gmail';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { MessageList } from './components/MessageList';
import { ReadingPane } from './components/ReadingPane';
import { JobTrackerView } from './components/JobTrackerView';

const OVERRIDES_STORAGE_KEY = 'gmail_job_overrides_v1';

const SYSTEM_FOLDERS: SystemFolder[] = [
  { id: 'INBOX', label: 'البريد الوارد', labelId: 'INBOX' },
  { id: 'UNREAD', label: 'غير المقروءة', query: 'is:unread -in:spam -in:trash' },
  { id: 'STARRED', label: 'المميزة بنجمة', labelId: 'STARRED' },
  { id: 'IMPORTANT', label: 'المهمة', labelId: 'IMPORTANT' },
  { id: 'SENT', label: 'البريد المرسل', labelId: 'SENT' },
  { id: 'DRAFT', label: 'المسودات', labelId: 'DRAFT' },
  { id: 'ALL', label: 'كل البريد', query: '-in:spam -in:trash' },
];

const HEADER_NAV_ITEMS = [
  { id: 'JOBS', label: 'متابعة الوظائف' },
  { id: 'INBOX', label: 'البريد الوارد' },
  { id: 'UNREAD', label: 'غير المقروءة' },
  { id: 'STARRED', label: 'المميزة بنجمة' },
  { id: 'SENT', label: 'البريد المرسل' },
];

type ManualOverrideMap = Record<string, JobApplicationStatus | 'dismissed'>;

function getOverrideStorageKey(email?: string) {
  return email ? `${OVERRIDES_STORAGE_KEY}_${email}` : OVERRIDES_STORAGE_KEY;
}

function loadSavedOverrides(email?: string): ManualOverrideMap {
  try {
    const key = getOverrideStorageKey(email);
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Account & Labels State
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [inboxUnreadCount, setInboxUnreadCount] = useState<number | null>(null);
  const [userLabels, setUserLabels] = useState<GmailLabel[]>([]);

  // Active View ('JOBS' or folder/label ID)
  const [activeFolderId, setActiveFolderId] = useState<string>('JOBS');

  // Job Applications Tracker State
  const [rawJobThreads, setRawJobThreads] = useState<EmailThreadDetail[]>([]);
  const [jobCursors, setJobCursors] = useState<JobScanCursors | undefined>(undefined);
  const [hasMoreJobPages, setHasMoreJobPages] = useState<boolean>(false);
  const [isScanningJobs, setIsScanningJobs] = useState<boolean>(false);
  const [isScanningMoreJobs, setIsScanningMoreJobs] = useState<boolean>(false);
  const [jobScanProgress, setJobScanProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [jobScanError, setJobScanError] = useState<string | null>(null);
  const [hasLoadedJobsOnce, setHasLoadedJobsOnce] = useState<boolean>(false);
  const [jobScanAttempted, setJobScanAttempted] = useState<boolean>(false);
  const [manualOverrides, setManualOverrides] = useState<ManualOverrideMap>(() =>
    loadSavedOverrides()
  );

  // General Mailbox State
  const [searchInput, setSearchInput] = useState<string>('');
  const [submittedSearch, setSubmittedSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<MailboxFilter>('all');
  const [messages, setMessages] = useState<EmailMessageSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  // Selected Thread / Reading Pane State (General Mailbox)
  const [selectedMessage, setSelectedMessage] = useState<EmailMessageSummary | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThreadDetail | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState<boolean>(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [mobileShowReader, setMobileShowReader] = useState<boolean>(false);

  const mailboxRequestIdRef = useRef(0);
  const threadRequestIdRef = useRef(0);
  const jobScanRequestIdRef = useRef(0);

  const currentUserEmail = profile?.emailAddress || user?.email || '';

  useEffect(() => {
    setManualOverrides(loadSavedOverrides(currentUserEmail));
  }, [currentUserEmail]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authenticatedUser) => {
        setUser(authenticatedUser);
        setNeedsAuth(false);
        setAuthChecking(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAuthExpired = useCallback(() => {
    invalidateAccessToken();
    setNeedsAuth(true);
    setAuthError('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى لعرض رسائلك.');
  }, []);

  const resetMailboxState = useCallback(() => {
    setMessages([]);
    setNextPageToken(undefined);
    setSelectedMessage(null);
    setSelectedThread(null);
    setListError(null);
    setThreadError(null);
    setIsLoadingList(false);
    setIsLoadingMore(false);
  }, []);

  const resetJobState = useCallback(() => {
    setRawJobThreads([]);
    setJobCursors(undefined);
    setHasMoreJobPages(false);
    setIsScanningJobs(false);
    setIsScanningMoreJobs(false);
    setJobScanProgress(null);
    setJobScanError(null);
    setHasLoadedJobsOnce(false);
    setJobScanAttempted(false);
  }, []);

  const classifiedJobItems = useMemo<ClassifiedJobThread[]>(() => {
    const results: ClassifiedJobThread[] = [];
    for (const thread of rawJobThreads) {
      const override = manualOverrides[thread.id];
      if (override === 'dismissed') continue;
      const classified = classifyJobThread(thread, currentUserEmail, override);
      if (classified) {
        results.push(classified);
      }
    }
    return results.sort((a, b) => b.lastActivityDate - a.lastActivityDate);
  }, [rawJobThreads, currentUserEmail, manualOverrides]);

  const handleOverrideJobStatus = useCallback(
    (threadId: string, newStatus: JobApplicationStatus | 'dismissed') => {
      setManualOverrides((prev) => {
        const next = { ...prev, [threadId]: newStatus };
        try {
          window.localStorage.setItem(
            getOverrideStorageKey(currentUserEmail),
            JSON.stringify(next)
          );
        } catch {
          // ignore storage quota errors
        }
        return next;
      });
    },
    [currentUserEmail]
  );

  const runJobScan = useCallback(
    async (reset = true) => {
      const token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      const requestId = ++jobScanRequestIdRef.current;

      if (reset) {
        setIsScanningJobs(true);
        setJobScanError(null);
        setJobScanProgress({ completed: 0, total: 0 });
        setJobScanAttempted(true);
      } else {
        setIsScanningMoreJobs(true);
      }

      try {
        const knownIds = reset
          ? new Set<string>()
          : new Set<string>(rawJobThreads.map((t) => t.id));

        const res = await scanRawJobThreads(token, {
          cursors: reset ? undefined : jobCursors,
          knownThreadIds: knownIds,
          onProgress: (completed, total) => {
            if (requestId !== jobScanRequestIdRef.current) return;
            if (reset) {
              setJobScanProgress({ completed, total });
            }
          },
        });

        if (requestId !== jobScanRequestIdRef.current) return;

        setJobCursors(res.nextCursors);
        setHasMoreJobPages(res.hasMore);
        setHasLoadedJobsOnce(true);

        if (reset) {
          setRawJobThreads(res.threads);
        } else {
          setRawJobThreads((prev) => {
            const existing = new Set(prev.map((t) => t.id));
            const added = res.threads.filter((t) => !existing.has(t.id));
            return [...prev, ...added];
          });
        }
      } catch (err) {
        if (requestId !== jobScanRequestIdRef.current) return;
        if (err instanceof GmailAuthError) {
          handleAuthExpired();
          return;
        }
        setJobScanError(
          err instanceof Error ? err.message : 'تعذر فحص رسائل التوظيف.'
        );
      } finally {
        if (requestId !== jobScanRequestIdRef.current) return;
        setIsScanningJobs(false);
        setIsScanningMoreJobs(false);
        setJobScanProgress(null);
      }
    },
    [handleAuthExpired, jobCursors, rawJobThreads]
  );

  const activeFolderMeta = useMemo(() => {
    const sys = SYSTEM_FOLDERS.find((f) => f.id === activeFolderId);
    if (sys) return sys;
    const custom = userLabels.find((l) => l.id === activeFolderId);
    if (custom) {
      return {
        id: custom.id,
        label: custom.name,
        labelId: custom.id,
      };
    }
    return SYSTEM_FOLDERS[0];
  }, [activeFolderId, userLabels]);

  const buildCombinedQuery = useCallback(
    (folder: SystemFolder, search: string, filter: MailboxFilter) => {
      const parts: string[] = [];
      if (folder.query) parts.push(folder.query);
      if (filter === 'unread') parts.push('is:unread');
      if (filter === 'attachments') parts.push('has:attachment');
      if (search.trim()) parts.push(search.trim());
      return parts.join(' ').trim();
    },
    []
  );

  const loadAccountOverview = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    try {
      const [userProf, labelInfo] = await Promise.all([
        getUserProfile(token),
        listLabels(token),
      ]);
      setProfile(userProf);
      setUserLabels(labelInfo.userLabels);
      if (labelInfo.inboxLabel && typeof labelInfo.inboxLabel.messagesUnread === 'number') {
        setInboxUnreadCount(labelInfo.inboxLabel.messagesUnread);
      }
    } catch (err) {
      if (err instanceof GmailAuthError) {
        handleAuthExpired();
      } else {
        console.error('Failed to load Gmail overview:', err);
      }
    }
  }, [handleAuthExpired]);

  const loadThreadForMessage = useCallback(
    async (msg: EmailMessageSummary) => {
      const token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      const requestId = ++threadRequestIdRef.current;
      setIsLoadingThread(true);
      setThreadError(null);

      try {
        const detail = await getThreadDetail(token, msg.threadId, msg.id);
        if (requestId !== threadRequestIdRef.current) return;
        setSelectedThread(detail);
      } catch (err) {
        if (requestId !== threadRequestIdRef.current) return;
        if (err instanceof GmailAuthError) {
          handleAuthExpired();
          return;
        }
        setThreadError(
          err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الرسالة.'
        );
      } finally {
        if (requestId !== threadRequestIdRef.current) return;
        setIsLoadingThread(false);
      }
    },
    [handleAuthExpired]
  );

  const fetchMessages = useCallback(
    async (resetList = true, pageTokenToUse?: string) => {
      const token = await getAccessToken();
      if (!token) {
        setNeedsAuth(true);
        return;
      }

      const requestId = ++mailboxRequestIdRef.current;

      if (resetList) {
        setIsLoadingList(true);
        setListError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const combinedQuery = buildCombinedQuery(
          activeFolderMeta,
          submittedSearch,
          activeFilter
        );

        const result = await listMessagesWithMetadata(token, {
          labelId: activeFolderMeta.labelId,
          query: combinedQuery || undefined,
          pageToken: resetList ? undefined : pageTokenToUse,
          maxResults: 25,
        });

        if (requestId !== mailboxRequestIdRef.current) return;

        setNextPageToken(result.nextPageToken);

        if (resetList) {
          setMessages(result.messages);
          if (result.messages.length > 0) {
            const first = result.messages[0];
            setSelectedMessage(first);
            void loadThreadForMessage(first);
          } else {
            setSelectedMessage(null);
            setSelectedThread(null);
          }
        } else {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const uniqueNew = result.messages.filter((m) => !existingIds.has(m.id));
            return [...prev, ...uniqueNew];
          });
        }
      } catch (err) {
        if (requestId !== mailboxRequestIdRef.current) return;
        if (err instanceof GmailAuthError) {
          handleAuthExpired();
          return;
        }
        setListError(
          err instanceof Error ? err.message : 'حدث خطأ أثناء جلب رسائل البريد.'
        );
      } finally {
        if (requestId !== mailboxRequestIdRef.current) return;
        setIsLoadingList(false);
        setIsLoadingMore(false);
      }
    },
    [activeFolderMeta, submittedSearch, activeFilter, buildCombinedQuery, handleAuthExpired, loadThreadForMessage]
  );

  useEffect(() => {
    if (!needsAuth) {
      loadAccountOverview();
    }
  }, [needsAuth, loadAccountOverview]);

  useEffect(() => {
    if (!needsAuth && activeFolderId === 'JOBS' && !jobScanAttempted && !isScanningJobs) {
      void runJobScan(true);
    }
  }, [needsAuth, activeFolderId, jobScanAttempted, isScanningJobs, runJobScan]);

  useEffect(() => {
    if (!needsAuth && activeFolderId !== 'JOBS') {
      void fetchMessages(true);
    }
  }, [needsAuth, activeFolderId, submittedSearch, activeFilter, fetchMessages]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('تم إغلاق نافذة تسجيل الدخول قبل إتمام الربط.');
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'تعذر تسجيل الدخول باستخدام حساب Google. يرجى المحاولة مجدداً.'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setProfile(null);
    setInboxUnreadCount(null);
    setUserLabels([]);
    setAuthError(null);
    setManualOverrides({});
    resetMailboxState();
    resetJobState();
    setNeedsAuth(true);
  };

  const handleSelectFolder = (folderId: string) => {
    setActiveFolderId(folderId);
    setMobileShowReader(false);
    if (folderId !== 'JOBS') {
      setSelectedThread(null);
      setSelectedMessage(null);
      setThreadError(null);
    }
  };

  const handleSelectMessage = (msg: EmailMessageSummary) => {
    setSelectedMessage(msg);
    setMobileShowReader(true);
    void loadThreadForMessage(msg);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(searchInput.trim());
    setMobileShowReader(false);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSubmittedSearch('');
    setActiveFilter('all');
  };

  const handleRefresh = () => {
    void loadAccountOverview();
    void fetchMessages(true);
  };

  const handleDownloadAttachment = async (
    messageId: string,
    attachment: EmailAttachment
  ) => {
    const token = await getAccessToken();
    if (!token) {
      handleAuthExpired();
      return;
    }

    try {
      await downloadAttachmentFile(token, messageId, attachment);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      setThreadError(
        err instanceof Error ? err.message : 'تعذّر تنزيل المرفق.'
      );
    }
  };

  const renderFolderIcon = (id: string) => {
    switch (id) {
      case 'INBOX':
        return <Inbox className="w-4 h-4 shrink-0" />;
      case 'UNREAD':
        return <MailWarning className="w-4 h-4 shrink-0" />;
      case 'STARRED':
        return <Star className="w-4 h-4 shrink-0" />;
      case 'SENT':
        return <Send className="w-4 h-4 shrink-0" />;
      case 'DRAFT':
        return <FileText className="w-4 h-4 shrink-0" />;
      case 'ALL':
        return <Archive className="w-4 h-4 shrink-0" />;
      default:
        return <Folder className="w-4 h-4 shrink-0" />;
    }
  };

  const hasActiveFilters = submittedSearch.length > 0 || activeFilter !== 'all';

  return (
    <div className="min-h-screen lg:h-screen flex flex-col gap-3 p-3 lg:p-4 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="glass rounded-full flex items-center justify-between gap-6 ps-7 pe-2.5 h-14 shrink-0 z-20">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#jobs"
          onClick={(e) => {
            e.preventDefault();
            if (!needsAuth) handleSelectFolder('JOBS');
          }}
          className="text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 bg-linear-to-l from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent"
        >
          بريدك
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav
          aria-label="التنقل السريع في البريد"
          className="hidden md:flex items-center gap-1 p-1 rounded-full bg-black/5 dark:bg-white/5 text-sm font-medium text-slate-600"
        >
          {HEADER_NAV_ITEMS.map((navItem) => {
            const isActive = !needsAuth && activeFolderId === navItem.id;
            return (
              <button
                key={navItem.id}
                type="button"
                onClick={() => {
                  if (needsAuth) {
                    void handleLogin();
                  } else {
                    handleSelectFolder(navItem.id);
                  }
                }}
                className={`lg-seg-btn !text-[13px] !px-4 !py-1.5 shrink-0 ${
                  isActive ? 'lg-seg-btn-on' : ''
                }`}
              >
                {navItem.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {needsAuth ? (
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={isLoggingIn}
              className="lg-pill lg-pill-primary !py-2.5 shrink-0"
            >
              {isLoggingIn ? 'جاري الربط...' : 'تسجيل الدخول'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="lg-pill !py-2.5 shrink-0"
            >
              تسجيل الخروج
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {authChecking ? (
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="glass rounded-full px-6 py-3 flex items-center gap-2.5 text-sm text-slate-700">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
            <span>جاري التحقق من حالة الحساب...</span>
          </div>
        </main>
      ) : needsAuth ? (
        <main className="flex-1 flex flex-col justify-center py-6">
          <div className="max-w-3xl mx-auto w-full glass rounded-[40px] p-8 sm:p-12 lg-anim-in">
            <p className="inline-flex glass-thin rounded-full px-3.5 py-1.5 text-xs font-semibold text-blue-700 mb-5">
              متابعة طلبات التوظيف وتصفح البريد من حسابك في Gmail
            </p>
            <h1 className="lg-gradient-text text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-balance max-w-2xl mb-4">
              اعرف فوراً الوظائف التي قُبلت فيها أو رُفضت أو ما زلت تنتظر رداً عليها
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl mb-8">
              سجّل الدخول بحساب Google لفحص رسائل التقديم التي أرسلتها والردود الواردة من الشركات ومنصات التوظيف، وتصنيفها تلقائياً في متابعة الوظائف.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              <GoogleSignInButton
                onClick={() => void handleLogin()}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
              />
              {isLoggingIn && (
                <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>بانتظار استكمال المصادقة في نافذة Google...</span>
                </span>
              )}
            </div>

            {authError && (
              <div className="max-w-xl px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-2xl mb-8">
                {authError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 mt-10 border-t border-[color:var(--lg-hairline)]">
              <div
                style={{ animationDelay: '120ms' }}
                className="lg-anim-in lg-lift lg-feat lg-feat-green glass-thin rounded-3xl p-5"
              >
                <h2 className="text-sm font-semibold text-slate-900 mb-1.5">
                  عروض القبول والمقابلات
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يجمع رسائل القبول وعروض العمل ودعوات المقابلات والتقييمات الفنية في قائمة واحدة واضحة.
                </p>
              </div>
              <div
                style={{ animationDelay: '220ms' }}
                className="lg-anim-in lg-lift lg-feat lg-feat-amber glass-thin rounded-3xl p-5"
              >
                <h2 className="text-sm font-semibold text-slate-900 mb-1.5">
                  طلبات أرسلتها وتنتظر الرد
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يرصد السير الذاتية والطلبات التي أرسلتها ولم يصلها رد بعد مع حساب عدد الأيام منذ التقديم.
                </p>
              </div>
              <div
                style={{ animationDelay: '320ms' }}
                className="lg-anim-in lg-lift lg-feat lg-feat-red glass-thin rounded-3xl p-5"
              >
                <h2 className="text-sm font-semibold text-slate-900 mb-1.5">
                  رسائل الاعتذار والرفض
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يفصل ردود الاعتذار باللغتين العربية والإنجليزية بدقة مع إمكانية تصفح كل محادثات بريدك المعتادة.
                </p>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 lg:overflow-hidden">
          {/* Mobile View Switcher Bar */}
          <div className="lg:hidden glass rounded-full flex items-center justify-between gap-2 p-1.5 shrink-0">
            <div className="lg-seg">
              <button
                type="button"
                onClick={() => handleSelectFolder('JOBS')}
                className={`lg-seg-btn ${activeFolderId === 'JOBS' ? 'lg-seg-btn-on' : ''}`}
              >
                متابعة الوظائف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeFolderId === 'JOBS') handleSelectFolder('INBOX');
                }}
                className={`lg-seg-btn ${activeFolderId !== 'JOBS' ? 'lg-seg-btn-on' : ''}`}
              >
                البريد العام
              </button>
            </div>
            {profile?.emailAddress && (
              <span dir="ltr" className="text-[11px] text-slate-500 truncate max-w-[160px]">
                {profile.emailAddress}
              </span>
            )}
          </div>

          {/* Right Sidebar (RTL Start): Job Tracker + Folders & Custom Labels */}
          <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 glass rounded-[32px] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3.5 space-y-6">
              {/* Featured Job Tracker Section */}
              <div>
                <div className="px-2.5 pb-2 text-xs font-medium text-slate-500">
                  التوظيف والمسار المهني
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectFolder('JOBS')}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-full text-[13px] transition-all cursor-pointer whitespace-nowrap ${
                    activeFolderId === 'JOBS'
                      ? 'lg-tint-blue font-semibold'
                      : 'text-slate-800 hover:bg-white/40 font-medium'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span className="truncate">متابعة طلبات التوظيف</span>
                  </span>
                  {hasLoadedJobsOnce && (
                    <span
                      className={`font-mono tabular-nums text-[11px] font-semibold shrink-0 ${
                        activeFolderId === 'JOBS' ? 'text-blue-100' : 'text-blue-700'
                      }`}
                    >
                      {classifiedJobItems.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Standard Gmail Folders */}
              <div>
                <div className="px-2.5 pb-2 text-xs font-medium text-slate-500">
                  المجلدات الأساسية
                </div>
                <ul className="space-y-0.5">
                  {SYSTEM_FOLDERS.map((folder) => {
                    const isSelected = activeFolderId === folder.id;
                    const showUnread =
                      folder.id === 'INBOX' &&
                      inboxUnreadCount !== null &&
                      inboxUnreadCount > 0;
                    return (
                      <li key={folder.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectFolder(folder.id)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-full text-[13px] transition-all cursor-pointer whitespace-nowrap ${
                            isSelected
                              ? 'lg-sel text-slate-950 font-semibold'
                              : 'text-slate-700 hover:bg-white/40 font-medium'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2.5 truncate">
                            {renderFolderIcon(folder.id)}
                            <span className="truncate">{folder.label}</span>
                          </span>
                          {showUnread && (
                            <span className="font-mono tabular-nums text-[11px] font-semibold text-blue-700 shrink-0">
                              {inboxUnreadCount}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {userLabels.length > 0 && (
                <div>
                  <div className="px-2.5 pb-2 text-xs font-medium text-slate-500">
                    التصنيفات الخاصة
                  </div>
                  <ul className="space-y-0.5">
                    {userLabels.map((lbl) => {
                      const isSelected = activeFolderId === lbl.id;
                      return (
                        <li key={lbl.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectFolder(lbl.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap ${
                              isSelected
                                ? 'lg-sel text-slate-950 font-semibold'
                                : 'text-slate-600 hover:bg-white/40 font-normal'
                            }`}
                          >
                            <Folder className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span dir="auto" className="truncate">
                              {lbl.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Account Summary Footer */}
            <div className="p-4 border-t border-[color:var(--lg-hairline)] bg-white/10 text-xs text-slate-500 space-y-1">
              <div
                dir="ltr"
                className="font-medium text-slate-800 truncate text-end"
                title={currentUserEmail}
              >
                {currentUserEmail}
              </div>
              {profile && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>إجمالي الرسائل</span>
                  <span className="font-mono tabular-nums">
                    {profile.messagesTotal.toLocaleString('en-US')}
                  </span>
                </div>
              )}
            </div>
          </aside>

          {/* Main Workspace Column */}
          {activeFolderId === 'JOBS' ? (
            <JobTrackerView
              items={classifiedJobItems}
              isLoading={isScanningJobs}
              isLoadingMore={isScanningMoreJobs}
              scanProgress={jobScanProgress}
              error={jobScanError}
              hasMorePages={hasMoreJobPages}
              onRescan={() => void runJobScan(true)}
              onScanMore={() => void runJobScan(false)}
              onOverrideStatus={handleOverrideJobStatus}
              onDownloadAttachment={handleDownloadAttachment}
            />
          ) : (
            <main className="flex-1 flex flex-col min-w-0 min-h-0 glass rounded-[32px] overflow-hidden lg-anim-in">
              {/* Workspace Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--lg-hairline)] bg-white/15 shrink-0">
                {/* Mobile Folder Dropdown + Search Input */}
                <div className="flex items-center gap-2.5 flex-1 min-w-[240px] max-w-xl">
                  <select
                    aria-label="اختر المجلد"
                    value={activeFolderId}
                    onChange={(e) => handleSelectFolder(e.target.value)}
                    className="lg:hidden lg-input h-10 px-3 text-xs font-medium shrink-0"
                  >
                    <optgroup label="المجلدات الأساسية">
                      {SYSTEM_FOLDERS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                    {userLabels.length > 0 && (
                      <optgroup label="التصنيفات الخاصة">
                        {userLabels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  <form onSubmit={handleSearchSubmit} className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="ابحث في الرسائل (مثال: اسم المُرسل أو الموضوع)..."
                      className="lg-input w-full h-10 ps-10 pe-9 text-[13px]"
                    />
                    {(searchInput || submittedSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput('');
                          setSubmittedSearch('');
                        }}
                        aria-label="مسح البحث"
                        className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </form>
                </div>

                {/* Interactive Segmented Filter Controls + Refresh */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div
                    role="group"
                    aria-label="تصفية الرسائل"
                    className="lg-seg"
                  >
                    {(
                      [
                        { key: 'all', label: 'الكل' },
                        { key: 'unread', label: 'غير مقروءة' },
                        { key: 'attachments', label: 'بمرفقات' },
                      ] as Array<{ key: MailboxFilter; label: string }>
                    ).map((tab) => {
                      const active = activeFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveFilter(tab.key)}
                          className={`lg-seg-btn ${active ? 'lg-seg-btn-on' : ''}`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isLoadingList}
                    title="تحديث الرسائل"
                    className="lg-pill h-9 shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`}
                    />
                    <span>تحديث</span>
                  </button>
                </div>
              </div>

              {listError && (
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-red-50 border-b border-red-200/60 text-xs text-red-700 shrink-0">
                  <span>{listError}</span>
                  <button
                    type="button"
                    onClick={() => void fetchMessages(true)}
                    className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {/* Split View: Message List + Reading Pane */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Message List Column */}
                <section
                  aria-label="قائمة الرسائل"
                  className={`${
                    mobileShowReader ? 'hidden lg:flex' : 'flex'
                  } flex-col w-full lg:w-[390px] xl:w-[430px] shrink-0 border-e border-[color:var(--lg-hairline)] overflow-y-auto`}
                >
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-[color:var(--lg-hairline)] text-xs text-slate-500 shrink-0">
                    <span className="font-semibold text-slate-800 truncate">
                      {activeFolderMeta.label}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] whitespace-nowrap shrink-0">
                      {isLoadingList ? '...' : `${messages.length} رسالة معروضة`}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <MessageList
                      messages={messages}
                      selectedMessageId={selectedMessage?.id || null}
                      onSelectMessage={handleSelectMessage}
                      isLoading={isLoadingList}
                      isLoadingMore={isLoadingMore}
                      hasNextPage={Boolean(nextPageToken)}
                      onLoadMore={() => void fetchMessages(false, nextPageToken)}
                      hasActiveFilters={hasActiveFilters}
                      onResetFilters={handleResetFilters}
                      folderTitle={activeFolderMeta.label}
                    />
                  </div>
                </section>

                {/* Reading Pane Column */}
                <section
                  aria-label="عارض محتوى الرسالة"
                  className={`${
                    mobileShowReader ? 'block' : 'hidden lg:block'
                  } flex-1 overflow-y-auto`}
                >
                  {selectedThread && !isLoadingThread && !threadError && (
                    <div className="px-5 lg:px-8 py-3 bg-white/15 border-b border-[color:var(--lg-hairline)] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600">
                        هل هذه الرسالة متعلقة بوظيفة؟ صنّفها ضمن متابعة الوظائف:
                      </span>
                      <div className="lg-seg shrink-0">
                        {(
                          [
                            { status: 'accepted', label: 'اتقبلت / مقابلة' },
                            { status: 'waiting', label: 'مستني رد' },
                            { status: 'rejected', label: 'اترفضت' },
                          ] as Array<{ status: JobApplicationStatus; label: string }>
                        ).map((opt) => {
                          const currentOverride = manualOverrides[selectedThread.id];
                          const isMarked = currentOverride === opt.status;
                          return (
                            <button
                              key={opt.status}
                              type="button"
                              onClick={() => {
                                setRawJobThreads((prev) =>
                                  prev.some((t) => t.id === selectedThread.id)
                                    ? prev
                                    : [selectedThread, ...prev]
                                );
                                handleOverrideJobStatus(selectedThread.id, opt.status);
                              }}
                              className={`lg-seg-btn !text-[11px] ${
                                isMarked ? 'lg-tint-blue !text-white' : ''
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <ReadingPane
                    thread={selectedThread}
                    isLoading={isLoadingThread}
                    error={threadError}
                    onRetry={() => {
                      if (selectedMessage) {
                        void loadThreadForMessage(selectedMessage);
                      }
                    }}
                    onBackMobile={() => setMobileShowReader(false)}
                    onDownloadAttachment={handleDownloadAttachment}
                  />
                </section>
              </div>
            </main>
          )}
        </div>
      )}
    </div>
  );
}
