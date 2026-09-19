import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainBranchHome from '@/features/central-gateway/pages/MainBranchHome'
import BusinessRouteWrapper from '@/features/central-gateway/BusinessRouteWrapper'
import BusinessSignIn from '@/features/auth/BusinessSignIn'
import ForgotPassword from '@/features/auth/ForgotPassword'
import ResetPassword from '@/features/auth/ResetPassword'
import ProtectedBusinessRoute, { RequireAdmin } from '@/features/auth/ProtectedBusinessRoute'
import BusinessLayout from '@/layouts/BusinessLayout'
import NotFound from '@/pages/NotFound'
import { Skeleton } from '@/components/ui/feedback'

/*
 * Routing (one codebase, one isolated database per business):
 *   /                                   Central gateway — choose a business
 *   /business/:businessCode             sign in to THAT business
 *   /business/:businessCode/<module>    protected modules, bound to that business's client
 *
 * The business code is validated against the registry before any provider (and
 * therefore any Supabase client) is created. Admin-only modules sit behind
 * RequireAdmin; the database's RLS is the final authority either way.
 * Every page is lazy-loaded.
 */
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const BillList = lazy(() => import('@/pages/bills/BillList'))
const BillForm = lazy(() => import('@/pages/bills/BillForm'))
const BillDetail = lazy(() => import('@/pages/bills/BillDetail'))
const QuotationList = lazy(() => import('@/pages/quotations/QuotationList'))
const QuotationForm = lazy(() => import('@/pages/quotations/QuotationForm'))
const QuotationDetail = lazy(() => import('@/pages/quotations/QuotationDetail'))
const MeasurementList = lazy(() => import('@/pages/measurements/Measurements').then((m) => ({ default: m.MeasurementList })))
const MeasurementForm = lazy(() => import('@/pages/measurements/Measurements').then((m) => ({ default: m.MeasurementForm })))
const MeasurementDetail = lazy(() => import('@/pages/measurements/Measurements').then((m) => ({ default: m.MeasurementDetail })))
const CustomerList = lazy(() => import('@/pages/customers/Customers').then((m) => ({ default: m.CustomerList })))
const CustomerDetail = lazy(() => import('@/pages/customers/Customers').then((m) => ({ default: m.CustomerDetail })))
const PaymentsPage = lazy(() => import('@/pages/finance/Finance').then((m) => ({ default: m.PaymentsPage })))
const LedgerPage = lazy(() => import('@/pages/finance/Finance').then((m) => ({ default: m.LedgerPage })))
const ExpensesPage = lazy(() => import('@/pages/finance/Finance').then((m) => ({ default: m.ExpensesPage })))
const StockList = lazy(() => import('@/pages/stock/Stock').then((m) => ({ default: m.StockList })))
const StockDetail = lazy(() => import('@/pages/stock/Stock').then((m) => ({ default: m.StockDetail })))
const VehiclesPage = lazy(() => import('@/pages/transport/Transport').then((m) => ({ default: m.VehiclesPage })))
const DriversPage = lazy(() => import('@/pages/transport/Transport').then((m) => ({ default: m.DriversPage })))
const TripsPage = lazy(() => import('@/pages/transport/Transport').then((m) => ({ default: m.TripsPage })))
const Reports = lazy(() => import('@/pages/reports/Reports'))
const Settings = lazy(() => import('@/pages/settings/Settings'))
const AuditLogs = lazy(() => import('@/pages/settings/AuditLogs'))

function PageFallback() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading page">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-navy-950" />}>
        <Routes>
          <Route path="/" element={<MainBranchHome />} />
          <Route path="/businesses" element={<Navigate to="/" replace />} />

          <Route path="/business/:businessCode" element={<BusinessRouteWrapper />}>
            <Route index element={<BusinessSignIn />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedBusinessRoute />}>
              <Route element={<BusinessLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />

                <Route path="bills" element={<Suspense fallback={<PageFallback />}><BillList /></Suspense>} />
                <Route path="bills/ev" element={<Suspense fallback={<PageFallback />}><BillList type="ev" /></Suspense>} />
                <Route path="bills/normal" element={<Suspense fallback={<PageFallback />}><BillList type="normal" /></Suspense>} />
                <Route path="bills/new" element={<Suspense fallback={<PageFallback />}><BillForm mode="create" /></Suspense>} />
                <Route path="bills/:id" element={<Suspense fallback={<PageFallback />}><BillDetail /></Suspense>} />
                <Route path="bills/:id/edit" element={<Suspense fallback={<PageFallback />}><BillForm mode="edit" /></Suspense>} />

                <Route path="quotations" element={<Suspense fallback={<PageFallback />}><QuotationList /></Suspense>} />
                <Route path="quotations/new" element={<Suspense fallback={<PageFallback />}><QuotationForm mode="create" /></Suspense>} />
                <Route path="quotations/:id" element={<Suspense fallback={<PageFallback />}><QuotationDetail /></Suspense>} />
                <Route path="quotations/:id/edit" element={<Suspense fallback={<PageFallback />}><QuotationForm mode="edit" /></Suspense>} />

                <Route path="measurements" element={<Suspense fallback={<PageFallback />}><MeasurementList /></Suspense>} />
                <Route path="measurements/new" element={<Suspense fallback={<PageFallback />}><MeasurementForm mode="create" /></Suspense>} />
                <Route path="measurements/:id" element={<Suspense fallback={<PageFallback />}><MeasurementDetail /></Suspense>} />
                <Route path="measurements/:id/edit" element={<Suspense fallback={<PageFallback />}><MeasurementForm mode="edit" /></Suspense>} />

                <Route path="customers" element={<Suspense fallback={<PageFallback />}><CustomerList /></Suspense>} />
                <Route path="customers/:id" element={<Suspense fallback={<PageFallback />}><CustomerDetail /></Suspense>} />
                <Route path="payments" element={<Suspense fallback={<PageFallback />}><PaymentsPage /></Suspense>} />

                <Route path="stock" element={<Suspense fallback={<PageFallback />}><StockList /></Suspense>} />
                <Route path="stock/:id" element={<Suspense fallback={<PageFallback />}><StockDetail /></Suspense>} />
                <Route path="vehicles" element={<Suspense fallback={<PageFallback />}><VehiclesPage /></Suspense>} />
                <Route path="drivers" element={<Suspense fallback={<PageFallback />}><DriversPage /></Suspense>} />
                <Route path="trips" element={<Suspense fallback={<PageFallback />}><TripsPage /></Suspense>} />

                {/* Admin only: Staff who type these URLs see "Access denied" and no data is requested. */}
                <Route element={<RequireAdmin />}>
                  <Route path="ledger" element={<Suspense fallback={<PageFallback />}><LedgerPage /></Suspense>} />
                  <Route path="expenses" element={<Suspense fallback={<PageFallback />}><ExpensesPage /></Suspense>} />
                  <Route path="reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
                  <Route path="audit-logs" element={<Suspense fallback={<PageFallback />}><AuditLogs /></Suspense>} />
                </Route>

                <Route path="*" element={<NotFound inShell />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
