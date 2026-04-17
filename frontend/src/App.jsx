// src/App.jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useProjectStore } from './store/projectStore';
import Layout from './components/common/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import AIChatbot from './components/common/AIChatbot';
import './utils/i18n'; // Initialize i18n

// Lazy load pages
const Dashboard        = lazy(() => import('./pages/Dashboard'));
const Login            = lazy(() => import('./pages/Login'));
const Properties       = lazy(() => import('./pages/Properties'));
const UnitDetail       = lazy(() => import('./pages/UnitDetail'));
const Bookings         = lazy(() => import('./pages/Bookings'));
const BookingDetail    = lazy(() => import('./pages/BookingDetail'));
const NewBooking       = lazy(() => import('./pages/NewBooking'));
const Customers        = lazy(() => import('./pages/Customers'));
const CustomerDetail   = lazy(() => import('./pages/CustomerDetail'));
const Installments     = lazy(() => import('./pages/Installments'));
const Payments         = lazy(() => import('./pages/Payments'));
const Agents           = lazy(() => import('./pages/Agents'));
const Investors        = lazy(() => import('./pages/Investors'));
const Expenses         = lazy(() => import('./pages/Expenses'));
const HR               = lazy(() => import('./pages/HR'));
const Payroll          = lazy(() => import('./pages/Payroll'));
const Procurement      = lazy(() => import('./pages/Procurement'));
const Facility         = lazy(() => import('./pages/Facility'));
const Finance          = lazy(() => import('./pages/Finance'));
const Reports          = lazy(() => import('./pages/Reports'));
const WhatsApp         = lazy(() => import('./pages/WhatsApp'));
const Settings         = lazy(() => import('./pages/Settings'));
const Users            = lazy(() => import('./pages/Users'));
const FinancialAudit   = lazy(() => import('./pages/FinancialAudit'));
const StatementPage           = lazy(() => import('./pages/StatementPage'));
const PaymentPlanCalculator   = lazy(() => import('./pages/PaymentPlanCalculator'));
const ProjectSelector         = lazy(() => import('./pages/ProjectSelector'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Only renders children if authenticated (for global overlays like chatbot)
const AuthGate = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : null;
};

// Project Gate — redirects to /select-project if no project chosen
const ProjectGate = ({ children }) => {
  const { project } = useProjectStore();
  return project ? children : <Navigate to="/select-project" replace />;
};

// Protected Route
const ProtectedRoute = ({ children, roles }) => {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '10px', fontFamily: 'inherit' },
            success: { style: { background: '#10b981', color: '#fff' } },
            error: { style: { background: '#ef4444', color: '#fff' } },
          }}
        />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/select-project" element={
              <ProtectedRoute><ProjectSelector /></ProtectedRoute>
            } />

            <Route path="/" element={
              <ProtectedRoute>
                <ProjectGate>
                  <Layout />
                </ProjectGate>
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />

              {/* Property */}
              <Route path="properties" element={<Properties />} />
              <Route path="properties/units/:id" element={<UnitDetail />} />

              {/* Sales */}
              <Route path="bookings" element={<Bookings />} />
              <Route path="bookings/new" element={<NewBooking />} />
              <Route path="bookings/:id" element={<BookingDetail />} />
              <Route path="bookings/:id/statement-view" element={<StatementPage />} />

              {/* CRM */}
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />

              {/* Finance */}
              <Route path="installments" element={<Installments />} />
              <Route path="payments" element={<Payments />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="finance" element={<Finance />} />
              <Route path="audit"   element={<FinancialAudit />} />

              {/* People */}
              <Route path="agents" element={<Agents />} />
              <Route path="investors" element={<Investors />} />
              <Route path="hr" element={<HR />} />
              <Route path="payroll" element={<Payroll />} />

              {/* Operations */}
              <Route path="procurement" element={<Procurement />} />
              <Route path="facility" element={<Facility />} />
              <Route path="whatsapp" element={<WhatsApp />} />

              {/* Tools */}
              <Route path="tools/payment-calculator" element={<PaymentPlanCalculator />} />

              {/* Reports */}
              <Route path="reports" element={<Reports />} />

              {/* Admin */}
              <Route path="users" element={
                <ProtectedRoute roles={['admin']}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          {/* Global AI Chatbot — available on all authenticated pages */}
          <AuthGate><AIChatbot /></AuthGate>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
