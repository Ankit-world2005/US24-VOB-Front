/**
 * Prints one element on its own.
 *
 * Printing the app page itself prints its layout too: the pages the hidden form
 * still takes up, the page background, and a modal's fixed, animated box, which
 * can leave the sheet off the printout entirely. Instead the element is copied
 * into a hidden frame that holds only it and the app's stylesheets, and that
 * frame is printed; the @media print rules then place it on a clean page.
 */

const FRAME_ATTR = 'data-print-frame';

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function printElement(element, title = document.title) {
  if (!element) return;
  // A frame from an earlier print whose afterprint never fired.
  document.querySelectorAll(`iframe[${FRAME_ATTR}]`).forEach((f) => f.remove());

  const frame = document.createElement('iframe');
  frame.setAttribute(FRAME_ATTR, '');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => node.outerHTML)
    .join('\n');
  const doc = frame.contentDocument;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<base href="${escapeHtml(document.baseURI)}">${styles}</head>` +
    `<body class="print-frame">${element.outerHTML}</body></html>`
  );
  doc.close();

  const stylesheetsLoaded = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
    link.sheet ? null : new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; })
  );
  Promise.all([...stylesheetsLoaded, doc.fonts?.ready]).then(() => {
    const win = frame.contentWindow;
    win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0));
    win.focus();
    win.print();
  });
}
