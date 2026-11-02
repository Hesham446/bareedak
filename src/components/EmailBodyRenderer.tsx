import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

interface EmailBodyRendererProps {
  htmlBody: string | null;
  textBody: string | null;
  snippet: string;
}

export const EmailBodyRenderer: React.FC<EmailBodyRendererProps> = ({
  htmlBody,
  textBody,
  snippet,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(360);

  const sanitizedSrcDoc = useMemo(() => {
    if (!htmlBody) return null;

    const cleanHtml = DOMPurify.sanitize(htmlBody, {
      WHOLE_DOCUMENT: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'base'],
      FORBID_ATTR: [
        'onerror',
        'onload',
        'onclick',
        'onmouseover',
        'onfocus',
        'onmouseenter',
        'onmouseleave',
      ],
      ADD_TAGS: ['style'],
      ADD_ATTR: ['target', 'dir', 'align', 'valign', 'bgcolor', 'cellpadding', 'cellspacing', 'width', 'height'],
    });

    return `<!doctype html>
<html dir="auto">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none';" />
    <base target="_blank" rel="noopener noreferrer" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: 'IBM Plex Sans Arabic', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 15px;
        line-height: 1.65;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
      body {
        padding: 14px 16px 18px 16px;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      a {
        color: #0a6cf0;
      }
      pre {
        white-space: pre-wrap;
        overflow-x: auto;
      }
      blockquote {
        margin: 12px 0;
        padding: 0 12px;
        border-inline-start: 2px solid #cbd5e1;
        color: #475569;
      }
      table {
        max-width: 100%;
      }
    </style>
  </head>
  <body dir="auto">${cleanHtml}</body>
</html>`;
  }, [htmlBody]);

  const measureIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body || !doc.documentElement) return;
      const bodyHeight = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        160
      );
      setIframeHeight(bodyHeight + 16);
    } catch {
      // Fallback height if measurement fails
      setIframeHeight(520);
    }
  }, []);

  useEffect(() => {
    if (!sanitizedSrcDoc) return;
    const t1 = window.setTimeout(measureIframeHeight, 120);
    const t2 = window.setTimeout(measureIframeHeight, 500);
    const t3 = window.setTimeout(measureIframeHeight, 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [sanitizedSrcDoc, measureIframeHeight]);

  if (sanitizedSrcDoc) {
    return (
      <iframe
        ref={iframeRef}
        title="محتوى البريد الإلكتروني"
        srcDoc={sanitizedSrcDoc}
        onLoad={measureIframeHeight}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        height={iframeHeight}
        className="w-full border-0 bg-white block lg-mail-frame"
      />
    );
  }

  const fallbackText = textBody || snippet || 'لا يوجد نص لعرضه في هذه الرسالة.';

  return (
    <div
      dir="auto"
      className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 break-words py-2 px-1"
    >
      {fallbackText}
    </div>
  );
};
