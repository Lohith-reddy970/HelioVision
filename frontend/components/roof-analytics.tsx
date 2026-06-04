"use client"

import { motion, useInView, animate } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import { 
  Ruler, Maximize, Home, Compass, 
  Activity, LayoutGrid, Sparkles 
} from "lucide-react"
import { cn } from "@/lib/utils"

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

export function RoofAnalytics() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  // Animated metric values
  const roofArea = useAnimatedCounter(148.5, 1.5, isInView, 1)
  const usableArea = useAnimatedCounter(110.2, 1.5, isInView, 1)
  const suitabilityScore = useAnimatedCounter(92.4, 2, isInView, 1)
  const panelCount = useAnimatedCounter(37, 2, isInView, 0)

  const metrics = [
    {
      label: "Total Roof Area",
      value: `${roofArea}`,
      unit: "m²",
      desc: "Gross surface area detected via computer vision",
      icon: Ruler,
      color: "neon-blue" as const,
      isAnimated: true,
    },
    {
      label: "Usable Area",
      value: `${usableArea}`,
      unit: "m²",
      desc: "Net space viable for solar panel installation",
      icon: Maximize,
      color: "neon-green" as const,
      isAnimated: true,
    },
    {
      label: "Roof Type",
      value: "Gable",
      unit: "",
      desc: "Architectural classification of the structure",
      icon: Home,
      color: "neon-blue" as const,
      isAnimated: false,
    },
    {
      label: "Roof Orientation",
      value: "South-East",
      unit: "",
      desc: "Azimuth angle yielding optimal solar exposure",
      icon: Compass,
      color: "neon-green" as const,
      isAnimated: false,
    },
    {
      label: "Solar Suitability",
      value: `${suitabilityScore}`,
      unit: "%",
      desc: "Overall confidence score for high-yield generation",
      icon: Activity,
      color: "neon-blue" as const,
      isAnimated: true,
    },
    {
      label: "Panel Count",
      value: `${panelCount}`,
      unit: "units",
      desc: "Recommended modules based on standard 400W dimensions",
      icon: LayoutGrid,
      color: "neon-green" as const,
      isAnimated: true,
    },
  ]

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-neon-blue/5 blur-[200px] rounded-full pointer-events-none opacity-40" />

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
              Geospatial Metrics
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            Roof <span className="text-neon-blue text-glow-blue">Analytics</span> Dashboard
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-muted-foreground font-medium leading-relaxed max-w-xl mx-auto text-lg"
          >
            Detailed geometric and structural analysis of the targeted building for optimal solar deployment.
          </motion.p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {metrics.map((metric, i) => {
            const Icon = metric.icon
            const isBlue = metric.color === "neon-blue"

            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="group relative glass rounded-[2rem] p-8 border border-white/5 hover:border-white/10 transition-all overflow-hidden"
              >
                {/* Hover glow */}
                <div
                  className={cn(
                    "absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none",
                    isBlue ? "bg-neon-blue" : "bg-neon-green"
                  )}
                />

                <div className="flex items-start justify-between mb-6">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110",
                      isBlue
                        ? "bg-neon-blue/10 border border-neon-blue/20 glow-blue"
                        : "bg-neon-green/10 border border-neon-green/20 glow-green"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        isBlue ? "text-neon-blue" : "text-neon-green"
                      )}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      {metric.label}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-4xl font-black text-foreground tracking-tighter italic">
                    {metric.value}
                    {metric.unit && (
                      <span className={cn(
                        "text-sm font-bold ml-1.5",
                        isBlue ? "text-neon-blue/70" : "text-neon-green/70"
                      )}>
                        {metric.unit}
                      </span>
                    )}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                    {metric.desc}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
