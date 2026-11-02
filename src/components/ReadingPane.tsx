import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MailOpen,
  Paperclip,
} from 'lucide-react';
import {
  EmailAttachment,
  EmailMessageDetail,
  EmailThreadDetail,
} from '../types/gmail';
import { formatFileSize, formatFullDate } from '../services/gmail';
import { EmailBodyRenderer } from './EmailBodyRenderer';

interface ReadingPaneProps {
  thread: EmailThreadDetail | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onBackMobile: () => void;
  onDownloadAttachment: (messageId: string, attachment: EmailAttachment) => Promise<void>;
}

export const ReadingPane: React.FC<ReadingPaneProps> = ({
  thread,
  isLoading,
  error,
  onRetry,
  onBackMobile,
  onDownloadAttachment,
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    setDownloadError(null);
    if (!thread || thread.messages.length === 0) {
      setExpandedIds({});
      return;
    }
    const lastMsg = thread.messages[thread.messages.length - 1];
    setExpandedIds({ [lastMsg.id]: true });
  }, [thread]);

  const toggleMessage = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownload = async (messageId: string, attachment: EmailAttachment) => {
    const key = `${messageId}-${attachment.partId}`;
    setDownloadingKey(key);
    setDownloadError(null);
    try {
      await onDownloadAttachment(messageId, attachment);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'تعذر تنزيل الملف المرفق.'
      );
    } finally {
      setDownloadingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 animate-pulse" aria-busy="true">
        <div className="h-6 w-2/3 bg-slate-400/25 rounded-full" />
        <div className="flex items-center justify-between border-b border-[color:var(--lg-hairline)] pb-4">
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-400/25 rounded-full" />
            <div className="h-3 w-36 bg-slate-400/15 rounded-full" />
          </div>
          <div className="h-3.5 w-28 bg-slate-400/15 rounded-full" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="h-4 w-full bg-slate-400/15 rounded-full" />
          <div className="h-4 w-11/12 bg-slate-400/15 rounded-full" />
          <div className="h-4 w-4/5 bg-slate-400/15 rounded-full" />
          <div className="h-4 w-3/5 bg-slate-400/15 rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
        <p className="text-sm font-medium text-red-700 mb-2">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="lg-pill lg-pill-primary"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!thread || thread.messages.length === 0) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full px-8 text-center text-slate-500">
        <div className="glass-thin rounded-[30px] w-20 h-20 flex items-center justify-center mb-4"><MailOpen className="w-9 h-9 text-slate-400 stroke-[1.5]" /></div>
        <p className="text-sm font-medium text-slate-700 mb-1">
          اختر رسالة لعرض محتواها الكامل
        </p>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          اضغط على أي رسالة من القائمة الجانبية لقراءة النص الكامل والمحادثة والمرفقات المرتبطة بها.
        </p>
      </div>
    );
  }

  const primarySubject =
    thread.messages[thread.messages.length - 1]?.subject || '(بدون موضوع)';
  const totalMessages = thread.messages.length;

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto lg-anim-in">
      {/* Mobile Back Action */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={onBackMobile}
          className="lg-pill"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة إلى قائمة الرسائل</span>
        </button>
      </div>

      {/* Subject Header */}
      <div className="pb-5 border-b border-[color:var(--lg-hairline)]">
        <h1
          dir="auto"
          className="text-xl lg:text-[26px] font-bold tracking-tight text-slate-950 leading-snug break-words"
        >
          {primarySubject}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
          <span className="font-mono tabular-nums">
            {totalMessages === 1 ? 'رسالة واحدة' : `${totalMessages} رسائل في هذه المحادثة`}
          </span>
          {totalMessages > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => {
                  const allOpen = thread.messages.every((m) => expandedIds[m.id]);
                  if (allOpen) {
                    const last = thread.messages[thread.messages.length - 1];
                    setExpandedIds({ [last.id]: true });
                  } else {
                    const next: Record<string, boolean> = {};
                    thread.messages.forEach((m) => {
                      next[m.id] = true;
                    });
                    setExpandedIds(next);
                  }
                }}
                className="text-blue-700 hover:underline font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {thread.messages.every((m) => expandedIds[m.id])
                  ? 'طي الرسائل السابقة'
                  : 'توسيع كل الرسائل'}
              </button>
            </>
          )}
        </div>
      </div>

      {downloadError && (
        <div className="mt-4 px-4 py-2.5 text-xs text-red-700 bg-red-50 border border-red-200/60 rounded-2xl">
          {downloadError}
        </div>
      )}

      {/* Thread Messages */}
      <div className="space-y-3 mt-5">
        {thread.messages.map((message: EmailMessageDetail, index: number) => {
          const isExpanded = Boolean(expandedIds[message.id]) || totalMessages === 1;
          const isLast = index === totalMessages - 1;

          return (
            <article key={message.id} className="glass-thin rounded-3xl p-4 lg:p-5">
              {/* Message Header */}
              <div
                onClick={() => {
                  if (totalMessages > 1 && !isLast) {
                    toggleMessage(message.id);
                  } else if (totalMessages > 1 && isLast) {
                    toggleMessage(message.id);
                  }
                }}
                className={`flex items-start justify-between gap-4 ${
                  totalMessages > 1 ? 'cursor-pointer select-none' : ''
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      dir="auto"
                      className="text-sm font-semibold text-slate-950"
                    >
                      {message.from.name}
                    </span>
                    {message.from.email && message.from.email !== message.from.name && (
                      <span
                        dir="ltr"
                        className="font-mono text-xs text-slate-500 truncate"
                      >
                        &lt;{message.from.email}&gt;
                      </span>
                    )}
                  </div>

                  {isExpanded ? (
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {message.to && (
                        <div className="truncate" dir="auto">
                          <span className="text-slate-400">إلى: </span>
                          <span>{message.to}</span>
                        </div>
                      )}
                      {message.cc && (
                        <div className="truncate" dir="auto">
                          <span className="text-slate-400">نسخة: </span>
                          <span>{message.cc}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p dir="auto" className="text-xs text-slate-500 truncate">
                      {message.snippet}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <time className="font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                    {formatFullDate(message.internalDate)}
                  </time>
                  {totalMessages > 1 && (
                    <span className="text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Message Body & Attachments */}
              {isExpanded && (
                <div className="mt-4">
                  <EmailBodyRenderer
                    htmlBody={message.htmlBody}
                    textBody={message.textBody}
                    snippet={message.snippet}
                  />

                  {message.attachments.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[color:var(--lg-hairline)]">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-3">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="tabular-nums">
                          المرفقات ({message.attachments.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {message.attachments.map((att) => {
                          const key = `${message.id}-${att.partId}`;
                          const isDownloading = downloadingKey === key;
                          return (
                            <div
                              key={key}
                              className="glass-thin flex items-center justify-between gap-3 ps-4 pe-2.5 py-2.5 rounded-2xl"
                            >
                              <div className="min-w-0 flex-1">
                                <p
                                  dir="auto"
                                  className="text-xs font-medium text-slate-900 truncate"
                                >
                                  {att.filename}
                                </p>
                                <p className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5">
                                  {formatFileSize(att.size)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDownload(message.id, att)}
                                disabled={isDownloading}
                                className="lg-pill !py-1.5 !px-3.5 shrink-0"
                              >
                                {isDownloading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>تنزيل</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
