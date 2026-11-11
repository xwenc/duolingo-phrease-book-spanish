import { BookOpen, Check, Star, ArrowRight } from 'lucide-react';
import type { Book, BooksProgressMap } from '../data/books';

interface Props {
  books: Book[];
  progress: BooksProgressMap;
  currentBookId: string;
  starredIds: string[];
  onSelectBook: (id: string) => void;
}
export function BooksLibrary({ books, progress, currentBookId, starredIds, onSelectBook }: Props) {
  return <main className="w-full max-w-4xl mx-auto px-5 py-10">
    <div className="mb-8"><p className="text-[#58a700] font-black mb-2">每天一点，西语更进一步</p><h1 className="text-3xl font-black text-slate-700">我的教材馆</h1><p className="mt-3 text-slate-500">选一本教材，接着上次的进度继续练习。</p></div>
    {!books.length && <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-slate-500">暂无练习教材，请由管理员添加书籍、章节和句子。</p>}
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">{books.map(book => {
      const saved = progress[book.id];
      const pool = saved?.isStarredMode ? book.exercises.filter(ex => starredIds.includes(ex.id)) : saved && saved.selectedUnitId !== 'all' ? book.exercises.filter(ex => ex.unitId === saved.selectedUnitId) : book.exercises;
      const percent = saved?.isCompleted ? 100 : Math.min(100, Math.round((saved?.currentIndex || 0) / Math.max(1, pool.length) * 100));
      const count = book.exercises.filter(ex => starredIds.includes(ex.id)).length;
      const active = currentBookId === book.id;
      const empty = book.exercises.length === 0;
      const action = empty ? '暂无句子' : saved?.isCompleted ? '重新温习' : '继续攻克';
      return <button key={book.id} disabled={empty} onClick={() => onSelectBook(book.id)} aria-label={`${book.title}，${action}`} className={`text-left bg-white rounded-3xl border-2 border-b-[6px] p-6 transition-transform enabled:hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#58cc02] ${active ? 'ring-2 ring-[#58cc02] border-[#58cc02]' : 'border-[#e5e5e5]'}`}>
        <div className="flex justify-between items-start"><div className="p-5 rounded-2xl text-white shadow-sm" style={{ backgroundColor: book.color }}>{book.thumbnail ? <img src={book.thumbnail} alt={`${book.title}封面`} className="w-12 h-12 object-cover rounded-lg" /> : <BookOpen size={38} />}</div>{book.level && <span className="rounded-xl px-3 py-1 font-black text-sm bg-slate-100">{book.level}</span>}</div>
        <h2 className="text-xl font-black mt-5 text-slate-700">{book.title}</h2>
        {book.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{book.description}</p>}
        <p className="text-sm text-slate-400 mt-2">{book.chapters.length} 个单元 · {book.exercises.length} 道练习</p>
        <div className="flex justify-between text-xs font-bold mt-6 mb-2"><span>{saved?.isCompleted ? '本轮已通关' : '当前练习进度'}</span><span>{percent}%</span></div>
        <div role="progressbar" aria-label={`${book.title}进度`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: book.color }} /></div>
        <div className="flex justify-between items-center mt-4 text-xs font-bold"><span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-lg"><Star size={14} /> {count} 个难点</span>{active && <span className="flex items-center gap-1 text-[#58a700]"><Check size={14} />正在练习</span>}</div>
        <div className="flex justify-between items-center mt-5 font-black text-sm" style={{ color: book.color }}>{action}<ArrowRight size={20} /></div>
      </button>;
    })}</div>
  </main>;
}
