import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { to: '/', label: '车辆', icon: '🚗' },
  { to: '/consumptions', label: '能耗', icon: '⛽' },
  { to: '/expenses', label: '费用', icon: '💰' },
  { to: '/settings', label: '设置', icon: '⚙️' },
];

export default function NavBar() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const pick = (path: string) => {
    setPickerOpen(false);
    navigate(`${path}?add=1`);
  };

  return (
    <>
      {pickerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-[60]" onClick={() => setPickerOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-w-4xl mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-t-2xl p-4 pb-8">
              <p className="text-center font-semibold mb-4">添加记录</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => pick('/consumptions/list')}
                  className="border-2 border-green-600 text-green-700 rounded-lg py-3 min-h-[56px] font-medium"
                >
                  ⛽ 记能耗
                </button>
                <button
                  onClick={() => pick('/expenses/list')}
                  className="border-2 border-blue-600 text-blue-700 rounded-lg py-3 min-h-[56px] font-medium"
                >
                  💰 记费用
                </button>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="w-full mt-3 border rounded-lg py-3 min-h-[44px] text-gray-500"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-4xl mx-auto flex justify-around items-end">
          {navItems.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 min-w-[44px] min-h-[44px] justify-center text-xs ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}

          {/* Center + button, kept inside the bar bounds */}
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center justify-center self-center w-11 h-11 rounded-full bg-blue-600 text-white text-2xl shadow"
            aria-label="添加记录"
          >
            +
          </button>

          {navItems.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 min-w-[44px] min-h-[44px] justify-center text-xs ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="mt-0.5">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
