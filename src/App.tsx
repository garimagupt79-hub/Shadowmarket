import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import { MarketProvider, useMarket } from './context/MarketContext';
import { LandingPage } from './pages/LandingPage';
import { ConsumerDashboard } from './pages/ConsumerDashboard';
import { ConsumerTransmit } from './pages/ConsumerTransmit';
import { ConsumerIntentDetail } from './pages/ConsumerIntentDetail';
import { ConsumerOrders } from './pages/ConsumerOrders';
import { ConsumerWallet } from './pages/ConsumerWallet';
import { ConsumerBag } from './pages/ConsumerBag';
import { ConsumerInbox } from './pages/ConsumerInbox';
import { SyndicateWavesFeed } from './components/SyndicateWavesFeed';
import { BrandDashboard } from './pages/BrandDashboard';
import { BrandInventory } from './pages/BrandInventory';
import { BrandCatalog } from './pages/BrandCatalog';
import { BrandCatalogNew } from './pages/BrandCatalogNew';
import { BrandRadar } from './pages/BrandRadar';
import { BrandOrders } from './pages/BrandOrders';
import { BrandSupport } from './pages/BrandSupport';
import { BrandSettings } from './pages/BrandSettings';
import { BrandAnalytics } from './pages/BrandAnalytics';
import { BrandWallet } from './pages/BrandWallet';
import { BrandSyndicate } from './pages/BrandSyndicate';
import { AdminPortal } from './pages/AdminPortal';

function RequireRole({
  role,
  children,
}: {
  role: 'consumer' | 'brand';
  children: ReactNode;
}) {
  const { session } = useMarket();
  if (session.role !== role) {
    return <Navigate to={session.role ? `/${session.role}/dashboard` : '/'} replace />;
  }
  return <>{children}</>;
}

function LandingRoute() {
  const { session, authLoading } = useMarket();
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  if (session.role) {
    return <Navigate to={`/${session.role}/dashboard`} replace />;
  }
  return <LandingPage />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingRoute />} />
        <Route
          path="/consumer/dashboard"
          element={
            <RequireRole role="consumer">
              <ConsumerDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/intent/:id"
          element={
            <RequireRole role="consumer">
              <ConsumerIntentDetail />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/transmit"
          element={
            <RequireRole role="consumer">
              <ConsumerTransmit />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/waves"
          element={
            <RequireRole role="consumer">
              <SyndicateWavesFeed />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/orders"
          element={
            <RequireRole role="consumer">
              <ConsumerOrders />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/wallet"
          element={
            <RequireRole role="consumer">
              <ConsumerWallet />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/bag"
          element={
            <RequireRole role="consumer">
              <ConsumerBag />
            </RequireRole>
          }
        />
        <Route
          path="/consumer/inbox"
          element={
            <RequireRole role="consumer">
              <ConsumerInbox />
            </RequireRole>
          }
        />
        <Route
          path="/brand/dashboard"
          element={
            <RequireRole role="brand">
              <BrandDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/brand/syndicate"
          element={
            <RequireRole role="brand">
              <BrandSyndicate />
            </RequireRole>
          }
        />
        <Route
          path="/brand/inventory"
          element={
            <RequireRole role="brand">
              <BrandInventory />
            </RequireRole>
          }
        />
        <Route
          path="/brand/catalog"
          element={
            <RequireRole role="brand">
              <BrandCatalog />
            </RequireRole>
          }
        />
        <Route
          path="/brand/catalog/new"
          element={
            <RequireRole role="brand">
              <BrandCatalogNew />
            </RequireRole>
          }
        />
        <Route
          path="/brand/radar"
          element={
            <RequireRole role="brand">
              <BrandRadar />
            </RequireRole>
          }
        />
        <Route
          path="/brand/orders"
          element={
            <RequireRole role="brand">
              <BrandOrders />
            </RequireRole>
          }
        />
        <Route
          path="/brand/support"
          element={
            <RequireRole role="brand">
              <BrandSupport />
            </RequireRole>
          }
        />
        <Route
          path="/brand/settings"
          element={
            <RequireRole role="brand">
              <BrandSettings />
            </RequireRole>
          }
        />
        <Route
          path="/brand/analytics"
          element={
            <RequireRole role="brand">
              <BrandAnalytics />
            </RequireRole>
          }
        />
        <Route
          path="/brand/wallet"
          element={
            <RequireRole role="brand">
              <BrandWallet />
            </RequireRole>
          }
        />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <MarketProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </MarketProvider>
  );
}
