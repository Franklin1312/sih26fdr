import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '../../utils/helpers'

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className={cn('lg:ml-64 transition-all duration-300', 'min-h-screen')}>
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}