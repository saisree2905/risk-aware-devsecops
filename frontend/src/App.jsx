import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import ScanHistoryPage from './pages/ScanHistoryPage';
import ScanDetailsPage from './pages/ScanDetailsPage';
import FindingsExplorerPage from './pages/FindingsExplorerPage';
import RiskAnalysisPage from './pages/RiskAnalysisPage';
import PoliciesPage from './pages/PoliciesPage';
import ScannerTelemetryPage from './pages/ScannerTelemetryPage';
import NotFoundPage from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="scans" element={<ScanHistoryPage />} />
        <Route path="scans/:id" element={<ScanDetailsPage />} />
        <Route path="findings" element={<FindingsExplorerPage />} />
        <Route path="risk" element={<RiskAnalysisPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="scanners" element={<ScannerTelemetryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
