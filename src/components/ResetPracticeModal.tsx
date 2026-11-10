import React, { useState } from 'react';
interface Props { busy: boolean; onClose: () => void; onReset: (password: string) => Promise<void> }
export function ResetPracticeModal({ busy, onClose, onReset }: Props) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  return <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
    <form role="dialog" aria-modal="true" aria-labelledby="reset-title" className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (busy || !confirmed) return;
      setError('');
      try { await onReset(password); }
      catch (err) { setError((err as Error).message); }
      finally { setPassword(''); }
    }}>
      <h2 id="reset-title" className="text-xl font-bold text-red-600">清空全库练习数据</h2>
      <p>将清空所有账号的答题记录、难点、经验、宝石和连胜，红心恢复为5，并用最新题库重新开始。账号和密码保留，其他设备需重新登录。</p>
      <p className="text-red-600 font-bold">此操作不可撤销。</p>
      <label className="block">管理员密码<input type="password" required minLength={12} maxLength={128} autoComplete="current-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="border rounded p-2 w-full" /></label>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />我确认清空所有账号的练习数据并重建题库</label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={busy}>取消</button>
        <button type="submit" disabled={busy || !confirmed || password.length < 12} className="bg-red-600 text-white rounded px-4 py-2 disabled:opacity-40">{busy ? '正在重置…' : '清空并重新开始'}</button>
      </div>
    </form>
  </div>;
}
