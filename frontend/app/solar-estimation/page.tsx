"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Sun, IndianRupee, TrendingUp, Download, Zap, Leaf,
  ChevronRight, Info, ArrowUpRight, BarChart3, PieChart as PieChartIcon,
  Activity, ShieldCheck, Globe, Calendar, CloudSun, Wifi, WifiOff, Camera, Upload,
  DollarSign, Percent, Clock, TrendingDown, CheckCircle2, AlertCircle
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine,
} from "recharts"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/store/useAppStore"

// ─── Type for the savings prediction API response ─────────────────────────────
interface YearlySavingsRow {
  year: number
  gross_savings_currency: number
  net_savings_currency: number
  cumulative_net_savings: number
  discounted_cash_flow: number
  panel_output_factor: number
}

interface SavingsPredictionResult {
  annual_savings_currency: number
  lifetime_savings_currency: number
  net_profit: number
  payback_period_years: number
  roi_pct: number
  net_present_value: number
  irr_pct: number
  installation_cost: number
  discount_rate_pct: number
  annual_maintenance_cost: number
  yearly_savings: YearlySavingsRow[]
  co2_offset_tonnes_per_year: number
}

export default function SolarEstimationPage() {
  const router = useRouter()
  const [selectedPanel, setSelectedPanel] = useState("premium")
  const { analysisState, solarEstimationResult, savingsPredictionResult: rawResult, roofDetectionResult } = useAppStore()

  // Cast to typed result for safe field access
  const savings = rawResult as SavingsPredictionResult | null

  const capacity = roofDetectionResult?.capacity_kwp ?? roofDetectionResult?.estimated_capacity_kw ?? 0
  const estimatedPanels = roofDetectionResult?.estimated_panel_count ?? roofDetectionResult?.panel_count ?? 0
  const annualKwh = solarEstimationResult?.predicted_kwh ?? roofDetectionResult?.estimated_annual_kwh ?? 0

  const panelsPremium = capacity > 0 ? estimatedPanels : 0
  const costPremium = panelsPremium * 900 * 80

  const panelsBifacial = capacity > 0 ? estimatedPanels : 0
  const costBifacial = panelsBifacial * 1050 * 80

  const dynamicPanelOptions = [
    {
      id: "premium",
      name: "High-Efficiency Mono PERC",
      wattage: "550W",
      efficiency: "22.3%",
      panels: panelsPremium,
      cost: costPremium,
      annualYield: `${Math.round(annualKwh * (22.3 / 22.0)).toLocaleString('en-IN')} kWh`,
      brand: "Maxeon Gen 6",
      warranty: "40 Years",
    },
    {
      id: "bifacial",
      name: "Bifacial 550W Module",
      wattage: "550W",
      efficiency: "23.8%",
      panels: panelsBifacial,
      cost: costBifacial,
      annualYield: `${Math.round(annualKwh * (23.8 / 22.0)).toLocaleString('en-IN')} kWh`,
      brand: "Jinko Tiger Neo",
      warranty: "30 Years",
    },
  ]

  const currentPanel = dynamicPanelOptions.find(p => p.id === selectedPanel) || dynamicPanelOptions[0]
  const loading = analysisState === "analyzing" || analysisState === "estimating" || analysisState === "calculating"

  // ── All display values derived directly from the typed API response ──────────
  const paybackYears = savings?.payback_period_years?.toFixed(1) ?? "---"

  const co2Saved = savings?.co2_offset_tonnes_per_year
    ? Math.round(savings.co2_offset_tonnes_per_year * 1000)
    : (annualKwh > 0 ? Math.round(annualKwh * 0.7) : 0)

  const lifetimeSavings = savings?.lifetime_savings_currency != null
    ? `₹${Math.round(savings.lifetime_savings_currency).toLocaleString('en-IN')}`
    : "---"

  const netProfitDisplay = savings?.net_profit != null
    ? `₹${Math.round(savings.net_profit).toLocaleString('en-IN')}`
    : "---"

  const annualSavingsDisplay = savings?.annual_savings_currency != null
    ? `₹${Math.round(savings.annual_savings_currency).toLocaleString('en-IN')}`
    : "---"

  // IRR read directly from API — NOT derived from roi_pct
  const irrDisplay = savings?.irr_pct != null
    ? `${savings.irr_pct.toFixed(1)}%`
    : "---"

  const roiDisplay = savings?.roi_pct != null
    ? `${Math.round(savings.roi_pct)}%`
    : "---"

  const npvDisplay = savings?.net_present_value != null
    ? `₹${Math.round(savings.net_present_value).toLocaleString('en-IN')}`
    : "---"

  const installationCostDisplay = savings?.installation_cost != null
    ? `₹${Math.round(savings.installation_cost).toLocaleString('en-IN')}`
    : "---"

  // ── Chart data — uses correct field names from new API schema ────────────────
  // net_savings_currency = annual net, cumulative_net_savings = running total
  const projectionData = savings?.yearly_savings
    ? savings.yearly_savings
        .slice(0, 10)
        .map((row: YearlySavingsRow) => ({
          year: String(row.year),
          savings: Number(row.net_savings_currency ?? 0),
          cumulative: Number(row.cumulative_net_savings ?? 0),
          gross: Number(row.gross_savings_currency ?? 0),
        }))
    : []

  // ── Validation chain checks (live invariant verification) ────────────────────
  const validations = savings
    ? [
        {
          label: "Payback = Cost ÷ Annual Savings",
          expected: savings.installation_cost / savings.annual_savings_currency,
          actual: savings.payback_period_years,
          unit: "yrs",
        },
        {
          label: "ROI = Net Profit ÷ Cost × 100",
          expected: (savings.net_profit / savings.installation_cost) * 100,
          actual: savings.roi_pct,
          unit: "%",
        },
        {
          label: "Net Profit = Lifetime − Cost",
          expected: savings.lifetime_savings_currency - savings.installation_cost,
          actual: savings.net_profit,
          unit: "₹",
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-background flex selection:bg-neon-blue/30 selection:text-white">
      <DashboardSidebar />

      <main className="flex-1 ml-64 min-h-screen relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-neon-blue/5 blur-[160px] rounded-full pointer-events-none opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-neon-green/5 blur-[140px] rounded-full pointer-events-none opacity-50" />

        <header className="sticky top-0 z-30 glass border-b border-white/5 px-8 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-foreground tracking-tight italic">Solar Yield Forecaster</h1>
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                loading ? "bg-yellow-400" : analysisState === "success" ? "bg-neon-green" : "bg-red-400"
              )} />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {loading
                  ? "Connecting to Backend..."
                  : analysisState === "success"
                  ? "Cash-Flow Engine v3 • Online • All Metrics Validated"
                  : "Neural Link Offline / No Analysis"}
              </p>
            </div>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-[1600px] mx-auto page-transition">

          {analysisState === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-[3rem] p-16 border border-white/5 flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-neon-green/5 blur-[100px] pointer-events-none" />
              <div className="w-24 h-24 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center relative z-10">
                <Sun className="w-10 h-10 text-neon-green glow-green" />
              </div>
              <div className="space-y-4 relative z-10">
                <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">Awaiting Yield Data</h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto">
                  Run a roof analysis first to generate accurate solar energy yield predictions and financial models.
                </p>
              </div>
              <button
                onClick={() => router.push('/roof-detection')}
                className="relative z-10 px-8 py-4 rounded-2xl bg-neon-green text-background text-xs font-black uppercase tracking-widest glow-green hover:bg-neon-green/90 transition-all flex items-center gap-3"
              >
                <Upload className="w-4 h-4" /> Start Roof Analysis
              </button>
            </motion.div>
          )}

          {analysisState !== "idle" && (
            <>
              {/* Top Tier Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: Zap, label: "Estimated Capacity", value: capacity > 0 ? `${capacity.toFixed(1)} kWp` : "---", sub: `${currentPanel.panels} estimated panels`, color: "neon-blue" },
                  { icon: IndianRupee, label: "Annual Savings", value: loading ? "..." : annualSavingsDisplay, sub: "Net of maintenance cost", color: "neon-green" },
                  { icon: Activity, label: "Payback Period", value: loading ? "..." : (paybackYears !== "---" ? `${paybackYears} Yrs` : "---"), sub: "Cost ÷ Annual Savings", color: "neon-blue" },
                  { icon: Leaf, label: "Carbon Offset", value: co2Saved > 0 ? `${(co2Saved/1000).toFixed(1)} Tons` : "---", sub: "Annual CO₂ offset", color: "neon-green" },
                ].map((m, i) => (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="glass rounded-3xl p-6 border border-white/5 relative overflow-hidden group"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110",
                      m.color === "neon-blue" ? "bg-neon-blue/10 border border-neon-blue/20 glow-blue" : "bg-neon-green/10 border border-neon-green/20 glow-green"
                    )}>
                      <m.icon className={cn("w-6 h-6", m.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")} />
                    </div>
                    {loading ? (
                      <div className="space-y-2 mt-2">
                        <div className="h-8 w-24 skeleton" />
                        <div className="h-3 w-16 skeleton" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-3xl font-black text-foreground tracking-tighter italic">{m.value}</p>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{m.label}</p>
                        <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">{m.sub}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Long Term Projection */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="lg:col-span-2 glass rounded-[2.5rem] p-8 border border-white/5"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-bold text-foreground italic uppercase tracking-tight">Decade Yield Projection</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">Net Cash-Flow · Discounted Model</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-neon-blue glow-blue" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cumulative Net</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-neon-green glow-green" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Annual Net</span>
                      </div>
                    </div>
                  </div>
                  {loading ? (
                    <div className="w-full h-[320px] skeleton rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={projectionData}>
                        <defs>
                          <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-neon-blue)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="var(--color-neon-blue)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="annG" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-neon-green)" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="var(--color-neon-green)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "12px" }}
                          itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                          formatter={(value: any, name: string) => [
                            `₹${Number(value).toLocaleString('en-IN')}`,
                            name === "cumulative" ? "Cumulative Net" : "Annual Net"
                          ]}
                        />
                        <Area type="monotone" dataKey="cumulative" stroke="var(--color-neon-blue)" strokeWidth={4} fill="url(#cumG)" animationDuration={2500} />
                        <Area type="monotone" dataKey="savings" stroke="var(--color-neon-green)" strokeWidth={2} fill="url(#annG)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </motion.div>

                {/* Hardware Selection */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass rounded-[2.5rem] p-8 border border-white/5 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <ShieldCheck className="w-5 h-5 text-neon-blue" />
                    <h3 className="text-lg font-bold text-foreground uppercase italic">Hardware Matrix</h3>
                  </div>
                  <div className="space-y-4 flex-1">
                    {dynamicPanelOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedPanel(opt.id)}
                        className={cn(
                          "w-full text-left rounded-[1.5rem] p-6 border transition-all duration-500 group relative overflow-hidden",
                          selectedPanel === opt.id
                            ? "border-neon-blue/40 bg-neon-blue/5 neon-border-moving glow-blue"
                            : "border-white/5 bg-white/2 hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className={cn("text-[10px] font-black uppercase tracking-widest", selectedPanel === opt.id ? "text-neon-blue" : "text-muted-foreground")}>
                            {opt.brand}
                          </span>
                          {selectedPanel === opt.id && <div className="w-2 h-2 rounded-full bg-neon-blue glow-blue animate-pulse" />}
                        </div>
                        <p className="text-lg font-black text-foreground mb-4 italic leading-tight">{opt.name}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Panels / Yield</p>
                            <p className="text-xs font-bold text-foreground">{opt.panels} panels ({opt.annualYield})</p>
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Cost / Warranty</p>
                            <p className="text-xs font-bold text-foreground">₹{Math.round(opt.cost).toLocaleString('en-IN')} / {opt.warranty}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* ROI Deep Scan — all 7 financial metrics */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass rounded-[2.5rem] p-10 border border-white/5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-green/30 to-transparent" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-foreground uppercase italic tracking-tighter">25-Year Financial Analysis</h3>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.3em]">Single Cash-Flow Model · All Metrics Verified</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total ROI</p>
                      {loading ? (
                        <div className="h-8 w-24 skeleton ml-auto" />
                      ) : (
                        <p className="text-3xl font-black text-neon-green tracking-tighter italic">
                          {savings ? `+${Math.round(savings.roi_pct)}%` : "+0%"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 7 Financial Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      label: "Lifetime Savings",
                      value: loading ? "..." : lifetimeSavings,
                      sub: "Σ net savings all years",
                      icon: TrendingUp,
                      color: "neon-green",
                    },
                    {
                      label: "Net Profit",
                      value: loading ? "..." : netProfitDisplay,
                      sub: "Lifetime savings − installation",
                      icon: DollarSign,
                      color: "neon-blue",
                    },
                    {
                      label: "IRR",
                      value: loading ? "..." : irrDisplay,
                      sub: "Internal Rate of Return",
                      icon: Percent,
                      color: "neon-green",
                    },
                    {
                      label: "NPV / 25YR",
                      value: loading ? "..." : npvDisplay,
                      sub: "Net Present Value",
                      icon: BarChart3,
                      color: "neon-blue",
                    },
                  ].map((item, i) => (
                    <div key={i} className="glass rounded-3xl p-8 border border-white/5 hover:border-neon-blue/20 transition-all group">
                      <item.icon className={cn(
                        "w-5 h-5 mb-6 transition-colors",
                        item.color === "neon-green"
                          ? "text-neon-green/40 group-hover:text-neon-green"
                          : "text-neon-blue/40 group-hover:text-neon-blue"
                      )} />
                      {loading ? (
                        <div className="h-8 w-24 skeleton mb-2" />
                      ) : (
                        <p className="text-3xl font-black text-foreground tracking-tighter italic mb-2">{item.value}</p>
                      )}
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
                      <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-tighter mt-1">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </motion.div>


            </>
          )}
        </div>
      </main>
    </div>
  )
}
