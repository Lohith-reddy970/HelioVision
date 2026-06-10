"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, LayoutDashboard, ScanLine, Calculator, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/AuthContext"

const sideNavItems = [
  { href: "/roof-detection", label: "Roof Detection", icon: ScanLine },
  { href: "/solar-estimation", label: "Solar Estimation", icon: Calculator },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  // Derive display name: prefer displayName, fall back to email prefix
  const displayName = user?.displayName || user?.email?.split("@")[0] || "User"

  // Generate initials (up to 2 letters) from the display name
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 glass border-r border-white/5 z-40 flex flex-col p-4">
      {/* Logo */}
      <div className="h-12 flex items-center px-2 mb-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-blue/15 border border-neon-blue/30 flex items-center justify-center glow-blue">
            <Zap className="w-5 h-5 text-neon-blue" />
          </div>
          <span className="font-bold text-foreground text-xl tracking-tight">
            Helio<span className="text-neon-blue">Vision</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto">
        {/* Control Room */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] px-3 mb-2">
            Control Room
          </p>
          <Link
            href="/dashboard"
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 group",
              pathname === "/dashboard"
                ? "text-neon-blue"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <AnimatePresence>
              {pathname === "/dashboard" && (
                <motion.span
                  layoutId="sidebar-pill"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-2xl bg-neon-blue/8 border border-neon-blue/20 glow-blue neon-border-moving"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
                />
              )}
            </AnimatePresence>
            <LayoutDashboard
              className={cn(
                "relative z-10 w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                pathname === "/dashboard" ? "text-neon-blue" : "text-muted-foreground"
              )}
            />
            <span className="relative z-10 flex-1 tracking-wide">System Command Center</span>
            {pathname === "/dashboard" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="relative z-10 w-1.5 h-1.5 rounded-full bg-neon-blue glow-blue"
              />
            )}
          </Link>
        </div>

        {/* Core Engine */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] px-3 mb-2">
            Core Engine
          </p>
          {sideNavItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 group",
                  active
                    ? "text-neon-blue"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <AnimatePresence>
                  {active && (
                    <motion.span
                      layoutId="sidebar-pill"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-2xl bg-neon-blue/8 border border-neon-blue/20 glow-blue neon-border-moving"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
                    />
                  )}
                </AnimatePresence>
                <Icon
                  className={cn(
                    "relative z-10 w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                    active ? "text-neon-blue" : "text-muted-foreground"
                  )}
                />
                <span className="relative z-10 flex-1 tracking-wide">{item.label}</span>
                {active && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="relative z-10 w-1.5 h-1.5 rounded-full bg-neon-blue glow-blue"
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer — real user + working logout */}
      <div className="pt-4 border-t border-white/5 space-y-2">
        {/* User card */}
        <div className="glass rounded-2xl p-4 flex items-center gap-3 hover:border-neon-blue/20 transition-all group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-blue/30 to-neon-green/30 border border-white/10 flex items-center justify-center text-xs font-bold text-neon-blue group-hover:scale-105 transition-transform shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground font-medium truncate">{user?.email || ""}</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-neon-green glow-green animate-pulse shrink-0" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  )
}
