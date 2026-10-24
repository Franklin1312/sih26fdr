import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '../components/layout'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/auth/LoginPage'

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
      { path: '/wizard', element: <div>Wizard Page - Coming Soon</div> },
      { path: '/my-cases', element: <div>My Cases Page - Coming Soon</div> },
      { path: '/cases/:id', element: <div>Case Detail Page - Coming Soon</div> },
      { path: '/scrutiny', element: <div>Scrutiny Page - Coming Soon</div> },
      { path: '/clearance', element: <div>Clearance Page - Coming Soon</div> },
      { path: '/release', element: <div>Release Page - Coming Soon</div> },
      { path: '/admin/users', element: <div>Admin Users Page - Coming Soon</div> },
      { path: '/admin/institutions', element: <div>Admin Institutions Page - Coming Soon</div> },
      { path: '/settings', element: <div>Settings Page - Coming Soon</div> },
    ],
  },
])