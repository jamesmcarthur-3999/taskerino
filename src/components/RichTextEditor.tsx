import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
} from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
  minimal?: boolean; // Minimal toolbar for simple use cases
  maxHeight?: string; // Max height for the editor container (e.g., '400px', '50vh')
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  onSubmit,
  autoFocus = false,
  editable = true,
  minimal = false,
  maxHeight,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-6 space-y-1',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-6 space-y-1',
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: 'mb-3',
          },
        },
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: 'font-bold mb-2',
          },
        },
        code: {
          HTMLAttributes: {
            class: 'bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono',
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-sm my-4',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-violet-500 pl-4 italic text-gray-700 my-4',
          },
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-violet-600 underline hover:text-violet-700',
        },
      }),
    ],
    content,
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[120px] text-gray-900 leading-relaxed',
      },
    },
  });

  // Update editor content when prop changes (for controlled component)
  useEffect(() => {
    if (editor && editor.view && content !== editor.getHTML()) {
      try {
        editor.commands.setContent(content);
      } catch (error) {
        console.warn('Failed to set editor content:', error);
      }
    }
  }, [content, editor]);

  // Handle Cmd+Enter to submit
  useEffect(() => {
    if (!editor || !editor.view || !onSubmit) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        console.log('CMD+Enter triggered in RichTextEditor');
        onSubmit();
      }
    };

    // Wait for editor to be fully initialized
    const checkAndAttach = () => {
      try {
        const editorElement = editor.view?.dom;
        if (editorElement) {
          editorElement.addEventListener('keydown', handleKeyDown, true); // Use capture phase
          return () => {
            editorElement.removeEventListener('keydown', handleKeyDown, true);
          };
        }
      } catch (error) {
        console.warn('Failed to attach keyboard handler:', error);
      }
      return undefined;
    };

    // Attach immediately if ready, otherwise wait a tick
    const cleanup = checkAndAttach();
    if (cleanup) return cleanup;

    const timeoutId = setTimeout(() => {
      const cleanup = checkAndAttach();
      if (cleanup) return cleanup;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [editor, onSubmit]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="w-full">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          {!minimal && (
            <>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('bold') ? 'bg-gray-200 text-violet-600' : 'text-gray-600'
                }`}
                title="Bold (Cmd+B)"
                aria-label="Toggle bold formatting"
                aria-pressed={editor.isActive('bold')}
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('italic') ? 'bg-gray-200 text-violet-600' : 'text-gray-600'
                }`}
                title="Italic (Cmd+I)"
                aria-label="Toggle italic formatting"
                aria-pressed={editor.isActive('italic')}
              >
                <Italic className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-gray-300 mx-1" />

              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('bulletList') ? 'bg-gray-200 text-violet-600' : 'text-gray-600'
                }`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('orderedList')
                    ? 'bg-gray-200 text-violet-600'
                    : 'text-gray-600'
                }`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-gray-300 mx-1" />

              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('code') ? 'bg-gray-200 text-violet-600' : 'text-gray-600'
                }`}
                title="Inline Code"
              >
                <Code className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('blockquote') ? 'bg-gray-200 text-violet-600' : 'text-gray-600'
                }`}
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>

              <button
                onClick={setLink}
                className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                  editor.isActive('link') ? 'bg-gray-200 text-violet-600' : 'text-gray-600'
                }`}
                title="Add Link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              <div className="flex-1" />
            </>
          )}

          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Cmd+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Editor */}
      <div
        className={`overflow-y-auto ${maxHeight ? '' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <EditorContent
          editor={editor}
          className={`${
            editable
              ? 'bg-white px-6 py-4 rounded-b-xl border-x border-b border-gray-200'
              : 'bg-transparent'
          }`}
        />
      </div>
    </div>
  );
}
