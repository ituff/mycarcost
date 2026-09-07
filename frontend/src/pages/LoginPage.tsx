import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'loading' | 'login' | 'setup'>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        if (status.authenticated) {
          navigate('/', { replace: true });
        } else {
          setMode(status.needsSetup ? 'setup' : 'login');
        }
      })
      .catch(() => setMode('login'));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'setup' && password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'setup') {
        await api.setupPassword(password);
      } else {
        await api.login(password);
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      if (err?.field === 'password' || err?.error?.includes('字符')) {
        setError(err.error || '密码不符合要求');
      } else if (err?.status === 409 && err?.needsSetup) {
        setMode('setup');
        setError('');
      } else {
        setError(err?.error || '操作失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 text-white text-2xl font-bold mb-3">
            MC
          </div>
          <h1 className="text-xl font-bold text-gray-900">My Car Cost</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'setup' ? '首次使用，请设置访问密码' : '请输入访问密码'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-sm space-y-4">
          <div>
            <label htmlFor="login-password" className="block text-sm text-gray-600 mb-1">
              {mode === 'setup' ? '设置密码' : '访问密码'}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
              placeholder={mode === 'setup' ? '至少 6 个字符' : ''}
              autoFocus
              required
            />
          </div>

          {mode === 'setup' && (
            <div>
              <label htmlFor="login-confirm" className="block text-sm text-gray-600 mb-1">
                确认密码
              </label>
              <input
                id="login-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
                required
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full min-h-[44px] bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {submitting ? '请稍候...' : mode === 'setup' ? '设置并进入' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
