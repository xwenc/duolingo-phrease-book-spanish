import React, { useState } from 'react';
import { api } from '../services/api';
export function AuthGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <form className="w-full max-w-sm bg-white p-8 rounded-2xl border space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      const data = new FormData(e.currentTarget);
      try { await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) }); onAuthenticated(); }
      catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      <h1 className="text-2xl font-bold">西班牙语口语练习</h1>
      <label className="block">邮箱<input className="block border rounded p-2 w-full" name="email" type="email" autoComplete="email" required /></label>
      <label className="block">密码（至少12位）<input className="block border rounded p-2 w-full" name="password" type="password" minLength={12} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} required /></label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={busy} className="w-full bg-green-600 text-white p-2 rounded">{busy ? '请稍候…' : register ? '创建账号' : '登录'}</button>
      <button type="button" disabled={busy} onClick={() => setRegister(!register)}>{register ? '已有账号？登录' : '没有账号？注册'}</button>
    </form>
  </main>;
}
