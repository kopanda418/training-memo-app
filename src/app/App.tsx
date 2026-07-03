import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { TabBar } from './TabBar'
import { AnalyticsPage } from '../features/analytics/AnalyticsPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { RecordPage } from '../features/record/RecordPage'
import { AttributeManagerPage } from '../features/settings/AttributeManagerPage'
import { ExerciseManagerPage } from '../features/settings/ExerciseManagerPage'
import { SettingsPage } from '../features/settings/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      {/* fixed inset-0 で画面四辺に固定(dvh 依存だと iOS 実機で下部にすき間が出る) */}
      <div
        className="fixed inset-0 flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/record" replace />} />
            <Route path="/record" element={<RecordPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/exercises" element={<ExerciseManagerPage />} />
            <Route path="/settings/attributes" element={<AttributeManagerPage />} />
          </Routes>
        </main>
        <TabBar />
      </div>
    </HashRouter>
  )
}
