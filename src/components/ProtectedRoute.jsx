import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, profile, demoRole } = useAuth();

  // Demo mode: bypass real auth if a demo role is selected
  if (demoRole) {
    return <Outlet />;
  }

  if (isLoadingAuth) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  // If authenticated but profile is missing the user hasn't been registered yet
  if (!profile && !demoRole) {
    return <UserNotRegisteredError />;
  }

  return <Outlet />;
}