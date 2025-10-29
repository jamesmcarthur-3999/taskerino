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
import { useTheme } from '../context/ThemeContext';
import { EDITOR_STYLES, getGlassClasses } from '../design-system/theme';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
  minimal?: boolean; // Minimal toolbar for simple use cases
  maxHeight?: string; // Max height for the editor container (e.g., '400px', '50vh')
  onFocus?: () => void; // Called when editor receives focus
  onBlur?: () => void; // Called when editor loses focus
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
  onFocus,
  onBlur,
}: RichTextEditorProps) {
  const { colorScheme } = useTheme();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: EDITOR_STYLES.prose.bulletList,
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: EDITOR_STYLES.prose.orderedList,
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
            class: EDITOR_STYLES.prose.code,
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: EDITOR_STYLES.prose.codeBlock,
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: EDITOR_STYLES.prose.blockquote(colorScheme),
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
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
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
        <div className={EDITOR_STYLES.toolbar.container}>
          {!minimal && (
            <>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('bold') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
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
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('italic') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
                }`}
                title="Italic (Cmd+I)"
                aria-label="Toggle italic formatting"
                aria-pressed={editor.isActive('italic')}
              >
                <Italic className="w-4 h-4" />
              </button>

              <div className={EDITOR_STYLES.toolbar.divider} />

              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('bulletList') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
                }`}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('orderedList') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
                }`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <div className={EDITOR_STYLES.toolbar.divider} />

              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('code') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
                }`}
                title="Inline Code"
              >
                <Code className="w-4 h-4" />
              </button>

              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('blockquote') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
                }`}
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>

              <button
                onClick={setLink}
                className={`${EDITOR_STYLES.toolbar.button} ${
                  editor.isActive('link') ? EDITOR_STYLES.toolbar.buttonActive(colorScheme) : 'text-gray-600'
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
            className={`${EDITOR_STYLES.toolbar.button} text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed`}
            title="Undo (Cmd+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className={`${EDITOR_STYLES.toolbar.button} text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed`}
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
              ? `${getGlassClasses('subtle')} px-6 py-4 rounded-b-xl border-x border-b border-gray-200`
              : 'bg-transparent'
          }`}
        />
      </div>
    </div>
  );
}
