import {
  ClassifiedJobThread,
  EmailMessageDetail,
  EmailThreadDetail,
  JobApplicationStatus,
  JobApplicationSubStage,
} from '../types/gmail';

const ATS_AND_JOB_DOMAINS = [
  'wuzzuf.com',
  'wuzzufmail.com',
  'bayt.com',
  'greenhouse.io',
  'greenhouse-mail.io',
  'lever.co',
  'hire.lever.co',
  'myworkdayjobs.com',
  'workday.com',
  'smartrecruiters.com',
  'workablemail.com',
  'workable.com',
  'ashbyhq.com',
  'bamboohr.com',
  'recruitee.com',
  'breezy.hr',
  'jobvite.com',
  'icims.com',
  'taleo.net',
  'naukrigulf.com',
  'forasna.com',
  'tanqeeb.com',
  'indeed.com',
  'indeedemail.com',
  'glassdoor.com',
  'wellfound.com',
  'otta.com',
  'hired.com',
  'turing.com',
  'toptal.com',
  'andela.com',
  'personio.de',
  'personio.com',
  'teamtailor.com',
  'jazzhr.com',
  'zohorecruit.com',
];

const HR_LOCAL_PARTS = /^(hr|careers|career|jobs|job|talent|recruiting|recruitment|recruiter|hiring|people|join|apply|applications|cv)@/i;

const JOB_DIGEST_EXCLUSION_PATTERNS = [
  /\bjob alert\b/i,
  /\bjobs for you\b/i,
  /\bnew jobs?\b.*\bmatch/i,
  /\bjobs you may be interested in\b/i,
  /\brecommended jobs\b/i,
  /\btop job picks\b/i,
  /\bsimilar jobs\b/i,
  /\bwho viewed your profile\b/i,
  /\bappeared in \d+ search/i,
  /\bnew connection\b/i,
  /\binvited you to connect\b/i,
  /\bis hiring a\b/i,
  /\bis hiring for\b/i,
  /\bjobs in egypt\b/i,
  /\bjobs near\b/i,
  /وظائف قد تهمك/,
  /تنبيهات الوظائف/,
  /وظائف جديدة تطابق/,
  /وظائف مقترحة/,
  /شاهد ملفك الشخصي/,
];

const NON_JOB_NOISE_PATTERNS = [
  /\boauth\b/i,
  /\bfirebase\b/i,
  /\bgoogle cloud\b/i,
  /\biam role\b/i,
  /\bapi key\b/i,
  /\bbilling\b/i,
  /\binvoice\b/i,
  /\breceipt\b/i,
  /\bverification code\b/i,
  /\bpassword reset\b/i,
  /\bsecurity alert\b/i,
  /\bcredit card\b/i,
  /\bloan application\b/i,
  /\bvisa application\b/i,
  /\bpull request\b/i,
  /\bgithub actions\b/i,
];

const STRONG_EMPLOYMENT_CONTEXT = [
  /\bthank you for applying\b/i,
  /\bthanks for applying\b/i,
  /\bthank you for your application\b/i,
  /\bapplication received\b/i,
  /\bwe received your application\b/i,
  /\bwe have received your application\b/i,
  /\byour application (to|for|at|with)\b/i,
  /\byour candidacy\b/i,
  /\bhiring team\b/i,
  /\btalent acquisition\b/i,
  /\brecruitment team\b/i,
  /\brecruiting team\b/i,
  /\bjob offer\b/i,
  /\boffer of employment\b/i,
  /\boffer letter\b/i,
  /\binterview\b/i,
  /\bshortlisted\b/i,
  /\bother candidates\b/i,
  /\bnot moving forward\b/i,
  /\bcurriculum vitae\b/i,
  /\bcover letter\b/i,
  /\battached (my )?(cv|resume)\b/i,
  /\bapplying for (the|a)\b/i,
  /\bapplication for (the )?.*(position|role|vacancy|internship|job)\b/i,
  /طلب التوظيف/,
  /طلبك للوظيفة/,
  /التقديم على وظيفة/,
  /التقدم لوظيفة/,
  /السيرة الذاتية/,
  /سيرة ذاتية/,
  /مقابلة عمل/,
  /عرض عمل/,
  /فريق التوظيف/,
  /الموارد البشرية/,
  /تم استلام طلبك/,
];

