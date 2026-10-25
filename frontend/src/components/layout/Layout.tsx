import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { GovTopBar } from './GovTopBar'
import { GovFooter } from './GovFooter'
import { AlertTicker } from './AlertTicker'

const STRIP_PX = 36 // keep in sync with --gov-strip-h in index.css

export function Layout() {
  // The utility strip scrolls away while header + sidebar stay pinned, so the sidebar
  // needs to know how much of the strip is still on screen.
  useEffect(() => {
    const root = document.documentElement
    const update = () =>
      root.style.setProperty('--gov-strip-offset', `${Math.max(0, STRIP_PX - window.scrollY)}px`)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      <GovTopBar />
      <Header />
      <Sidebar />
      <div className="flex min-h-[calc(100vh-var(--gov-chrome-h,104px))] flex-col lg:pl-64">
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <AlertTicker />
            <div className="animate-fade-up">
              <Outlet />
            </div>
          </div>
        </main>
        <GovFooter />
      </div>
    </div>
  )
}
