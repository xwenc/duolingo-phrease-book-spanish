import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, BookOpen, ChevronRight, Download, MessageSquare, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { api, type CatalogBook, type CatalogChapter } from '../services/api';

type AdminBook = CatalogBook;
type AdminChapter = CatalogChapter;
interface AdminSentence { imageUrl?: string; id: string; chapterId: string; name: string; spanish: string; chinese: string; phonetics: string; grammarTip: string; vocabHints: { es: string; chinese: string }[] }
type Level = 'book' | 'chapter' | 'sentence';
interface Draft {
  id?: string;
  name: string;
  description: string;
  thumbnail: string;
  imageUrl: string;
  icon: string;
  spanish: string;
  chinese: string;
  phonetics: string;
  grammarTip: string;
  vocabHints: { es: string; chinese: string }[];
}
const blank = (): Draft => ({ name: '', description: '', thumbnail: '', imageUrl: '', icon: '📖', spanish: '', chinese: '', phonetics: '', grammarTip: '', vocabHints: [] });
const labels: Record<Level, string> = { book: '书籍', chapter: '章节', sentence: '句子' };
const emojis = ['📖', '👋', '🍽️', '✈️', '🛍️', '🏨', '🚆', '💬', '🏠', '🌍', '🎓', '❤️', '☀️', '🎯', '🎵', '💼'];
const inputClass = 'mt-2 block w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 focus:border-[#1cb0f6] focus:outline-none';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-b-4 border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50';