const REJECTION_PATTERNS = [
  /\bunfortunately[, ]+(we|your|at this time|after)\b/i,
  /\bnot (be )?moving forward\b/i,
  /\bunable to move forward\b/i,
  /\bwill not be proceeding\b/i,
  /\bnot to proceed\b/i,
  /\bdecided to move forward with other\b/i,
  /\bpursue other candidates\b/i,
  /\bproceed with other candidates\b/i,
  /\bselected another candidate\b/i,
  /\bother candidates whose\b/i,
  /\bother applicants whose\b/i,
  /\bregret to inform\b/i,
  /\bsorry to inform\b/i,
  /\bhave not been selected\b/i,
  /\bwere not selected\b/i,
  /\bwas not selected\b/i,
  /\bapplication was unsuccessful\b/i,
  /\bunable to offer you\b/i,
  /\bcannot offer you\b/i,
  /\bposition has been filled\b/i,
  /\brole has been filled\b/i,
  /\bdecided not to move forward\b/i,
  /\bnot the right fit\b/i,
  /يؤسفنا إبلاغك/,
  /يؤسفنا إخبارك/,
  /نأسف لإبلاغك/,
  /نعتذر عن عدم/,
  /للأسف لم يتم/,
  /لم يتم قبول/,
  /لم يقع الاختيار/,
  /مرشحين آخرين/,
  /اختيار مرشح آخر/,
  /استكمال الإجراءات مع مرشحين/,
  /عدم المضي قدماً/,
];

const OFFER_PATTERNS = [
  /\bpleased to offer\b/i,
  /\bdelighted to offer\b/i,
  /\bexcited to offer\b/i,
  /\bthrilled to offer\b/i,
  /\bhappy to offer\b/i,
  /\bextend an offer\b/i,
  /\boffer of employment\b/i,
  /\boffer letter\b/i,
  /\bformal job offer\b/i,
  /\bwelcome aboard\b/i,
  /\bwelcome to the team\b/i,
  /\bcongratulations!?\s+we (would like|are pleased|are excited) to offer\b/i,
  /\byou have been selected for the (position|role|job)\b/i,
  /يسعدنا تقديم عرض/,
  /يسرنا تقديم عرض/,
  /عرض عمل رسمي/,
  /يسرنا قبولك/,
  /تم قبولك في وظيفة/,
  /مبروك قبولك/,
  /تهانينا.*تم اختيارك/,
];

const INTERVIEW_OR_NEXT_STEP_PATTERNS = [
  /\binvite you (to|for) (an |a )?(first |initial |technical |phone |video |hr )?interview\b/i,
  /\bschedule (an |a |your )?(first |initial |technical |phone |video |hr )?(interview|call|chat|screening)\b/i,
  /\blove to (schedule|set up) (a |an )?(call|interview|chat)\b/i,
  /\blike to (schedule|arrange|set up) (a |an )?(call|interview|meeting)\b/i,
  /\byour availability for (a |an )?(call|interview|chat|meeting)\b/i,
  /\bbook a time\b/i,
  /\bselect a time slot\b/i,
  /\bcalendly\.com\b/i,
  /\bshortlisted\b/i,
  /\badvance(d)? (you |your application )?to the next (stage|round|step)\b/i,
  /\bmove(d)? forward to the (interview|next stage|next round|technical)\b/i,
  /\btechnical assessment\b/i,
  /\bcoding (challenge|assessment|test)\b/i,
  /\btake-home (assignment|challenge|task)\b/i,
  /\bhackerrank\b/i,
  /\bcodility\b/i,
  /\bphone screen\b/i,
  /دعوتك لمقابلة/,
  /تحديد موعد مقابلة/,
  /إجراء مقابلة/,
  /ميعاد انترفيو/,
  /موعد انترفيو/,
  /تم ترشيحك/,
  /اجتياز الفرز/,
  /المرحلة التالية من التوظيف/,
  /اختبار تقني/,
  /تاسك تقني/,
];

const CONDITIONAL_RECEIPT_BOILERPLATE = [
  /\bif your (profile|qualifications|background|experience|skills) match/i,
  /\bif (you are )?selected for an interview/i,
  /\bshould your (profile|qualifications|application) match/i,
  /\bwe will review your application and\b/i,
  /\bour team is (currently )?reviewing your application\b/i,
  /\bthank you for applying\b/i,
  /\bapplication has been received\b/i,
  /\bwe have received your application\b/i,
  /في حال مطابقة/,
  /إذا تم ترشيحك/,
  /سيقوم فريق التوظيف بمراجعة طلبك/,
];

