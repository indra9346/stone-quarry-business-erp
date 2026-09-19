import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainBranchHome from '@/features/central-gateway/pages/MainBranchHome'
import BusinessRouteWrapper from '@/features/central-gateway/BusinessRouteWrapper'
import BusinessSignIn from '@/features/auth/BusinessSignIn'
import ProtectedBusinessRoute from '@/features/auth/ProtectedBusinessRoute'
import BusinessLayout from '@/layouts/BusinessLayout'
import BusinessDashboard from '@/features/dashboard/pages/BusinessDashboard'
import NotFound from '@/pages/NotFound'

/**
 * Routing architecture (spec section 22):
 *   /                              Main Branch (central gateway)
 *   /business/:businessCode        Business authentication / entry
 *   /business/:businessCode/...    Protected business modules
 *
 * :businessCode is validated against the registry in BusinessRouteWrapper
 * before a BusinessProvider (and therefore that business's isolated
 * Supabase client) is ever created.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainBranchHome />} />

        <Route path="/business/:businessCode" element={<BusinessRouteWrapper />}>
          <Route index element={<BusinessSignIn />} />

          <Route element={<ProtectedBusinessRoute />}>
            <Route element={<BusinessLayout />}>
              <Route path="dashboard" element={<BusinessDashboard />} />
              {/* Bills, Quotations, Payments, Ledger, Stock, Vehicles, Trips,
                  Expenses, Reports, Settings, Audit Logs land here in
                  Phase 6 onward — see BUSINESS_RULES.md roadmap. */}
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
