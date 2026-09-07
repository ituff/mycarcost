import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await api.getSettings();
        setApiUrl(settings.llm_api_url || '');
        setApiKey(settings.llm_api_key || '');
        setLlmModel(settings.llm_model || '');
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.updateSettings({ llm_api_url: apiUrl, llm_api_key: apiKey, llm_model: llmModel });
      setMessage('设置已保存');
    } catch (err: any) {
      setMessage(err.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordMessage('两次输入的新密码不一致');
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      // The session secret was rotated server-side: re-authenticate.
      window.location.href = '/login';
    } catch (err: any) {
      setPasswordMessage(err?.error || '修改失败');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">加载中...</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">设置</h1>

      <form onSubmit={handleSave} className="bg-white rounded-lg p-4 shadow-sm space-y-4">
        <h2 className="font-semibold">图片识别 API 配置</h2>
        <p className="text-sm text-gray-500">配置 OpenAI 兼容的多模态 LLM API，用于识别充电截图中的数据。</p>

        <div>
          <label htmlFor="settings-url" className="block text-sm text-gray-600 mb-1">API 地址</label>
          <input
            id="settings-url"
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            placeholder="https://<your-llm-provider>/compatible/v1/chat/completions"
          />
        </div>

        <div>
          <label htmlFor="settings-key" className="block text-sm text-gray-600 mb-1">API 密钥</label>
          <input
            id="settings-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            placeholder="sk-..."
          />
        </div>

        <div>
          <label htmlFor="settings-model" className="block text-sm text-gray-600 mb-1">模型名称</label>
          <input
            id="settings-model"
            type="text"
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            placeholder="必填，如 qwen-vl-max、qwen-vl-ocr、gemini-2.0-flash"
            required
          />
          <p className="text-xs text-gray-400 mt-1">必须是你所配 API 服务支持的视觉（多模态）模型</p>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
        )}

        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded-lg min-h-[44px]">
          {saving ? '保存中...' : '保存设置'}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="mt-6 bg-white rounded-lg p-4 shadow-sm space-y-4">
        <h2 className="font-semibold">访问密码</h2>
        <p className="text-sm text-gray-500">修改成功后所有设备（包括当前设备）需要用新密码重新登录。</p>

        <div>
          <label htmlFor="pw-current" className="block text-sm text-gray-600 mb-1">当前密码</label>
          <input
            id="pw-current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            required
          />
        </div>

        <div>
          <label htmlFor="pw-new" className="block text-sm text-gray-600 mb-1">新密码（至少 6 个字符）</label>
          <input
            id="pw-new"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            minLength={6}
            required
          />
        </div>

        <div>
          <label htmlFor="pw-confirm" className="block text-sm text-gray-600 mb-1">确认新密码</label>
          <input
            id="pw-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            required
          />
        </div>

        {passwordMessage && (
          <p className={`text-sm ${passwordMessage.includes('失败') || passwordMessage.includes('不一致') || passwordMessage.includes('错误') ? 'text-red-500' : 'text-green-600'}`}>
            {passwordMessage}
          </p>
        )}

        <button type="submit" disabled={changingPassword} className="w-full bg-blue-600 text-white py-2 rounded-lg min-h-[44px]">
          {changingPassword ? '提交中...' : '修改密码'}
        </button>
      </form>

      <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
        <h2 className="font-semibold mb-2">管理</h2>
        <Link to="/locations" className="block py-2 text-blue-600 min-h-[44px] flex items-center">
          📍 地点管理
        </Link>
        <button
          type="button"
          onClick={async () => {
            try { await api.logout(); } catch { /* ignore */ }
            window.location.href = '/login';
          }}
          className="block py-2 text-red-500 min-h-[44px] w-full text-left"
        >
          🚪 退出登录
        </button>
      </div>

      <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
        <h2 className="font-semibold mb-2">关于</h2>
        <p className="text-sm text-gray-500">My Car Cost v0.1.0</p>
        <p className="text-sm text-gray-500">单用户车辆能耗与费用记录应用</p>
      </div>
    </div>
  );
}
