import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  EyeOff,
  Loader2,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import {
  ClassifiedJobThread,
  EmailAttachment,
  JobApplicationStatus,
  JobFilterTab,
} from '../types/gmail';
import { formatFullDate, formatListDate } from '../services/gmail';
import { ReadingPane } from './ReadingPane';

interface JobTrackerViewProps {
  items: ClassifiedJobThread[];
  isLoading: boolean;
  isLoadingMore: boolean;
  scanProgress: { completed: number; total: number } | null;
  error: string | null;
  hasMorePages: boolean;
  onRescan: () => void;
  onScanMore: () => void;
  onOverrideStatus: (threadId: string, newStatus: JobApplicationStatus | 'dismissed') => void;
  onDownloadAttachment: (messageId: string, attachment: EmailAttachment) => Promise<void>;
}

export const JobTrackerView: React.FC<JobTrackerViewProps> = ({
  items,
  isLoading,
  isLoadingMore,
  scanProgress,
  error,
  hasMorePages,
  onRescan,
  onScanMore,
  onOverrideStatus,
  onDownloadAttachment,
}) => {
  const [activeTab, setActiveTab] = useState<JobFilterTab>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mobileShowReader, setMobileShowReader] = useState<boolean>(false);

  const counts = useMemo(() => {
    let accepted = 0;
    let offers = 0;
    let waiting = 0;
    let sentNoReply = 0;
    let rejected = 0;

    for (const item of items) {
      if (item.status === 'accepted') {
        accepted += 1;
        if (item.subStage === 'offer') offers += 1;
      } else if (item.status === 'waiting') {
        waiting += 1;
        if (item.subStage === 'sent_no_reply') sentNoReply += 1;
      } else if (item.status === 'rejected') {
        rejected += 1;
      }
    }

    return {
      total: items.length,
      accepted,
      offers,
      waiting,
      sentNoReply,
      rejected,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab !== 'all' && item.status !== activeTab) {
        return false;
      }
      if (!q) return true;
      const inCompany = item.companyName.toLowerCase().includes(q);
      const inSubject = item.roleOrSubject.toLowerCase().includes(q);
      const inMessages = item.thread.messages.some(
        (m) =>
          m.from.email.toLowerCase().includes(q) ||
          m.to.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q)
      );
      return inCompany || inSubject || inMessages;
    });
  }, [items, activeTab, searchTerm]);

  const activeJobItem = useMemo(() => {
    if (filteredItems.length === 0) return null;
    if (selectedThreadId) {
      const found = filteredItems.find((i) => i.threadId === selectedThreadId);
      if (found) return found;
    }
    return filteredItems[0];
  }, [filteredItems, selectedThreadId]);

  const renderStatusIndicator = (item: ClassifiedJobThread) => {
    if (item.status === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{item.statusLabel}</span>
        </span>
      );
    }
    if (item.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{item.statusLabel}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{item.statusLabel}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0">
      {/* Top 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setMobileShowReader(false);
          }}
          className={`lg-card glass text-start px-5 py-4 ${
            activeTab === 'all' ? 'lg-card-on' : ''
          }`}
        >
          <div className="text-xs font-medium text-slate-500 mb-1">
            إجمالي طلبات التوظيف
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold tracking-tight text-slate-950">
            {isLoading ? '—' : counts.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            محادثات التقديم والردود المكتشفة
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('accepted');
            setMobileShowReader(false);
          }}
          className={`lg-card glass text-start px-5 py-4 ${
            activeTab === 'accepted' ? 'lg-card-on' : ''
          }`}
        >
          <div className="text-xs font-medium text-emerald-800 mb-1">
            اتقبلت / مقابلة عمل
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold tracking-tight text-emerald-700">
            {isLoading ? '—' : counts.accepted}
          </div>
          <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5 truncate">
            {isLoading
              ? '...'
              : counts.offers > 0
              ? `منها ${counts.offers} عرض عمل مباشر`
              : 'عروض عمل ودعوات مقابلات'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('waiting');
            setMobileShowReader(false);
          }}
          className={`lg-card glass text-start px-5 py-4 ${
            activeTab === 'waiting' ? 'lg-card-on' : ''
          }`}
        >
          <div className="text-xs font-medium text-amber-800 mb-1">
            بعت ولسه مستني رد
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold tracking-tight text-amber-700">
            {isLoading ? '—' : counts.waiting}
          </div>
          <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-0.5 truncate">
            {isLoading
              ? '...'
              : `${counts.sentNoReply} بدون أي رد حتى الآن`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('rejected');
            setMobileShowReader(false);
          }}
          className={`lg-card glass text-start px-5 py-4 ${
            activeTab === 'rejected' ? 'lg-card-on' : ''
          }`}
        >
          <div className="text-xs font-medium text-red-800 mb-1">
            اترفضت / اعتذار
          </div>
          <div className="font-mono tabular-nums text-3xl font-bold tracking-tight text-red-700">
            {isLoading ? '—' : counts.rejected}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            رسائل اعتذار عن استكمال التوظيف
          </div>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass rounded-[28px] flex flex-wrap items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الشركة أو المسمى الوظيفي..."
            className="lg-input w-full h-10 ps-10 pe-9 text-[13px]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="مسح البحث"
              className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="تصفية حسب حالة التقديم"
            className="lg-seg"
          >
            {(
              [
                { key: 'all', label: 'الكل' },
                { key: 'accepted', label: 'اتقبلت / مقابلة' },
                { key: 'waiting', label: 'مستني رد' },
                { key: 'rejected', label: 'اترفضت' },
              ] as Array<{ key: JobFilterTab; label: string }>
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setMobileShowReader(false);
                  }}
                  className={`lg-seg-btn ${active ? 'lg-seg-btn-on' : ''}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onRescan}
            disabled={isLoading || isLoadingMore}
            className="lg-pill h-9 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>إعادة الفحص</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 px-5 py-3 bg-red-50 border border-red-200/60 rounded-2xl text-xs text-red-700 shrink-0">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRescan}
            className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Split Master-Detail Content */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Left/Start List of Classified Job Threads */}
        <section
          aria-label="قائمة طلبات التوظيف"
          className={`${
            mobileShowReader ? 'hidden lg:flex' : 'flex'
          } flex-col w-full lg:w-[410px] xl:w-[450px] shrink-0 glass rounded-[32px] overflow-y-auto`}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[color:var(--lg-hairline)] text-xs text-slate-500 shrink-0">
            <span className="font-semibold text-slate-800 truncate">
              {activeTab === 'all'
                ? 'كل رسائل التوظيف'
                : activeTab === 'accepted'
                ? 'الرسائل المقبولة والمقابلات'
                : activeTab === 'waiting'
                ? 'طلبات بانتظار الرد'
                : 'طلبات تم الاعتذار عنها'}
            </span>
            <span className="font-mono tabular-nums text-[11px] whitespace-nowrap shrink-0">
              {isLoading
                ? scanProgress && scanProgress.total > 0
                  ? `فحص ${scanProgress.completed}/${scanProgress.total}`
                  : 'جاري الفحص...'
                : `${filteredItems.length} طلب`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-2 space-y-1">
                {scanProgress && scanProgress.total > 0 && (
                  <div className="px-4 py-3 glass-thin rounded-2xl flex items-center justify-between text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                      <span>جاري تحليل رسائل البريد المرسل والوارد...</span>
                    </span>
                    <span className="font-mono tabular-nums font-medium">
                      {scanProgress.completed} / {scanProgress.total}
                    </span>
                  </div>
                )}
                {Array.from({ length: 7 }).map((_, idx) => (
                  <div key={idx} className="px-4 py-3.5 space-y-2 animate-pulse rounded-2xl bg-white/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="h-4 w-32 bg-slate-400/25 rounded-full" />
                      <div className="h-3 w-14 bg-slate-400/15 rounded-full" />
                    </div>
                    <div className="h-3.5 w-4/5 bg-slate-400/20 rounded-full" />
                    <div className="h-3 w-1/2 bg-slate-400/15 rounded-full" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="glass-thin rounded-[28px] w-16 h-16 flex items-center justify-center mb-4"><Briefcase className="w-7 h-7 text-slate-400 stroke-[1.5]" /></div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  لا توجد رسائل مطابقة في هذا القسم
                </h3>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
                  {searchTerm || activeTab !== 'all'
                    ? 'جرّب عرض كل الحالات أو مسح نص البحث، أو افحص رسائل أقدم في بريدك.'
                    : 'لم نجد رسائل توظيف في أحدث المحادثات. يمكنك فحص الرسائل الأقدم للبحث في أرشيف بريدك.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {(searchTerm || activeTab !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setActiveTab('all');
                      }}
                      className="lg-pill"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>عرض كل الحالات</span>
                    </button>
                  )}
                  {hasMorePages && (
                    <button
                      type="button"
                      onClick={onScanMore}
                      disabled={isLoadingMore}
                      className="lg-pill lg-pill-primary"
                    >
                      {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>فحص رسائل أقدم</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredItems.map((item) => {
                  const isSelected = activeJobItem?.threadId === item.threadId;
                  return (
                    <button
                      key={item.threadId}
                      type="button"
                      onClick={() => {
                        setSelectedThreadId(item.threadId);
                        setMobileShowReader(true);
                      }}
                      className={`lg-row w-full text-start px-4 py-3 cursor-pointer border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${
                        isSelected ? 'lg-row-on' : ''
                      }`}
                    >
                      {/* Row 1: Company Name + Last Activity Date */}
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span
                          dir="auto"
                          className="text-sm font-semibold text-slate-950 truncate max-w-[72%]"
                        >
                          {item.companyName}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                          {formatListDate(item.lastActivityDate)}
                        </span>
                      </div>

                      {/* Row 2: Role / Subject */}
                      <div
                        dir="auto"
                        className="text-[13px] text-slate-800 truncate mb-1.5"
                      >
                        {item.roleOrSubject}
                      </div>

                      {/* Row 3: Clean Unboxed Status & Metadata */}
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                        {renderStatusIndicator(item)}
                        <span aria-hidden="true">·</span>
                        {item.status === 'waiting' ? (
                          <span className="font-mono tabular-nums">
                            {item.daysSinceApplied === 0
                              ? 'اليوم'
                              : `منذ ${item.daysSinceApplied} يوم`}
                          </span>
                        ) : (
                          <span className="font-mono tabular-nums">
                            {item.messageCount === 1
                              ? 'رسالة واحدة'
                              : `${item.messageCount} رسائل`}
                          </span>
                        )}
                        {item.hasAttachments && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 text-slate-500">
                              <Paperclip className="w-3 h-3" />
                              <span>مرفق</span>
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}

                {hasMorePages && (
                  <div className="p-4 flex justify-center">
                    <button
                      type="button"
                      onClick={onScanMore}
                      disabled={isLoadingMore}
                      className="lg-pill"
                    >
                      {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {isLoadingMore ? 'جاري فحص رسائل أقدم...' : 'فحص رسائل توظيف أقدم'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right/End Detail Column: Status Summary + Full Thread Reader */}
        <section
          aria-label="تفاصيل طلب التوظيف والمحادثة"
          className={`${
            mobileShowReader ? 'block' : 'hidden lg:block'
          } flex-1 overflow-y-auto glass rounded-[32px]`}
        >
          {activeJobItem ? (
            <div>
              {/* Contextual Status & Manual Override Bar */}
              <div className="px-5 lg:px-8 py-3.5 bg-white/15 border-b border-[color:var(--lg-hairline)] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {renderStatusIndicator(activeJobItem)}
                    <span className="text-slate-400" aria-hidden="true">·</span>
                    <span className="text-slate-600">{activeJobItem.reason}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>بداية التقديم: {formatFullDate(activeJobItem.appliedDate)}</span>
                    {activeJobItem.sentByUser && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>تتضمن رسائل مرسلة منك</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Manual Classification Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-slate-500 hidden sm:inline">
                    تعديل الحالة:
                  </span>
                  <div className="lg-seg">
                    <button
                      type="button"
                      onClick={() => onOverrideStatus(activeJobItem.threadId, 'accepted')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeJobItem.status === 'accepted'
                          ? '!bg-emerald-50 !text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      مقبول
                    </button>
                    <button
                      type="button"
                      onClick={() => onOverrideStatus(activeJobItem.threadId, 'waiting')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeJobItem.status === 'waiting'
                          ? '!bg-amber-50 !text-amber-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      مستني رد
                    </button>
                    <button
                      type="button"
                      onClick={() => onOverrideStatus(activeJobItem.threadId, 'rejected')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeJobItem.status === 'rejected'
                          ? '!bg-red-50 !text-red-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      مرفوض
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onOverrideStatus(activeJobItem.threadId, 'dismissed');
                        setMobileShowReader(false);
                      }}
                      title="استبعاد هذه المحادثة من قائمة الوظائف"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>استبعاد</span>
                    </button>
                  </div>
                </div>
              </div>

              <ReadingPane
                thread={activeJobItem.thread}
                isLoading={false}
                error={null}
                onRetry={onRescan}
                onBackMobile={() => setMobileShowReader(false)}
                onDownloadAttachment={onDownloadAttachment}
              />
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full px-8 text-center text-slate-500">
              <div className="glass-thin rounded-[30px] w-20 h-20 flex items-center justify-center mb-4"><Briefcase className="w-9 h-9 text-slate-400 stroke-[1.5]" /></div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                اختر طلب توظيف لعرض تفاصيل الرسالة والردود
              </p>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                اضغط على أي طلب من القائمة لقراءة نص التقديم الأصلي ورسائل الرد والمرفقات كاملة.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
