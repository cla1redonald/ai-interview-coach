'use client';

import { useRef, useEffect, useState } from 'react';

interface MaterialsEditorProps {
  content: string;
  onSave: (content: string) => void;
  saving?: boolean;
}

export function MaterialsEditor({ content, onSave, saving = false }: MaterialsEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [savedCaption, setSavedCaption] = useState(false);

  // Set innerHTML once on mount — never again (user edits are authoritative after that)
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = content
        .split('\n')
        .map((line) => `<div>${line === '' ? '<br>' : line}</div>`)
        .join('');
    }
    // Intentionally omit `content` from deps — only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show "Saved automatically" caption after save completes
  useEffect(() => {
    if (!saving) return;
    // saving just toggled to true; show caption when it goes back to false
  }, [saving]);

  function handleBlur() {
    if (!ref.current) return;
    const text = ref.current.innerText ?? '';
    onSave(text);
    // Show saved caption briefly
    setSavedCaption(true);
    const t = setTimeout(() => setSavedCaption(false), 3000);
    return () => clearTimeout(t);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    // Insert plain text at cursor position
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const lines = text.split('\n');
    if (lines.length === 1) {
      range.insertNode(document.createTextNode(text));
    } else {
      const frag = document.createDocumentFragment();
      lines.forEach((line, i) => {
        if (i > 0) frag.appendChild(document.createElement('br'));
        frag.appendChild(document.createTextNode(line));
      });
      range.insertNode(frag);
    }
    // Collapse selection to end
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  return (
    <div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Material content editor"
        suppressContentEditableWarning
        onBlur={handleBlur}
        onPaste={handlePaste}
        style={{
          minHeight: '300px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px',
          color: 'var(--mist)',
          fontSize: '0.875rem',
          lineHeight: '1.6',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber)';
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
        }}
      />
      <div style={{ minHeight: '20px', marginTop: '6px' }}>
        {(saving || savedCaption) && (
          <p
            className="text-xs"
            style={{
              color: 'var(--sage)',
              opacity: savedCaption && !saving ? 1 : 0.7,
              transition: 'opacity 300ms ease',
            }}
          >
            {saving ? 'Saving...' : 'Saved automatically'}
          </p>
        )}
      </div>
    </div>
  );
}
