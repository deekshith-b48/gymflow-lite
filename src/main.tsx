import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const AppShell = lazy(() =>
  import("./components/AppShell").then((module) => ({
    default: module.AppShell,
  })),
);
const Overview = lazy(() => import("./pages/Overview.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Catalog = lazy(() => import("./pages/Catalog.tsx"));
const CatalogItemPage = lazy(() => import("./pages/CatalogItem.tsx"));
const Schedule = lazy(() => import("./pages/Schedule.tsx"));
const Feed = lazy(() => import("./pages/Feed.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Members = lazy(() => import("./pages/Members.tsx"));
const CheckIns = lazy(() => import("./pages/CheckIns.tsx"));
const MemberDetail = lazy(() => import("./pages/MemberDetail.tsx"));
const Attendance = lazy(() => import("./pages/Attendance.tsx"));
const Fees = lazy(() => import("./pages/Fees.tsx"));
const Sales = lazy(() => import("./pages/Sales.tsx"));
const Expenses = lazy(() => import("./pages/Expenses.tsx"));
const Withdrawals = lazy(() => import("./pages/Withdrawals.tsx"));
const StaffPage = lazy(() => import("./pages/StaffPage.tsx"));
const Packages = lazy(() => import("./pages/Packages.tsx"));
const Trainers = lazy(() => import("./pages/Trainers.tsx"));
const TrainerDetail = lazy(() => import("./pages/TrainerDetail.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const ActivityLog = lazy(() => import("./pages/ActivityLog.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              {/* The desk: roster, check-ins and the member's home screen.
                  All three sit behind RequireAuth, which preserves the
                  requested path in /auth?returnTo=... */}
              <Route
                path="/dashboard"
                element={
                  <RequireAuth
                    title="Sign in to open the desk"
                    description="The member roster, check-ins and dues are for gym staff."
                  >
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="overview" element={<Overview />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="catalog/:itemId" element={<CatalogItemPage />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="feed" element={<Feed />} />
                <Route path="members" element={<Members />} />
                <Route
                  path="members/:memberId"
                  element={<MemberDetail />}
                />
                <Route path="attendance" element={<Attendance />} />
                <Route path="fees" element={<Fees />} />
                <Route path="sales" element={<Sales />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="withdrawals" element={<Withdrawals />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="packages" element={<Packages />} />
                <Route path="trainers" element={<Trainers />} />
                <Route path="trainers/:trainerId" element={<TrainerDetail />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="activity" element={<ActivityLog />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="check-ins" element={<CheckIns />} />
                <Route path="admin" element={<Admin />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
