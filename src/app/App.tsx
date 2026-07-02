import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { TabBar } from './TabBar'
import { AnalyticsPage } from '../features/analytics/AnalyticsPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { RecordPage } from '../features/record/RecordPage'
import { SettingsPage } from '../features/settings/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <div
        className="flex h-dvh flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/record" replace />} />
            <Route path="/record" element={<RecordPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <TabBar />
      </div>
    </HashRouter>
  )
}
