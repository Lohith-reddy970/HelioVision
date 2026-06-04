"use client"

import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import Image from "next/image"
import {
  ScanSearch, Ruler, Sun, TrendingUp, Leaf, LayoutGrid,
  CheckCircle2, Zap, ArrowRight, Sparkles,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
} from "recharts"
import { cn } from "@/lib/utils"

/* ─── Animated counter hook ───────────────────────────────────────────────── */

function useAnimatedCounter(target: number, duration: number, isInView: boolean, decimals = 0) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const controls = animate(0, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Number(v.toFixed(decimals))),
    })
    return () => controls.stop()
  }, [isInView, target, duration, decimals])

  return value
}

/* ─── Chart data ──────────────────────────────────────────────────────────── */

const monthlyGeneration = [
  { month: "Jan", kwh: 480 },
  { month: "Feb", kwh: 520 },
  { month: "Mar", kwh: 620 },
  { month: "Apr", kwh: 680 },
  { month: "May", kwh: 740 },
  { month: "Jun", kwh: 760 },
  { month: "Jul", kwh: 720 },
  { month: "Aug", kwh: 690 },
  { month: "Sep", kwh: 610 },
  { month: "Oct", kwh: 550 },
  { month: "Nov", kwh: 460 },
  { month: "Dec", kwh: 370 },
]

const energySplit = [
  { name: "Self-consumption", value: 70, fill: "var(--color-neon-blue)" },
  { name: "Grid export", value: 30, fill: "var(--color-neon-green)" },
]

const efficiencyData = [
  { name: "Efficiency", value: 94.2, fill: "var(--color-neon-green)" },
]

/* ─── Detection overlay boxes — YOLO-style ────────────────────────────────── */

const detectionBoxes = [
  // Primary target roof (center, red)
  { x: "22%", y: "20%", w: "56%", h: "55%", label: "Roof", conf: "98.7%", primary: true },
  // Surrounding detected roofs (pink/magenta)
  { x: "1%",  y: "2%",  w: "22%", h: "28%", label: "Roof", conf: "94.1%", primary: false },
  { x: "1%",  y: "35%", w: "18%", h: "26%", label: "Roof", conf: "92.8%", primary: false },
  { x: "1%",  y: "68%", w: "22%", h: "30%", label: "Roof", conf: "91.3%", primary: false },
  { x: "78%", y: "3%",  w: "21%", h: "27%", label: "Roof", conf: "93.5%", primary: false },
  { x: "80%", y: "36%", w: "19%", h: "25%", label: "Roof", conf: "90.7%", primary: false },
  { x: "78%", y: "70%", w: "21%", h: "28%", label: "Roof", conf: "92.1%", primary: false },
  { x: "30%", y: "1%",  w: "20%", h: "18%", label: "Roof", conf: "89.4%", primary: false },
  { x: "55%", y: "1%",  w: "20%", h: "18%", label: "Roof", conf: "88.9%", primary: false },
  { x: "30%", y: "82%", w: "20%", h: "17%", label: "Roof", conf: "90.2%", primary: false },
  { x: "55%", y: "82%", w: "20%", h: "17%", label: "Roof", conf: "91.6%", primary: false },
]

