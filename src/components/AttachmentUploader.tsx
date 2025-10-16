import { useState, useRef, useCallback, useEffect } from 'react';
import { Link as LinkIcon, File, X, Paperclip, Camera } from 'lucide-react';
import type { Attachment } from '../types';
import { generateId } from '../utils/helpers';

interface AttachmentUploaderProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
}

export function AttachmentUploader({
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  acceptedTypes = ['image/*', 'application/pdf', '.txt', '.md', '.doc', '.docx']
}: AttachmentUploaderProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file limit
      if (attachments.length + newAttachments.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        break;
      }

      // Read file as base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;

        const attachment: Attachment = {
          id: generateId(),
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          mimeType: file.type,
          size: file.size,
          createdAt: new Date().toISOString(),
          base64,
        };

        // Generate thumbnail for images
        if (file.type.startsWith('image/')) {
          attachment.thumbnail = base64;
        }

        newAttachments.push(attachment);

        if (newAttachments.length === Math.min(files.length, maxFiles - attachments.length)) {
          onAttachmentsChange([...attachments, ...newAttachments]);
        }
      };

      reader.readAsDataURL(file);
    }
  }, [attachments, maxFiles, onAttachmentsChange]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;

            const attachment: Attachment = {
              id: generateId(),
              type: 'screenshot',
              name: `Screenshot ${new Date().toLocaleTimeString()}.png`,
              mimeType: 'image/png',
              size: file.size,
              createdAt: new Date().toISOString(),
              base64,
              thumbnail: base64,
            };

            onAttachmentsChange([...attachments, attachment]);
          };

          reader.readAsDataURL(file);
        }
      }
    }
  }, [attachments, onAttachmentsChange]);

  const handleAddLink = () => {
    if (!linkUrl.trim()) return;

    try {
      new URL(linkUrl); // Validate URL

      const attachment: Attachment = {
        id: generateId(),
        type: 'link',
        name: linkUrl,
        mimeType: 'text/uri-list',
        size: 0,
        createdAt: new Date().toISOString(),
        url: linkUrl,
      };

      onAttachmentsChange([...attachments, attachment]);
      setLinkUrl('');
      setShowLinkInput(false);
    } catch {
      alert('Please enter a valid URL');
    }
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Add paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-4 transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-center gap-4">
          {/* File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg
                     transition-colors text-sm font-medium text-gray-700"
          >
            <Paperclip className="w-4 h-4" />
            Attach File
          </button>

          {/* Link Button */}
          <button
            type="button"
            onClick={() => setShowLinkInput(!showLinkInput)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg
                     transition-colors text-sm font-medium text-gray-700"
          >
            <LinkIcon className="w-4 h-4" />
            Add Link
          </button>

          {/* Screenshot Hint */}
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Camera className="w-3 h-3" />
            Paste screenshots (⌘V)
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-2">
          Or drag and drop files here
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Link Input */}
      {showLinkInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddLink()}
            placeholder="https://example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                     focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAddLink}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                     transition-colors text-sm font-medium"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkUrl('');
            }}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg
                     transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
            >
              {/* Icon/Thumbnail */}
              <div className="flex-shrink-0">
                {attachment.type === 'image' || attachment.type === 'screenshot' ? (
                  <div className="w-12 h-12 rounded overflow-hidden bg-gray-200">
                    <img
                      src={attachment.thumbnail || attachment.base64}
                      alt={attachment.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : attachment.type === 'link' ? (
                  <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                    <LinkIcon className="w-6 h-6 text-blue-600" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                    <File className="w-6 h-6 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {attachment.name}
                </p>
                <p className="text-xs text-gray-500">
                  {attachment.type === 'link'
                    ? 'Link'
                    : `${attachment.mimeType.split('/')[1].toUpperCase()} · ${formatFileSize(attachment.size)}`}
                </p>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50
                         rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Counter */}
      {attachments.length > 0 && (
        <p className="text-xs text-gray-500 text-right">
          {attachments.length} / {maxFiles} attachments
        </p>
      )}
    </div>
  );
}
