"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sun, TrendingUp, IndianRupee, Zap, Upload, Bell,
  Search, ArrowUpRight, ArrowDownRight, Battery, Thermometer,
  LayoutGrid, List, Filter, Wifi, WifiOff, Activity, Camera, AlertTriangle
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { cn } from "@/lib/utils"
import { getHealthStatus } from "@/lib/api"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { useAppStore } from "@/store/useAppStore"
import { useRouter } from "next/navigation"

const statusColors: Record<string, string> = {
  Completed: "text-neon-green border-neon-green/30 bg-neon-green/5",
  "In Progress": "text-neon-blue border-neon-blue/30 bg-neon-blue/5",
  Pending: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-4 border border-white/10 text-xs shadow-2xl">
        <p className="text-muted-foreground mb-2 font-bold uppercase tracking-widest">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
            <p className="font-semibold" style={{ color: p.color }}>
              {p.name}: {typeof p.value === "number" && !isNaN(p.value) ? `₹${p.value.toLocaleString('en-IN')}` : p.value}
            </p>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const {
    analysisState,
    roofDetectionResult,
    solarEstimationResult,
    savingsPredictionResult
  } = useAppStore()

  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")
  const [modelsLoaded, setModelsLoaded] = useState<number>(0)

  // Check backend health on mount
  useEffect(() => {
    async function checkHealth() {
      try {
        const health = await getHealthStatus()
        setBackendStatus(health.status === "ok" ? "online" : "offline")
        setModelsLoaded(health.models_loaded?.length ?? 0)
      } catch {
        setBackendStatus("offline")
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30_000)
    return () => clearInterval(interval)
  }, [])

  const loading = analysisState === "analyzing" || analysisState === "estimating" || analysisState === "calculating"

  // Derive stats from backend data
  const capacity = roofDetectionResult?.capacity_kwp ?? roofDetectionResult?.estimated_capacity_kw ?? 0
  const detectedArea = roofDetectionResult?.roof_area_m2 ?? roofDetectionResult?.roof_area_sqm ?? 0
  const usableArea = roofDetectionResult?.usable_area_m2 ?? roofDetectionResult?.usable_area_sqm ?? 0
  const estimatedPanels = roofDetectionResult?.estimated_panel_count ?? roofDetectionResult?.panel_count ?? 0
  const detectionConfidence = roofDetectionResult?.detection_confidence ?? 0
  const solarReady = analysisState === "success" && capacity > 0
  const resultWarnings: string[] = roofDetectionResult?.warnings ?? []
  const engineeringWarnings = resultWarnings.filter((warning) =>
    warning.toLowerCase().includes("engineering limits")
  )
  const annualKwh = solarEstimationResult?.predicted_kwh ?? roofDetectionResult?.estimated_annual_kwh ?? 0
  const yieldKwh = annualKwh / 12
  const savingsAmount = savingsPredictionResult?.annual_savings_currency ? (savingsPredictionResult.annual_savings_currency / 12) : 0
  const efficiency = roofDetectionResult?.shading_factor ? (roofDetectionResult.shading_factor * 100).toFixed(1) : "0.0"

  const dynamicMetrics = [
    { label: "Detected Roof Area", value: detectedArea > 0 ? `${detectedArea.toFixed(1)} m²` : "---", delta: "Detected", up: true, icon: LayoutGrid, color: "neon-blue" },
    { label: "Usable Roof Area", value: usableArea > 0 ? `${usableArea.toFixed(1)} m²` : "---", delta: "Validated", up: true, icon: Battery, color: "neon-green" },
    { label: "Monthly Savings", value: savingsAmount > 0 ? `₹${Math.round(savingsAmount).toLocaleString('en-IN')}` : "---", delta: savingsAmount > 0 ? "+Max" : "Wait", up: true, icon: IndianRupee, color: "neon-blue" },
    { label: "Efficiency Rating", value: `${efficiency}%`, delta: "Peak", up: true, icon: Battery, color: "neon-green" },
  ]

  const dashboardMetrics = [
    { label: "Detected Roof Area", value: detectedArea > 0 ? `${detectedArea.toFixed(1)} m²` : "---", delta: "Detected", up: true, icon: LayoutGrid, color: "neon-blue" },
    { label: "Usable Roof Area", value: usableArea > 0 ? `${usableArea.toFixed(1)} m²` : "---", delta: "Validated", up: true, icon: Battery, color: "neon-green" },
    { label: "Estimated Capacity", value: solarReady ? `${capacity.toFixed(1)} kWp` : "---", delta: solarReady ? "Ready" : "Wait", up: true, icon: Zap, color: "neon-blue" },
    { label: "Detection Confidence", value: detectionConfidence > 0 ? `${detectionConfidence.toFixed(1)}%` : "---", delta: "YOLO", up: true, icon: Activity, color: "neon-green" },
  ]

  // Map yearly savings into a chart format
  const energyData = (savingsPredictionResult?.yearly_savings || []).slice(0, 10).map((row: any) => ({
    year: `Yr ${row.year}`,
    savings: Math.round(row.net_savings_currency ?? 0)
  }))

  // Dynamic AI insights
  const aiInsights = roofDetectionResult ? [
    { type: "ROOF GEOMETRY", msg: `Detected ${roofDetectionResult.usable_area_sqm?.toFixed(1) || 0}m² usable surface area with ${roofDetectionResult.orientation || "unknown"} orientation.`, severity: "info" },
    { type: "SOLAR POTENTIAL", msg: `System can support up to ${capacity.toFixed(1)}kW array size using ${roofDetectionResult.panel_count || 0} panels.`, severity: "info" },
    { type: "FINANCIAL ROI", msg: savingsPredictionResult ? `Estimated payback period of ${savingsPredictionResult.payback_period_years.toFixed(1)} years.` : "Analyzing financial matrix...", severity: "info" }
  ] : []

  const dashboardInsights = roofDetectionResult ? [
    { type: "ROOF GEOMETRY", msg: `Detected ${usableArea.toFixed(1)} m² usable roof area with ${roofDetectionResult.orientation || "unknown"} orientation.`, severity: "info" },
    { type: "SOLAR ESTIMATE", msg: solarReady ? `Estimated ${capacity.toFixed(1)} kWp capacity using ${estimatedPanels} panels.` : "Solar estimation is still running.", severity: "info" },
    { type: "FINANCIAL ROI", msg: savingsPredictionResult ? `Estimated payback period of ${savingsPredictionResult.payback_period_years.toFixed(1)} years.` : "Financial calculation pending.", severity: "info" }
  ] : []

  // Real Analysis Session Data
  const recentProjects = roofDetectionResult ? [
    {
      name: "Active Analysis",
      location: `Roof Area: ${Math.round(roofDetectionResult.roof_area_sqm || 0)}m²`,
      status: analysisState === "success" ? "Completed" : "In Progress",
      panels: roofDetectionResult.panel_count || 0,
      savings: savingsPredictionResult?.annual_savings_currency ? `₹${Math.round(savingsPredictionResult.annual_savings_currency).toLocaleString('en-IN')}/yr` : "Calculating...",
      date: new Date().toLocaleDateString()
    }
  ] : []

  const dashboardProjects = roofDetectionResult ? [
    {
      name: "Active Analysis",
      location: `Roof Area: ${Math.round(detectedArea)} m²`,
      status: analysisState === "success" ? "Completed" : "In Progress",
      panels: estimatedPanels,
      savings: savingsPredictionResult?.annual_savings_currency ? `₹${Math.round(savingsPredictionResult.annual_savings_currency).toLocaleString('en-IN')}/yr` : "Calculating...",
      date: new Date().toLocaleDateString()
    }
  ] : []

  return (
    <div className="min-h-screen bg-background flex selection:bg-neon-blue/30 selection:text-white">
      <DashboardSidebar />

      <main className="flex-1 ml-64 min-h-screen">
        <header className="sticky top-0 z-30 glass border-b border-white/5 px-8 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-foreground tracking-tight">System Command Center</h1>
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                backendStatus === "checking" ? "bg-yellow-400" : backendStatus === "online" ? "bg-neon-green" : "bg-red-400"
              )} />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {backendStatus === "checking"
                  ? "Neural Link: Connecting..."
                  : backendStatus === "online"
                  ? `Neural Link: Online • ${modelsLoaded} Model${modelsLoaded !== 1 ? "s" : ""} Active`
                  : "Neural Link: Backend Offline — Run python run.py"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {backendStatus === "offline" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-400/10 border border-red-400/20 text-red-400 text-[10px] font-black uppercase tracking-widest">
                <WifiOff className="w-3 h-3" /> Backend Offline
              </div>
            )}
            {backendStatus === "online" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-neon-green/10 border border-neon-green/20 text-neon-green text-[10px] font-black uppercase tracking-widest">
                <Wifi className="w-3 h-3" /> API Online
              </div>
            )}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-neon-blue" />
              <input
                type="text"
                placeholder="Search global assets..."
                className="glass rounded-2xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-white/5 focus:outline-none focus:border-neon-blue/40 w-64 transition-all"
              />
            </div>
            <button className="relative p-2.5 rounded-2xl glass border border-white/5 hover:border-neon-blue/30 transition-all group">
              <Bell className="w-5 h-5 text-muted-foreground group-hover:text-neon-blue transition-colors" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-neon-blue glow-blue border-2 border-background" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-[1600px] mx-auto page-transition">

          {analysisState === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-[3rem] p-16 border border-white/5 flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-neon-blue/5 blur-[100px] pointer-events-none" />
              <div className="w-24 h-24 rounded-full bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center relative z-10">
                <Camera className="w-10 h-10 text-neon-blue glow-blue" />
              </div>
              <div className="space-y-4 relative z-10">
                <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">No Analysis Available</h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto">
                  Upload a satellite roof image to our AI engine to generate detailed structural, solar, and financial models.
                </p>
              </div>
              <button
                onClick={() => router.push('/roof-detection')}
                className="relative z-10 px-8 py-4 rounded-2xl bg-neon-blue text-background text-xs font-black uppercase tracking-widest glow-blue hover:bg-neon-blue/90 transition-all flex items-center gap-3"
              >
                <Upload className="w-4 h-4" /> Start Roof Analysis
              </button>
            </motion.div>
          )}

          {analysisState !== "idle" && (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {dashboardMetrics.map((m, i) => {
                  const Icon = m.icon
                  return (
                    <motion.div
                      key={m.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="glass rounded-3xl p-6 border border-white/5 hover:border-neon-blue/20 transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 blur-3xl -mr-16 -mt-16 group-hover:bg-neon-blue/10 transition-all" />
                      <div className="flex items-start justify-between mb-6">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                          m.color === "neon-blue" ? "bg-neon-blue/10 border border-neon-blue/20 glow-blue" : "bg-neon-green/10 border border-neon-green/20 glow-green"
                        )}>
                          <Icon className={cn("w-6 h-6", m.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")} />
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                          m.up ? "text-neon-green border-neon-green/20 bg-neon-green/5" : "text-red-400 border-red-400/20 bg-red-400/5"
                        )}>
                          {m.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {m.delta}
                        </div>
                      </div>
                      {loading ? (
                        <div className="space-y-2">
                          <div className="h-8 w-24 skeleton" />
                          <div className="h-3 w-16 skeleton" />
                        </div>
                      ) : (
                        <>
                          <p className="text-3xl font-bold text-foreground tracking-tight mb-1">{m.value}</p>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                        </>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {engineeringWarnings.length > 0 && (
                <div className="glass rounded-[2rem] p-6 border border-yellow-400/20 flex items-start gap-5 bg-yellow-400/[0.02]">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black text-yellow-400 uppercase tracking-[0.2em]">⚠ Engineering Validation Warning</p>
                    <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                      {engineeringWarnings.join(" ")} Adjusted capacity: {capacity.toFixed(2)} kWp
                      {roofDetectionResult?.maximum_feasible_capacity_kwp
                        ? `, maximum feasible capacity: ${roofDetectionResult.maximum_feasible_capacity_kwp.toFixed(2)} kWp.`
                        : "."}
                    </p>
                  </div>
                </div>
              )}

              {/* Core Analytics Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="lg:col-span-2 glass rounded-[2rem] p-8 border border-white/5 relative"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Spectral Energy Flow</h3>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">10-Year Savings Forecast</p>
                    </div>
                    <div className="flex gap-4 p-1 rounded-xl bg-white/5">
                      <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-neon-blue bg-neon-blue/10">Yearly</button>
                    </div>
                  </div>
                  {loading ? (
                    <div className="w-full h-[280px] skeleton rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={energyData}>
                        <defs>
                          <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-neon-blue)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--color-neon-blue)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
                        <Area
                          type="monotone"
                          dataKey="savings"
                          name="Savings"
                          stroke="var(--color-neon-blue)"
                          strokeWidth={3}
                          fill="url(#gradPrimary)"
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass rounded-[2rem] p-8 border border-white/5 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <Thermometer className="w-5 h-5 text-neon-blue" />
                    <h3 className="text-lg font-bold text-foreground">Engineering Insights</h3>
                  </div>
                  <div className="space-y-4 flex-1">
                    {loading ? (
                      <div className="space-y-4">
                        <div className="h-24 w-full skeleton rounded-2xl" />
                        <div className="h-24 w-full skeleton rounded-2xl" />
                      </div>
                    ) : (
                      dashboardInsights.map((ins, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + (i * 0.1) }}
                          className="rounded-2xl p-5 border border-white/5 bg-white/3 hover:bg-white/5 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neon-blue">{ins.type}</span>
                            <ArrowUpRight className="w-3 h-3 text-muted-foreground group-hover:text-neon-blue transition-colors" />
                          </div>
                          <p className="text-xs font-medium text-muted-foreground leading-relaxed italic">&quot;{ins.msg}&quot;</p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Interactive Project Engine */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass rounded-[2rem] border border-white/5 overflow-hidden"
              >
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground tracking-tight">Active Deployment Fleet</h3>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Satellite Analysis History</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass border border-white/10 text-xs font-bold text-foreground hover:border-neon-blue/30 transition-all">
                      <Filter className="w-3.5 h-3.5" /> Filter
                    </button>
                    <button onClick={() => router.push('/roof-detection')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neon-blue text-background text-xs font-black uppercase tracking-wider hover:bg-neon-blue/90 transition-all glow-blue">
                      <Upload className="w-3.5 h-3.5" /> Deploy AI
                    </button>
                  </div>
                </div>
                <div className="table-container p-4">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asset Identity</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimated Panels</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Yield Savings</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="p-4"><div className="h-12 w-full skeleton rounded-xl" /></td>
                        </tr>
                      ) : (
                        dashboardProjects.map((p, i) => (
                          <motion.tr
                            key={p.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 + (i * 0.05) }}
                            className="group border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-5">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground group-hover:text-neon-blue transition-colors">{p.name}</span>
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{p.location}</span>
                              </div>
                            </td>
                            <td className="px-4 py-5">
                              <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border", statusColors[p.status] || "text-foreground border-white/20")}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-5 text-xs font-mono text-muted-foreground">{p.panels} panels</td>
                            <td className="px-4 py-5 text-sm font-black text-neon-green tracking-tight">{p.savings}</td>
                            <td className="px-4 py-5 text-right text-xs font-semibold text-muted-foreground">{p.date}</td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
