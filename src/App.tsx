import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { homePathFor } from '@/auth/paths';
import { RedirectIfSignedIn, RequireSide } from '@/auth/RequireSide';
import { PortalShell } from '@/components/PortalShell';
import { LoginPage } from '@/routes/login/LoginPage';
import { RequireBranch } from '@/routes/retailer/RequireBranch';
import { BranchSetupPage } from '@/routes/retailer/BranchSetupPage';
import { InventoryPage } from '@/routes/retailer/InventoryPage';
import { DonationsPage } from '@/routes/retailer/DonationsPage';
import { NgoHome } from '@/routes/ngo/NgoHome';
import { NgoHistoryPage } from '@/routes/ngo/NgoHistoryPage';
import { NgoProfilePage } from '@/routes/ngo/NgoProfilePage';
import { ShelfPage } from '@/routes/ngo/ShelfPage';
import { StorePage } from '@/routes/ngo/StorePage';
import { RegisterPage } from '@/routes/register/RegisterPage';
import { RetailerHome } from '@/routes/retailer/RetailerHome';

/** Sends `/` to whichever side the account belongs to, or to sign-in. */
function RootRedirect() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Navigate to={session ? homePathFor(session.side) : '/login'} replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<RedirectIfSignedIn />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireSide side="retailer" />}>
        <Route path="/retailer" element={<PortalShell />}>
          <Route path="setup" element={<BranchSetupPage />} />
          <Route element={<RequireBranch />}>
            <Route index element={<RetailerHome />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="donations" element={<DonationsPage />} />
          </Route>
        </Route>
      </Route>

      <Route element={<RequireSide side="ngo" />}>
        <Route path="/ngo" element={<PortalShell />}>
          <Route index element={<NgoHome />} />
          <Route path="shelf" element={<ShelfPage />} />
          <Route path="shelf/:locationId" element={<StorePage />} />
          <Route path="history" element={<NgoHistoryPage />} />
          <Route path="profile" element={<NgoProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
