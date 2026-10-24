import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../components/layout'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/auth/LoginPage'
import { WizardPage } from '../pages/wizard'
import { MyCasesPage, CaseDetailPage } from '../pages/cases'

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
      { path: '/scrutiny', element: <div>Scrutiny Page - Coming Soon</div> },
      { path: '/clearance', element: <div>Clearance Page - Coming Soon</div> },
      { path: '/release', element: <div>Release Page - Coming Soon</div> },
      { path: '/admin/users', element: <div>Admin Users Page - Coming Soon</div> },
      { path: '/admin/institutions', element: <div>Admin Institutions Page - Coming Soon</div> },
      { path: '/settings', element: <div>Settings Page - Coming Soon</div> },
    ],
  },
])