const AUTO_RECEIPT_PATTERNS = [
  /\bthank you for applying\b/i,
  /\bthanks for applying\b/i,
  /\bapplication received\b/i,
  /\bwe received your application\b/i,
  /\bwe have received your application\b/i,
  /\byour application was sent\b/i,
  /\byour application has been submitted\b/i,
  /\bsuccessfully applied\b/i,
  /\bautomatic reply\b/i,
  /\bauto-reply\b/i,
  /\bout of office\b/i,
  /تم استلام طلبك/,
  /تم إرسال طلبك/,
  /شكراً لتقديمك/,
  /تلقينا طلبك/,
  /رد تلقائي/,
];

function stripHtmlToPlain(html: string | null): string {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style, script, head').forEach((el) => el.remove());
    return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function getMessagePlainContent(msg: EmailMessageDetail): string {
  const plain = msg.textBody ? msg.textBody.replace(/\s+/g, ' ').trim() : '';
  const fromHtml = stripHtmlToPlain(msg.htmlBody);
  const body = plain.length >= fromHtml.length * 0.5 && plain.length > 0 ? plain : fromHtml || plain;
  return `${msg.subject}\n${body || msg.snippet}`.trim();
}

function isMessageFromUser(msg: EmailMessageDetail, userEmail: string): boolean {
  if (msg.labelIds.includes('SENT')) return true;
  if (!userEmail) return false;
  return msg.from.email.toLowerCase() === userEmail.toLowerCase();
}

function isAtsOrHrAddress(email: string): boolean {
  const lower = (email || '').toLowerCase();
  if (!lower) return false;
  if (HR_LOCAL_PARTS.test(lower)) return true;
  if (lower.includes('jobs-noreply@linkedin.com') || lower.includes('jobs-listings@linkedin.com')) {
    return true;
  }
  return ATS_AND_JOB_DOMAINS.some(
    (domain) => lower.endsWith(`@${domain}`) || lower.endsWith(`.${domain}`)
  );
}

function hasResumeOrPortfolioAttachment(msg: EmailMessageDetail): boolean {
  return msg.attachments.some((att) =>
    /(cv|resume|curriculum|portfolio|سيرة|ذاتية)/i.test(att.filename)
  );
}

function extractCompanyName(
  thread: EmailThreadDetail,
  userEmail: string
): string {
  const messages = thread.messages;
  const externalMsg = messages.find((m) => !isMessageFromUser(m, userEmail));
  const firstMsg = messages[0];

  // Try extracting from subject like "Your application to Acme Corp" or "Thank you for applying to Stripe"
  for (const m of messages) {
    const subj = m.subject || '';
    const appToMatch = subj.match(
      /(?:application (?:to|at|with)|applying (?:to|at)|sent to)\s+([A-Z0-9][\w\s&.-]{1,32}?)(?:\s*[-–|:]|$)/i
    );
    if (appToMatch && appToMatch[1]) {
      return appToMatch[1].trim();
    }
  }

  if (externalMsg) {
    let senderName = externalMsg.from.name || '';
    senderName = senderName
      .replace(/\s+via\s+(LinkedIn|Wuzzuf|Indeed|Greenhouse|Workable).*$/i, '')
      .replace(/\b(Hiring Team|Careers|Talent Acquisition|Recruitment|HR Team|Jobs|No-?Reply)\b/gi, '')
      .replace(/^[-–|:\s]+|[-–|:\s]+$/g, '')
      .trim();

    if (senderName && !senderName.includes('@') && senderName.length >= 2) {
      return senderName;
    }

    const domainMatch = externalMsg.from.email.match(/@([^.]+)\./);
    if (domainMatch && domainMatch[1]) {
      const domainRoot = domainMatch[1];
      if (!['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud'].includes(domainRoot.toLowerCase())) {
        return domainRoot.charAt(0).toUpperCase() + domainRoot.slice(1);
      }
    }
    return externalMsg.from.name || externalMsg.from.email;
  }

  // Sent by user with no external reply yet -> inspect To header
  if (firstMsg && firstMsg.to) {
    const rawTo = firstMsg.to.split(',')[0].trim();
    const angle = rawTo.match(/^(.*?)\s*<([^<>]+)>$/);
    const toName = angle ? angle[1].replace(/^["']|["']$/g, '').trim() : '';
    const toEmail = angle ? angle[2].trim() : rawTo;

    if (toName && !toName.includes('@')) return toName;
    const domainMatch = toEmail.match(/@([^.]+)\./);
    if (domainMatch && domainMatch[1]) {
      const root = domainMatch[1];
      if (!['gmail', 'yahoo', 'outlook', 'hotmail'].includes(root.toLowerCase())) {
        return root.charAt(0).toUpperCase() + root.slice(1);
      }
    }
    return toEmail;
  }

  return 'جهة توظيف';
}

function isThreadJobRelated(
  thread: EmailThreadDetail,
  userEmail: string
): boolean {
  if (!thread.messages || thread.messages.length === 0) return false;

  const firstMsg = thread.messages[0];
  const userInitiated = isMessageFromUser(firstMsg, userEmail);
  const anyUserSent = thread.messages.some((m) => isMessageFromUser(m, userEmail));

  const combinedSubject = thread.messages.map((m) => m.subject).join(' ');

  // Exclude automated job-alert digests if user never sent a message in this thread
  if (!anyUserSent) {
    if (JOB_DIGEST_EXCLUSION_PATTERNS.some((re) => re.test(combinedSubject))) {
      return false;
    }
  }

  const fullThreadText = thread.messages
    .map((m) => getMessagePlainContent(m))
    .join('\n');

  if (!anyUserSent && JOB_DIGEST_EXCLUSION_PATTERNS.some((re) => re.test(fullThreadText.slice(0, 600)))) {
    return false;
  }

  // Check if any participant is an ATS or HR email address
  const hasHrOrAtsParticipant = thread.messages.some(
    (m) => isAtsOrHrAddress(m.from.email) || isAtsOrHrAddress(m.to)
  );

  // Check if user sent a CV/Resume attachment or explicit job application email
  if (userInitiated) {
    const hasCvFile = thread.messages.some(
      (m) => isMessageFromUser(m, userEmail) && hasResumeOrPortfolioAttachment(m)
    );
    const userAppIntent =
      /\b(cv|resume|curriculum vitae|cover letter|portfolio|applying|application|position|vacancy|internship|developer|engineer|designer|analyst|specialist|manager|job|opportunity|hiring)\b/i.test(
        fullThreadText
      ) ||
      /(سيرة ذاتية|السيرة الذاتية|وظيفة|التقديم|طلب توظيف|تدريب|شاغر|فرصة عمل)/.test(
        fullThreadText
      );

    if (hasCvFile || (hasHrOrAtsParticipant && userAppIntent) || STRONG_EMPLOYMENT_CONTEXT.some((re) => re.test(fullThreadText))) {
      return true;
    }

    // Also allow if user explicitly wrote "applying for" / "attached my CV" / "السيرة الذاتية" to any corporate email
    if (
      /\b(attached (is )?(my )?(cv|resume)|please find attached my (cv|resume)|applying for|application for)\b/i.test(
        fullThreadText
      ) ||
      /(مرفق السيرة الذاتية|التقديم على وظيفة|أتقدم لوظيفة)/.test(fullThreadText)
    ) {
      return true;
    }

    return false;
  }

  // Inbound-initiated thread: guard against cloud/dev/billing notifications
  const hasStrongEmploymentSignal = STRONG_EMPLOYMENT_CONTEXT.some((re) =>
    re.test(fullThreadText)
  );
  const hasOfferOrRejectSignal =
    OFFER_PATTERNS.some((re) => re.test(fullThreadText)) ||
    REJECTION_PATTERNS.some((re) => re.test(fullThreadText));

  if (!hasHrOrAtsParticipant && !hasStrongEmploymentSignal && !hasOfferOrRejectSignal) {
    return false;
  }

  if (
    !hasHrOrAtsParticipant &&
    NON_JOB_NOISE_PATTERNS.some((re) => re.test(combinedSubject))
  ) {
    return false;
  }

  return hasStrongEmploymentSignal || (hasHrOrAtsParticipant && /\b(application|applied|candidate|interview|offer|position|role|cv|resume)\b|وظيفة|طلبك|مقابلة|عرض عمل/i.test(fullThreadText));
}

export function classifyJobThread(
  thread: EmailThreadDetail,
  userEmail: string,
  manualOverride?: JobApplicationStatus
): ClassifiedJobThread | null {
  if (!manualOverride && !isThreadJobRelated(thread, userEmail)) {
    return null;
  }

  const messages = thread.messages;
  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];

  const sentByUser = messages.some((m) => isMessageFromUser(m, userEmail));
  const externalMessages = messages.filter((m) => !isMessageFromUser(m, userEmail));

  let status: JobApplicationStatus = 'waiting';
  let subStage: JobApplicationSubStage =
    externalMessages.length === 0 ? 'sent_no_reply' : 'application_received';
  let statusLabel =
    externalMessages.length === 0 ? 'بعت ومستني رد' : 'تم الاستلام وبانتظار الرد';
  let reason =
    externalMessages.length === 0
      ? 'أرسلت رسالة التقديم ولم يصل أي رد من الشركة حتى الآن'
      : 'وصل تأكيد استلام الطلب فقط وبانتظار قرار جهة العمل';

  // Inspect external messages from newest to oldest so latest outcome wins
  for (let i = externalMessages.length - 1; i >= 0; i--) {
    const extMsg = externalMessages[i];
    const content = getMessagePlainContent(extMsg);

    // 1. Check Rejection first (rejections often also say "thank you for applying")
    if (REJECTION_PATTERNS.some((re) => re.test(content))) {
      status = 'rejected';
      subStage = 'rejected';
      statusLabel = 'مرفوض';
      reason = 'ورد رد بالاعتذار عن عدم استكمال إجراءات التوظيف';
      break;
    }

    // 2. Check Final Job Offer / Acceptance
    if (OFFER_PATTERNS.some((re) => re.test(content))) {
      status = 'accepted';
      subStage = 'offer';
      statusLabel = 'مقبول — عرض عمل';
      reason = 'تم استلام عرض عمل أو قبول في الوظيفة';
      break;
    }

    // 3. Check Interview / Assessment / Shortlist Invite
    const hasInterviewSignal = INTERVIEW_OR_NEXT_STEP_PATTERNS.some((re) =>
      re.test(content)
    );
    if (hasInterviewSignal) {
      const isPureReceiptBoilerplate =
        CONDITIONAL_RECEIPT_BOILERPLATE.some((re) => re.test(content)) &&
        AUTO_RECEIPT_PATTERNS.some((re) => re.test(extMsg.subject || ''));

      if (!isPureReceiptBoilerplate) {
        status = 'accepted';
        subStage = 'interview';
        statusLabel = 'مقبول للمقابلة / التقييم';
        reason = 'تم ترشيحك أو دعوتك لإجراء مقابلة عمل أو تقييم فني';
        break;
      }
    }
  }

  // Apply manual override if user explicitly reclassified this thread
  if (manualOverride) {
    status = manualOverride;
    if (manualOverride === 'accepted' && subStage !== 'offer' && subStage !== 'interview') {
      subStage = 'offer';
      statusLabel = 'مقبول (محدد يدوياً)';
      reason = 'تم تحديد حالة هذه المحادثة كمقبولة يدوياً';
    } else if (manualOverride === 'rejected') {
      subStage = 'rejected';
      statusLabel = 'مرفوض (محدد يدوياً)';
      reason = 'تم تحديد حالة هذه المحادثة كمرفوضة يدوياً';
    } else if (manualOverride === 'waiting') {
      subStage = externalMessages.length === 0 ? 'sent_no_reply' : 'application_received';
      statusLabel = 'بعت ومستني رد';
      reason = 'تم تحديد المحادثة كطلب قيد انتظار الرد';
    }
  }

  const appliedDate = firstMsg.internalDate || lastMsg.internalDate;
  const lastActivityDate = lastMsg.internalDate || appliedDate;
  const daysSinceApplied = Math.max(
    0,
    Math.floor((Date.now() - appliedDate) / (1000 * 60 * 60 * 24))
  );

  const hasAttachments = messages.some((m) => m.attachments.length > 0);
  const isUnread = messages.some((m) => m.isUnread);
  const companyName = extractCompanyName(thread, userEmail);
  const roleOrSubject = lastMsg.subject || firstMsg.subject || '(بدون موضوع)';

  return {
    threadId: thread.id,
    thread,
    companyName,
    roleOrSubject,
    status,
    subStage,
    statusLabel,
    reason,
    lastActivityDate,
    appliedDate,
    daysSinceApplied,
    messageCount: messages.length,
    sentByUser,
    hasAttachments,
    isUnread,
    isManualOverride: Boolean(manualOverride),
  };
}