export function AdminDashboard({ onExit }: { onExit: (changed: boolean) => Promise<void> }) {
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [sentences, setSentences] = useState<AdminSentence[]>([]);
  const [bookId, setBookId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exportingId, setExportingId] = useState('');
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const sentenceImportRef = useRef<HTMLInputElement>(null);
  const busy = saving || uploading || Boolean(exportingId) || importing;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const changed = useRef(false);
  const editorRef = useRef<HTMLElement>(null);
  const book = books.find(item => item.id === bookId);
  const chapter = chapters.find(item => item.id === chapterId);
  const level: Level = chapterId ? 'sentence' : bookId ? 'chapter' : 'book';
  const items = level === 'book' ? books : level === 'chapter' ? chapters : sentences;

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([
      api<AdminBook[]>('/admin/books'),
      bookId ? api<AdminChapter[]>(`/admin/books/${bookId}/chapters`) : Promise.resolve([]),
      chapterId ? api<AdminSentence[]>(`/admin/chapters/${chapterId}/sentences`) : Promise.resolve([]),
    ]).then(([nextBooks, nextChapters, nextSentences]) => {
      if (active) { setBooks(nextBooks); setChapters(nextChapters); setSentences(nextSentences); }
    }).catch(err => { if (active) setError((err as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookId, chapterId, revision]);

  const discard = () => !draft || window.confirm('放弃当前未保存的表单？');
  const navigate = (nextBookId: string, nextChapterId = '') => {
    if (busy || !discard()) return;
    setBookId(nextBookId); setChapterId(nextChapterId); setDraft(null); setNotice('');
  };
  const edit = (item?: AdminBook | AdminChapter | AdminSentence) => {
    if (!discard()) return;
    setDraft({ ...blank(), ...item, ...('vocabHints' in (item || {}) ? { vocabHints: (item as AdminSentence).vocabHints.map(hint => ({ ...hint })) } : {}) });
    setNotice('');
    requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.scrollTop = 0;
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      editorRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    });
  };
  const patch = (value: Partial<Draft>) => setDraft(previous => previous ? { ...previous, ...value } : previous);
  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>, target: 'book' | 'sentence') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || !draft) return;
    setError(''); setNotice('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG、PNG 和 WebP 图片'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('图片不能超过 5 MB'); return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api<{ url: string }>(target === 'book' ? '/admin/covers' : '/admin/sentence-images', { method: 'POST', body });
      patch(target === 'book' ? { thumbnail: result.url } : { imageUrl: result.url });
      setNotice(target === 'book' ? '封面已上传，保存书籍后生效' : '句子图片已上传，保存句子后生效');
    } catch (err) { setError((err as Error).message); }
    finally { setUploading(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || busy) return;
    setSaving(true); setError(''); setNotice('');
    const body = level === 'book' ? { name: draft.name, description: draft.description, thumbnail: draft.thumbnail }
      : level === 'chapter' ? { name: draft.name, description: draft.description, icon: draft.icon }
      : { name: draft.name, imageUrl: draft.imageUrl, spanish: draft.spanish, chinese: draft.chinese, phonetics: draft.phonetics, grammarTip: draft.grammarTip, vocabHints: draft.vocabHints };
    const path = draft.id ? `/admin/${level === 'book' ? 'books' : level === 'chapter' ? 'chapters' : 'sentences'}/${draft.id}`
      : level === 'book' ? '/admin/books' : level === 'chapter' ? `/admin/books/${bookId}/chapters` : `/admin/chapters/${chapterId}/sentences`;
    try {
      await api(path, { method: draft.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      changed.current = true; setDraft(null); setRevision(value => value + 1); setNotice(`${labels[level]}已保存`);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  const remove = async (item: AdminBook | AdminChapter | AdminSentence) => {
    const detail = level === 'sentence' ? '同时删除关联的收藏和答题记录。' : '仅可删除内容为空的书籍或章节。';
    if (busy || !window.confirm(`删除“${item.name}”？${detail}`)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api(`/admin/${level === 'book' ? 'books' : level === 'chapter' ? 'chapters' : 'sentences'}/${item.id}`, { method: 'DELETE' });
      changed.current = true;
      if (draft?.id === item.id) setDraft(null);
      setRevision(value => value + 1); setNotice(`${labels[level]}已删除`);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  const importBook = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || !discard()) return;
    setError(''); setNotice('');
    if (file.size > 5 * 1024 * 1024) { setError('书籍 JSON 文件不能超过 5 MB'); return; }
    setImporting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api<{ book: AdminBook; chapterCount: number; sentenceCount: number }>('/admin/books/import', { method: 'POST', body });
      changed.current = true;
      setDraft(null); setBookId(''); setChapterId('');
      setRevision(value => value + 1);
      setNotice(`已导入“${result.book.name}”：${result.chapterCount} 个章节、${result.sentenceCount} 个句子，封面可另行设置`);
    } catch (err) { setError((err as Error).message); }
    finally { setImporting(false); }
  };
  const importSentences = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || !chapterId || !discard()) return;
    setError(''); setNotice('');
    if (file.size > 5 * 1024 * 1024) { setError('句子 JSON 文件不能超过 5 MB'); return; }
    setImporting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const result = await api<{ chapterId: string; sentenceCount: number }>(`/admin/chapters/${chapterId}/sentences/import`, { method: 'POST', body });
      changed.current = true; setDraft(null);
      setRevision(value => value + 1);
      setNotice(`已为当前章节添加 ${result.sentenceCount} 个句子`);
    } catch (err) { setError((err as Error).message); }
    finally { setImporting(false); }
  };
  const moveItem = async (id: string, direction: -1 | 1) => {
    if (busy || loading) return;
    const isChapter = level === 'chapter';
    const list = isChapter ? chapters : sentences;
    const index = list.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSaving(true); setError(''); setNotice('');
    try {
      const ids = reordered.map(item => item.id);
      const path = isChapter ? `/admin/books/${bookId}/chapters/order` : `/admin/chapters/${chapterId}/sentences/order`;
      await api(path, { method: 'PUT', body: JSON.stringify(isChapter ? { chapterIds: ids } : { sentenceIds: ids }) });
      if (isChapter) setChapters(reordered as AdminChapter[]);
      else setSentences(reordered as AdminSentence[]);
      changed.current = true;
      setNotice(`${isChapter ? '章节' : '句子'}顺序已保存，练习和导出将使用此顺序`);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  const exportBook = async (item: AdminBook) => {
    if (busy) return;
    setExportingId(item.id); setError(''); setNotice('');
    try {
      const data = await api<unknown>(`/admin/books/${item.id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${item.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 100) || 'book'}.json`;
      document.body.appendChild(link);
      link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('已生成书籍 JSON 下载文件，包含章节、句子和生词，不含图片');
    } catch (err) { setError((err as Error).message); }
    finally { setExportingId(''); }
  };
  const exit = async () => {
    if (!discard()) return;
    setSaving(true); setError('');
    try { await onExit(changed.current); }
    catch (err) { setError((err as Error).message); setSaving(false); }
  };

  return <main className="w-full max-w-6xl mx-auto px-4 sm:px-7 py-7 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div><p className="text-xs font-black tracking-widest text-[#58a700] mb-2">HABLA ESPAÑOL · ADMIN</p><h1 className="text-3xl font-black text-slate-700">教材管理后台</h1><p className="mt-2 text-sm text-slate-500">编排书籍与章节，让每一句练习都有归属。</p></div>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className={buttonClass} onClick={() => importInputRef.current?.click()}><Upload size={16} />{importing ? '正在导入…' : '一键导入'}</button><input ref={importInputRef} type="file" accept=".json,application/json" aria-label="导入书籍 JSON" className="hidden" disabled={busy} onChange={event => void importBook(event)} /><button type="button" disabled={busy} className={buttonClass} onClick={() => void exit()}><ArrowLeft size={16} />返回教材馆</button></div>
    </div>
    <nav aria-label="后台层级导航" className="mb-7 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold">
      <button disabled={busy} type="button" aria-current={!bookId ? 'page' : undefined} className="flex items-center gap-2 text-[#1899d6] hover:underline" onClick={() => navigate('')}><BookOpen size={17} />书籍库</button>
      {bookId && <><ChevronRight size={14} className="shrink-0 text-slate-300" /><button disabled={busy} type="button" aria-current={!chapterId ? 'page' : undefined} className="max-w-full break-words text-[#1899d6] hover:underline" onClick={() => navigate(bookId)}>{book?.name || '书籍'}</button></>}
      {chapterId && <><ChevronRight size={14} className="shrink-0 text-slate-300" /><button disabled={busy} type="button" aria-current="page" className="break-words text-[#1899d6] hover:underline" onClick={() => navigate(bookId, chapterId)}>{chapter?.icon} {chapter?.name || '章节'}</button></>}
    </nav>
    {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}<button type="button" className="ml-3 underline" disabled={busy} onClick={() => setRevision(value => value + 1)}>重新加载列表</button></div>}
    {notice && <p role="status" className="mb-5 rounded-xl bg-green-50 p-3 text-green-700 text-sm">{notice}</p>}
    <div className={`grid gap-6 items-start ${draft ? 'lg:grid-cols-[1fr_420px]' : ''}`}>
      <section aria-label={`${labels[level]}列表`}>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5"><div><h2 className="text-xl font-black text-slate-700">{level === 'book' ? '所有书籍' : level === 'chapter' ? '章节目录' : '练习句子'} <span className="ml-2 text-sm font-bold text-slate-400">{items.length}</span></h2>{bookId && <p className="text-sm text-slate-500 mt-1 break-words">{chapterId ? chapter?.description : book?.description}</p>}</div><div className="flex flex-wrap gap-2">{level === 'sentence' && <><button type="button" disabled={busy || loading} className={buttonClass} onClick={() => sentenceImportRef.current?.click()}><Upload size={16} />{importing ? '正在导入…' : '批量导入句子'}</button><input ref={sentenceImportRef} type="file" accept=".json,application/json" aria-label="上传句子对象数组 JSON" className="hidden" disabled={busy} onChange={event => void importSentences(event)} /></>}<button type="button" disabled={busy || loading} className="duo-btn-green shrink-0 flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-black disabled:opacity-50" onClick={() => edit()}><Plus size={17} />新增{labels[level]}</button></div></div>
        {level === 'chapter' && <p className="text-xs text-slate-400 mb-4">使用上移 / 下移调整章节顺序，自动保存；单元选择、综合练习和导出同步更新。</p>}
        {level === 'sentence' && <p className="text-xs text-slate-400 mb-4">使用上移 / 下移调整顺序，自动保存。批量导入按数组顺序追加到末尾；最大 5 MB，最多 10000 个句子。</p>}
        {loading ? <p role="status" className="p-10 text-center text-slate-400">正在加载{labels[level]}…</p> : !items.length ? <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center"><BookOpen className="mx-auto text-[#1cb0f6] mb-4" size={40} /><h3 className="font-black text-lg">还没有{labels[level]}</h3><p className="text-sm text-slate-400 mt-2">点击“新增{labels[level]}”，添加第一条内容。</p></div> : <div className={`grid gap-4 ${level === 'book' && !draft ? 'sm:grid-cols-2 xl:grid-cols-3' : ''}`}>
          {items.map((item, index) => <article key={item.id} className="rounded-2xl border-2 border-b-4 border-slate-200 bg-white overflow-hidden">
            {level === 'book' && 'thumbnail' in item && item.thumbnail && <img src={item.thumbnail} alt={`${item.name}封面`} className="h-36 w-full object-cover bg-slate-100" />}
            <div className="p-5"><div className="flex gap-3 items-start"><div className="shrink-0 flex items-center justify-center rounded-xl bg-sky-50 text-[#1cb0f6] w-11 h-11">{'icon' in item ? <span className="text-2xl">{item.icon}</span> : level === 'sentence' ? <MessageSquare size={23} /> : <BookOpen size={23} />}</div><div className="min-w-0 flex-1"><h3 className="font-black text-slate-700 break-words">{level !== 'book' && <span className="mr-2 text-slate-400 tabular-nums">{index + 1}.</span>}{item.name}</h3>{'spanish' in item ? <>{item.imageUrl && <img src={item.imageUrl} alt={`${item.name}配图`} className="mt-3 max-h-32 rounded-lg object-contain" />}<p lang="es" className="mt-2 text-sm text-[#1899d6] break-words">{item.spanish}</p><p className="text-sm text-slate-500 mt-1 break-words">{item.chinese}</p><p className="text-xs text-slate-400 mt-2">{item.vocabHints.length} 个生词</p></> : <><p className="mt-1 text-sm text-slate-500 line-clamp-2 break-words">{item.description || '暂无描述'}</p><p className="mt-2 text-xs font-bold text-slate-400">{'chapterCount' in item ? `${item.chapterCount} 个章节` : `${item.sentenceCount} 个句子`}</p></>}</div></div>
              <div className="flex flex-wrap justify-between gap-2 mt-5 pt-4 border-t border-slate-100"><div className="flex flex-wrap gap-2">{level !== 'book' && <><button type="button" disabled={busy || loading || index === 0} aria-label={`上移${item.name}`} title="上移" className={buttonClass} onClick={() => void moveItem(item.id, -1)}><ArrowUp size={14} />上移</button><button type="button" disabled={busy || loading || index === items.length - 1} aria-label={`下移${item.name}`} title="下移" className={buttonClass} onClick={() => void moveItem(item.id, 1)}><ArrowDown size={14} />下移</button></>}{level === 'book' && <button type="button" disabled={busy} aria-label={`导出${item.name}`} className={buttonClass} onClick={() => void exportBook(item as AdminBook)}><Download size={14} />{exportingId === item.id ? '导出中…' : '一键导出'}</button>}<button type="button" disabled={busy} aria-label={`编辑${item.name}`} className={buttonClass} onClick={() => edit(item)}><Pencil size={14} />编辑</button><button type="button" disabled={busy} aria-label={`删除${item.name}`} className={`${buttonClass} text-red-400`} onClick={() => void remove(item)}><Trash2 size={14} /></button></div>{level !== 'sentence' && <button type="button" disabled={busy} className="flex items-center gap-1 text-sm font-black text-[#1899d6] hover:underline" onClick={() => level === 'book' ? navigate(item.id) : navigate(bookId, item.id)}>{level === 'book' ? '管理章节' : '管理句子'}<ChevronRight size={16} /></button>}</div>
            </div>
          </article>)}
        </div>}
      </section>
      {draft && <section ref={editorRef} aria-label={`${labels[level]}编辑表单`} className="rounded-2xl border-2 border-[#b9e6fa] bg-white p-5 sm:p-6 scroll-mt-5 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)] lg:overflow-y-auto lg:overscroll-contain">
        <div className="flex items-center justify-between gap-3 mb-5"><h2 className="text-lg font-black text-slate-700">{draft.id ? '编辑' : '新增'}{labels[level]}</h2><button type="button" aria-label="关闭表单" disabled={busy} className="p-1 text-slate-400" onClick={() => { if (discard()) setDraft(null); }}><X size={20} /></button></div>
        <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm font-bold">名称 <span className="text-red-400">*</span><input required maxLength={200} value={draft.name} onChange={e => patch({ name: e.target.value })} className={inputClass} placeholder={level === 'sentence' ? '例如：初次见面的问候' : `输入${labels[level]}名称`} /></label>
          {level !== 'sentence' && <label className="block text-sm font-bold">描述<textarea rows={3} maxLength={5000} value={draft.description} onChange={e => patch({ description: e.target.value })} className={inputClass} placeholder={`介绍这${level === 'book' ? '本书' : '一章'}的学习内容`} /></label>}
          {level === 'book' && <><label className="block text-sm font-bold">封面图片地址<input maxLength={2048} value={draft.thumbnail} onChange={e => patch({ thumbnail: e.target.value })} className={inputClass} placeholder="https://example.com/cover.jpg" /><span className="block text-xs font-normal text-slate-400 mt-2">支持输入图片地址，或从本地上传 JPG、PNG、WebP（最大 5 MB）。</span></label><label className={`${buttonClass} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload size={16} />{uploading ? '正在上传…' : '上传本地封面'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传本地封面" className="sr-only" onChange={event => void uploadImage(event, 'book')} /></label>{uploading && <p role="status" className="text-xs text-sky-600">正在上传封面，请稍候…</p>}{draft.thumbnail && /^(https?:\/\/|\/(?!\/))/.test(draft.thumbnail) && <img src={draft.thumbnail} alt="封面预览" className="max-h-40 rounded-xl object-cover" />}</>}
          {level === 'chapter' && <div><label className="block text-sm font-bold">章节图标<input required maxLength={32} value={draft.icon} onChange={e => patch({ icon: e.target.value })} className={inputClass} /></label><div aria-label="快速选择 Emoji" className="grid grid-cols-8 gap-1 mt-3 rounded-xl bg-slate-50 p-2">{emojis.map(emoji => <button type="button" key={emoji} aria-label={`选择图标 ${emoji}`} aria-pressed={draft.icon === emoji} className={`rounded-lg p-1 text-xl hover:bg-sky-100 ${draft.icon === emoji ? 'bg-sky-100 ring-2 ring-[#1cb0f6]' : ''}`} onClick={() => patch({ icon: emoji })}>{emoji}</button>)}</div></div>}
          {level === 'sentence' && <>
            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div><h3 className="text-sm font-bold">句子图片 <span className="font-normal text-slate-400">（可选）</span></h3><p className="mt-1 text-xs text-slate-400">上传 JPG、PNG 或 WebP，最大 5 MB；有图片时会在练习页面显示。</p></div>
              <label className={`${buttonClass} cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload size={16} />{uploading ? '正在上传…' : draft.imageUrl ? '更换图片' : '上传句子图片'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传句子图片" className="sr-only" onChange={event => void uploadImage(event, 'sentence')} /></label>
              {uploading && <p role="status" className="text-xs text-sky-600">正在上传图片，请稍候…</p>}
              {draft.imageUrl && <><img src={draft.imageUrl} alt="句子图片预览" className="max-h-48 w-full rounded-xl object-contain bg-slate-50" /><button type="button" className="text-xs text-red-500 underline" onClick={() => patch({ imageUrl: '' })}>移除图片</button></>}
            </div>
            <label className="block text-sm font-bold">西班牙语 <span className="text-red-400">*</span><textarea lang="es" required maxLength={500} rows={2} value={draft.spanish} onChange={e => patch({ spanish: e.target.value })} className={inputClass} placeholder="¡Hola! Mucho gusto." /></label>
            <label className="block text-sm font-bold">中文释义 <span className="text-red-400">*</span><textarea required maxLength={2000} rows={2} value={draft.chinese} onChange={e => patch({ chinese: e.target.value })} className={inputClass} /></label>
            <label className="block text-sm font-bold">拼读 / 音标<input maxLength={2000} value={draft.phonetics} onChange={e => patch({ phonetics: e.target.value })} className={inputClass} placeholder="o-la! mu-cho gus-to" /></label>
            <label className="block text-sm font-bold">语法提示<textarea maxLength={5000} rows={3} value={draft.grammarTip} onChange={e => patch({ grammarTip: e.target.value })} className={inputClass} /></label>
            <div className="border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-black">生词卡片 <span className="text-slate-400">{draft.vocabHints.length}</span></h3><button type="button" disabled={draft.vocabHints.length >= 100} className="flex items-center gap-1 text-xs font-black text-[#1899d6] disabled:opacity-50" onClick={() => patch({ vocabHints: [...draft.vocabHints, { es: '', chinese: '' }] })}><Plus size={15} />添加词汇</button></div>
              {!draft.vocabHints.length && <p className="mt-3 text-xs text-slate-400">暂无生词，可添加多组西语词汇与中文解释。</p>}
              <div className="space-y-3 mt-3">{draft.vocabHints.map((hint, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400">词汇 {index + 1}</span><button type="button" aria-label={`删除词汇 ${index + 1}`} className="text-slate-400 hover:text-red-500" onClick={() => patch({ vocabHints: draft.vocabHints.filter((_, position) => position !== index) })}><X size={15} /></button></div><label className="block mt-2 text-xs font-bold">西语词汇<input lang="es" required maxLength={200} value={hint.es} className={inputClass} onChange={e => patch({ vocabHints: draft.vocabHints.map((value, position) => position === index ? { ...value, es: e.target.value } : value) })} /></label><label className="block mt-2 text-xs font-bold">中文解释<input required maxLength={500} value={hint.chinese} className={inputClass} onChange={e => patch({ vocabHints: draft.vocabHints.map((value, position) => position === index ? { ...value, chinese: e.target.value } : value) })} /></label></div>)}</div>
            </div>
          </>}
          <div className="flex gap-3 pt-3"><button type="submit" className="duo-btn-green flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black"><Save size={16} />{uploading ? '正在上传…' : saving ? '正在保存…' : '保存'}</button><button type="button" className={buttonClass} onClick={() => { if (discard()) setDraft(null); }}>取消</button></div>
        </fieldset></form>
      </section>}
    </div>
  </main>;
}
