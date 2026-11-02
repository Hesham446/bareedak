import React from 'react';
import { Inbox, Loader2, RotateCcw, Star } from 'lucide-react';
import { EmailMessageSummary } from '../types/gmail';

interface MessageListProps {
  messages: EmailMessageSummary[];
  selectedMessageId: string | null;
  onSelectMessage: (msg: EmailMessageSummary) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  folderTitle: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  selectedMessageId,
  onSelectMessage,
  isLoading,
  isLoadingMore,
  hasNextPage,
  onLoadMore,
  hasActiveFilters,
  onResetFilters,
  folderTitle,
}) => {
  if (isLoading) {
    return (
      <div className="p-2 space-y-1" aria-busy="true" aria-label="جاري تحميل الرسائل">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div key={idx} className="px-4 py-3.5 space-y-2 animate-pulse rounded-2xl bg-white/20">
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-36 bg-slate-400/25 rounded-full" />
              <div className="h-3 w-12 bg-slate-400/15 rounded-full" />
            </div>
            <div className="h-3.5 w-3/4 bg-slate-400/20 rounded-full" />
            <div className="h-3 w-full bg-slate-400/15 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="glass-thin rounded-[28px] w-16 h-16 flex items-center justify-center mb-4"><Inbox className="w-7 h-7 text-slate-400 stroke-[1.5]" /></div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          لا توجد رسائل في «{folderTitle}»
        </h3>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
          {hasActiveFilters
            ? 'لم يتم العثور على رسائل تطابق عبارة البحث أو عامل التصفية المحدد حالياً.'
            : 'هذا المجلد فارغ حالياً أو لا يحتوي على رسائل مطابقة.'}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="lg-pill"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط البحث والتصفية</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-2 space-y-0.5">
      {messages.map((msg) => {
        const isSelected = msg.id === selectedMessageId;
        return (
          <button
            key={msg.id}
            type="button"
            onClick={() => onSelectMessage(msg)}
            className={`lg-row w-full text-start px-4 py-3 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${
              isSelected ? 'lg-row-on' : ''
            }`}
          >
            {/* Row 1: Sender & Timestamp */}
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="flex items-center gap-2 min-w-0 max-w-[72%]">
                {msg.isUnread && <span className="lg-dot-unread" aria-label="غير مقروء" />}
              <span
                dir="auto"
                className={`text-sm truncate ${
                  msg.isUnread
                    ? 'font-semibold text-slate-950'
                    : 'font-medium text-slate-700'
                }`}
              >
                {msg.from.name}
              </span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                {msg.dateFormatted}
              </span>
            </div>

            {/* Row 2: Subject */}
            <div
              dir="auto"
              className={`text-[13px] truncate mb-1 ${
                msg.isUnread
                  ? 'font-semibold text-slate-900'
                  : 'font-normal text-slate-700'
              }`}
            >
              {msg.subject}
            </div>

            {/* Row 3: Snippet + Clean Unboxed Metadata */}
            <p
              dir="auto"
              className="text-xs text-slate-500 truncate leading-relaxed"
            >
              {msg.snippet || 'بدون معاينة نصية'}
            </p>

            {(msg.isUnread || msg.isStarred) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                {msg.isUnread && (
                  <span className="font-medium text-blue-700">غير مقروء</span>
                )}
                {msg.isUnread && msg.isStarred && (
                  <span aria-hidden="true">·</span>
                )}
                {msg.isStarred && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>مميزة بنجمة</span>
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}

      {hasNextPage && (
        <div className="p-4 flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="lg-pill"
          >
            {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isLoadingMore ? 'جاري التحميل...' : 'تحميل المزيد من الرسائل'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
