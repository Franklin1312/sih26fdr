import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../components/layout'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { WizardPage } from '../pages/wizard'
import { MyCasesPage, CaseDetailPage } from '../pages/cases'
import { ScrutinyQueuePage, ScrutinyCaseDetailPage } from '../pages/scrutiny'
import { ClearanceQueuePage, ClearanceTaskDetailPage } from '../pages/clearance'
import { ReleaseQueuePage, ReleaseCaseDetailPage } from '../pages/release'
import { InstitutionsPage, UsersPage } from '../pages/admin'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/wizard/new', element: <WizardPage isNew /> },
      { path: '/wizard/:caseId/step1', element: <WizardPage /> },
      { path: '/wizard/:caseId/step2', element: <WizardPage /> },
      { path: '/wizard/:caseId/step3', element: <WizardPage /> },
      { path: '/wizard/:caseId/step4', element: <WizardPage /> },
      { path: '/my-cases', element: <MyCasesPage /> },
      { path: '/cases/:id', element: <CaseDetailPage /> },
      { path: '/scrutiny', element: <ScrutinyQueuePage /> },
      { path: '/scrutiny/cases/:caseId', element: <ScrutinyCaseDetailPage /> },
      { path: '/clearance', element: <ClearanceQueuePage /> },
      { path: '/clearance/tasks/:taskId', element: <ClearanceTaskDetailPage /> },
      { path: '/release', element: <ReleaseQueuePage /> },
      { path: '/release/cases/:caseId', element: <ReleaseCaseDetailPage /> },
      { path: '/admin/users', element: <UsersPage /> },
      { path: '/admin/institutions', element: <InstitutionsPage /> },
      { path: '/settings', element: <div>Settings Page - Coming Soon</div> },
    ],
  },
])