/* ─── Stat metric card ────────────────────────────────────────────────────── */

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  index,
  isInView,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  unit?: string
  color: "neon-blue" | "neon-green"
  index: number
  isInView: boolean
}) {
  const isBlue = color === "neon-blue"
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.6 + index * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass rounded-2xl p-4 border border-white/5 hover:border-neon-blue/20 transition-all group relative overflow-hidden"
    >
      <div
        className={cn(
          "absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none",
          isBlue ? "bg-neon-blue" : "bg-neon-green"
        )}
      />
      <div className="flex items-center gap-3 mb-2">
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
            isBlue
              ? "bg-neon-blue/10 border border-neon-blue/20"
              : "bg-neon-green/10 border border-neon-green/20"
          )}
        >
          <Icon className={cn("w-4 h-4", isBlue ? "text-neon-blue" : "text-neon-green")} />
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-xl font-black text-foreground tracking-tighter italic">
        {value}
        {unit && <span className="text-xs font-bold text-muted-foreground ml-1">{unit}</span>}
      </p>
    </motion.div>
  )
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function SampleAnalysis() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })
  const [showDetections, setShowDetections] = useState(false)

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => setShowDetections(true), 800)
      return () => clearTimeout(timer)
    }
  }, [isInView])

  // Animated counters
  const roofArea = useAnimatedCounter(148, 1.5, isInView)
  const panels = useAnimatedCounter(37, 1.5, isInView)
  const annualGen = useAnimatedCounter(7200, 2, isInView)
  const annualSavings = useAnimatedCounter(47000, 2, isInView)
  const roiYears = useAnimatedCounter(5.4, 1.5, isInView, 1)
  const co2 = useAnimatedCounter(3.2, 1.5, isInView, 1)

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/4 right-0 w-[700px] h-[700px] bg-neon-blue/5 blur-[180px] rounded-full pointer-events-none opacity-30" />
      <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-neon-green/5 blur-[160px] rounded-full pointer-events-none opacity-25" />

      <div className="container px-6 mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 glass rounded-full px-6 py-2 border border-white/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-green">
              Output Visualization
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            Analysis <span className="text-neon-blue text-glow-blue">Results</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-muted-foreground font-medium leading-relaxed max-w-xl mx-auto"
          >
            A demonstration of the system&apos;s output, showing detected roof segments and calculated solar metrics.
          </motion.p>
        </div>

        {/* Split-screen layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* ── LEFT: Input Image Preview ──────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="glass rounded-[2.5rem] border border-white/5 overflow-hidden relative group"
          >
            {/* Header bar */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center">
                  <ScanSearch className="w-4 h-4 text-neon-blue" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight text-foreground">
                    Input: Roof Image
                  </p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    Satellite Capture • 4K Resolution
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse glow-green" />
                <span className="text-[9px] font-black text-neon-green uppercase tracking-widest">
                  Processed
                </span>
              </div>
            </div>

            {/* Image with detection overlays */}
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src="/sample-roof.png"
                alt="Residential rooftop satellite view"
                fill
                className="object-cover"
                priority
              />

              {/* Scanning beam animation */}
              <motion.div
                initial={{ y: "-100%" }}
                animate={isInView ? { y: "200%" } : {}}
                transition={{ delay: 0.5, duration: 2, ease: "linear" }}
                className="absolute left-0 right-0 h-[3px] bg-neon-blue glow-blue z-10 pointer-events-none"
              />

              {/* Detection bounding boxes — YOLO style */}
              {detectionBoxes.map((box, i) => {
                const borderColor = box.primary ? "rgba(239, 68, 68, 0.85)" : "rgba(236, 72, 153, 0.6)"
                const bgColor = box.primary ? "rgba(239, 68, 68, 0.08)" : "rgba(236, 72, 153, 0.04)"
                const labelBg = box.primary ? "rgb(239, 68, 68)" : "rgb(236, 72, 153)"
                const borderWidth = box.primary ? 3 : 2

                return (
                  <motion.div
                    key={`${box.label}-${i}`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={showDetections ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute z-20"
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                      border: `${borderWidth}px solid ${borderColor}`,
                      borderRadius: "2px",
                      backgroundColor: bgColor,
                    }}
                  >
                    {/* Label tag */}
                    <div
                      className="absolute -top-[18px] left-0 flex items-center"
                      style={{ gap: "4px" }}
                    >
                      <span
                        className="text-[7px] font-black uppercase tracking-wider text-white px-1.5 py-[1px] leading-tight"
                        style={{ backgroundColor: labelBg, borderRadius: "2px" }}
                      >
                        {box.label} {box.conf}
                      </span>
                    </div>
                  </motion.div>
                )
              })}

              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background/80 to-transparent pointer-events-none z-30" />
            </div>

            {/* Detection summary footer */}
            <div className="px-6 py-4 flex items-center justify-between border-t border-white/5">
              <div className="flex items-center gap-4">
                {[
                  { label: "Detected", value: "11 Roofs" },
                  { label: "Confidence", value: "93.8% Avg" },
                  { label: "Latency", value: "1.2s" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="text-xs font-black text-foreground tracking-tight">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />
                <span className="text-[9px] font-black text-neon-green uppercase tracking-widest">
                  Complete
                </span>
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT: Output Analytics Dashboard ─────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Top metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard icon={Ruler} label="Roof Area" value={`${roofArea} m²`} color="neon-blue" index={0} isInView={isInView} />
              <MetricCard icon={LayoutGrid} label="Panels" value={`${panels}`} unit="units" color="neon-green" index={1} isInView={isInView} />
              <MetricCard icon={Zap} label="Annual Generation" value={`${annualGen.toLocaleString("en-IN")}`} unit="kWh" color="neon-blue" index={2} isInView={isInView} />
              <MetricCard icon={TrendingUp} label="Annual Savings" value={`₹${annualSavings.toLocaleString("en-IN")}`} color="neon-green" index={3} isInView={isInView} />
              <MetricCard icon={Sun} label="ROI Period" value={`${roiYears}`} unit="years" color="neon-blue" index={4} isInView={isInView} />
              <MetricCard icon={Leaf} label="CO₂ Reduction" value={`${co2}`} unit="tons/yr" color="neon-green" index={5} isInView={isInView} />
            </div>

            {/* Monthly Generation Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.9, duration: 0.7 }}
              className="glass rounded-[2rem] p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-sm font-black uppercase italic tracking-tight text-foreground">
                    Monthly Generation Forecast
                  </h4>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                    Predicted kWh output across 12 months
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-neon-blue glow-blue" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    kWh
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyGeneration} barCategoryGap="20%">
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 9, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.15)", fontSize: 9, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.85)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                    formatter={(value: number) => [`${value} kWh`, "Generation"]}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="kwh" radius={[6, 6, 0, 0]} animationDuration={2000}>
                    {monthlyGeneration.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i >= 3 && i <= 7 ? "var(--color-neon-blue)" : "var(--color-neon-blue)"}
                        fillOpacity={i >= 3 && i <= 7 ? 0.8 : 0.35}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Bottom row: Pie chart + Efficiency gauge */}
            <div className="grid grid-cols-2 gap-3">
              {/* Energy split donut */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.1, duration: 0.7 }}
                className="glass rounded-2xl p-5 border border-white/5"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  Energy Utilisation
                </p>
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={80} height={80}>
                    <PieChart>
                      <Pie
                        data={energySplit}
                        innerRadius={24}
                        outerRadius={36}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={1500}
                        strokeWidth={0}
                      >
                        {energySplit.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-blue" />
                      <span className="text-[9px] font-bold text-muted-foreground">
                        Self-use 70%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                      <span className="text-[9px] font-bold text-muted-foreground">
                        Export 30%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* System efficiency gauge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.2, duration: 0.7 }}
                className="glass rounded-2xl p-5 border border-white/5"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  System Efficiency
                </p>
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={80} height={80}>
                    <RadialBarChart
                      innerRadius="60%"
                      outerRadius="100%"
                      data={efficiencyData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={8}
                        background={{ fill: "rgba(255,255,255,0.03)" }}
                        animationDuration={2000}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="space-y-1">
                    <p className="text-2xl font-black tracking-tighter italic text-neon-green">
                      94.2%
                    </p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                      Panel Rating
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.4, duration: 0.7 }}
          className="text-center mt-16"
        >
          <a
            href="/roof-detection"
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-neon-blue text-background font-black uppercase tracking-[0.2em] text-xs glow-blue overflow-hidden transition-all hover:scale-105 active:scale-95 relative"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <span className="relative z-10 flex items-center gap-3">
              Try With Your Roof <ArrowRight className="w-4 h-4" />
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
