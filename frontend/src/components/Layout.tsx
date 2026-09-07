import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import OfflineIndicator from './OfflineIndicator';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OfflineIndicator />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 pb-20">
        <Outlet />
      </main>
      <NavBar />
    </div>
  );
}
