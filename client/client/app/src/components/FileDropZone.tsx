import React, { useRef, useState } from 'react';

export type FileDropZoneProps = {
  accept: string;
  hint: string;
  /** Shown above the hint when empty. */
  emptyLabel?: string;
  selectedName?: string | null;
  maxSizeMb?: number;
  testId?: string;
  onFile: (file: File) => void;
  onInvalid?: (message: string) => void;
  /** Optional extra check beyond the accept attribute / extension. */
  isAllowed?: (file: File) => boolean;
};

const extensionOf = (name: string): string => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
};

const matchesAccept = (file: File, accept: string): boolean => {
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const ext = extensionOf(file.name);
  const mime = (file.type || '').toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return ext === token;
    if (token.endsWith('/*')) return mime.startsWith(token.replace('/*', '/'));
    return mime === token;
  });
};

/**
 * Click-or-drag file picker, patterned after the legacy-client resume drop zone.
 */
export const FileDropZone: React.FC<FileDropZoneProps> = ({
  accept,
  hint,
  emptyLabel = 'Drop a file here, or choose a file',
  selectedName,
  maxSizeMb = 10,
  testId,
  onFile,
  onInvalid,
  isAllowed,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const applyFile = (file: File | undefined) => {
    if (!file) return;
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      onInvalid?.(`File is too large. Maximum size is ${maxSizeMb} MB.`);
      return;
    }
    if (!matchesAccept(file, accept) || (isAllowed && !isAllowed(file))) {
      onInvalid?.(
        'Unsupported file type. Use PDF, DOCX, or TXT (images are not supported for this step).',
      );
      return;
    }
    onFile(file);
  };

  return (
    <div
      className="input"
      role="button"
      tabIndex={0}
      data-testid={testId}
      aria-label={emptyLabel}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        applyFile(event.dataTransfer.files?.[0]);
      }}
      style={{
        minHeight: 88,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        color: '#64748b',
        cursor: 'pointer',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: dragging ? 'var(--green, #1f9d6a)' : undefined,
        background: dragging ? 'rgba(31, 157, 106, 0.06)' : undefined,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          applyFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div>
        <b>{selectedName ? selectedName : emptyLabel}</b>
        <br />
        <small>{selectedName ? 'Click or drop to replace · ' : ''}{hint}</small>
      </div>
    </div>
  );
};
