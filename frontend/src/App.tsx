import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import VehiclesPage from './pages/VehiclesPage';
import ConsumptionOverviewPage from './pages/ConsumptionOverviewPage';
import ConsumptionsPage from './pages/ConsumptionsPage';
import ConsumptionDetailPage from './pages/ConsumptionDetailPage';
import ConsumptionEditPage from './pages/ConsumptionEditPage';
import ExpensesPage from './pages/ExpensesPage';
import ExpenseOverviewPage from './pages/ExpenseOverviewPage';
import SettingsPage from './pages/SettingsPage';
import LocationsPage from './pages/LocationsPage';
import { api } from './api';

function RequireAuth() {
  const [state, setState] = useState<'loading' | 'ok' | 'unauthorized'>('loading');

  useEffect(() => {
    let cancelled = false;
    api
      .getAuthStatus()
      .then((status) => {
        if (!cancelled) {
          setState(status.enabled && !status.authenticated ? 'unauthorized' : 'ok');
        }
      })
      .catch(() => {
        if (!cancelled) setState('unauthorized');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return <div className="min-h-screen bg-gray-50" />;
  }
  if (state === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<VehiclesPage />} />
          <Route path="/consumptions" element={<ConsumptionOverviewPage />} />
          <Route path="/consumptions/list" element={<ConsumptionsPage />} />
          <Route path="/consumptions/records/:id" element={<ConsumptionDetailPage />} />
          <Route path="/consumptions/records/:id/edit" element={<ConsumptionEditPage />} />
          <Route path="/expenses" element={<ExpenseOverviewPage />} />
          <Route path="/expenses/list" element={<ExpensesPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
