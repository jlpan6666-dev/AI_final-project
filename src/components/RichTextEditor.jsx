import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Heading2, Heading3,
  Link as LinkIcon, Link2Off, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Eraser
} from 'lucide-react';

// 工具列按鈕
function TBtn({ active, disabled, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
}

const TBar = ({ children }) => <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">{children}</div>;
const Sep = () => <span className="w-px h-5 bg-slate-300 mx-1" />;

export default function RichTextEditor({ value, onChange, placeholder = '輸入內容...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-indigo-600 underline', target: '_blank', rel: 'noopener noreferrer' } }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'max-w-full rounded-md my-2' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[180px] px-4 py-3 leading-relaxed',
      },
    },
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML()),
  });

  // 外部 value 變動時同步（例如打開編輯器時載入既有內容）
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('輸入連結網址（留空可移除）', prev);
    if (url === null) return;
    if (url === '') return editor.chain().focus().extendMarkRange('link').unsetLink().run();
    let href = url.trim();
    if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const addImage = () => {
    const url = window.prompt('輸入圖片網址');
    if (url) editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 transition-all">
      <TBar>
        <TBtn title="復原" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo size={15} /></TBtn>
        <TBtn title="重做" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo size={15} /></TBtn>
        <Sep />
        <TBtn title="粗體" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></TBtn>
        <TBtn title="斜體" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></TBtn>
        <TBtn title="底線" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></TBtn>
        <TBtn title="刪除線" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></TBtn>
        <Sep />
        <TBtn title="標題 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></TBtn>
        <TBtn title="標題 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></TBtn>
        <Sep />
        <TBtn title="項目符號" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></TBtn>
        <TBtn title="編號清單" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></TBtn>
        <TBtn title="引言" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></TBtn>
        <TBtn title="程式碼" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code size={15} /></TBtn>
        <Sep />
        <TBtn title="靠左" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={15} /></TBtn>
        <TBtn title="置中" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={15} /></TBtn>
        <TBtn title="靠右" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={15} /></TBtn>
        <Sep />
        <TBtn title="插入連結" active={editor.isActive('link')} onClick={addLink}><LinkIcon size={15} /></TBtn>
        <TBtn title="移除連結" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off size={15} /></TBtn>
        <TBtn title="插入圖片網址" onClick={addImage}><ImageIcon size={15} /></TBtn>
        <Sep />
        <TBtn title="清除格式" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser size={15} /></TBtn>
      </TBar>

      <EditorContent editor={editor} placeholder={placeholder} />

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror { min-height: 180px; }
        .ProseMirror:focus { outline: none; }
        .ProseMirror h2 { font-size: 1.25rem; font-weight: 700; margin: 0.8em 0 0.4em; color: #1e293b; }
        .ProseMirror h3 { font-size: 1.1rem; font-weight: 700; margin: 0.6em 0 0.3em; color: #1e293b; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .ProseMirror blockquote { border-left: 3px solid #c7d2fe; padding-left: 0.8em; color: #475569; margin: 0.5em 0; }
        .ProseMirror code { background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
        .ProseMirror pre { background: #1e293b; color: #f1f5f9; padding: 0.8em 1em; border-radius: 8px; overflow-x: auto; }
        .ProseMirror pre code { background: transparent; padding: 0; color: inherit; }
        .ProseMirror p { margin: 0.4em 0; }
      `}</style>
    </div>
  );
}
