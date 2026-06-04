"use client"

import { motion, useInView, animate } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import { Images, Target, Timer, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── Animated counter ────────────────────────────────────────────────────── */

function AnimatedCounter({
  target,
  duration = 2,
  decimals = 0,
  isInView,
}: {
  target: number
  duration?: number
  decimals?: number
  isInView: boolean
}) {
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

/* ─── Stats data ──────────────────────────────────────────────────────────── */

const stats = [
  {
    icon: Images,
    value: 5000,
    suffix: "+",
    prefix: "",
    label: "Dataset Size",
    sub: "Training & Validation",
    color: "neon-blue" as const,
  },
  {
    icon: Target,
    value: 92,
    suffix: "%",
    prefix: "",
    label: "Detection Accuracy",
    sub: "YOLOv8 mAP50",
    color: "neon-green" as const,
  },
  {
    icon: Timer,
    value: 5,
    suffix: "s",
    prefix: "<",
    label: "Average Latency",
    sub: "End-to-End Pipeline",
    color: "neon-blue" as const,
  },
  {
    icon: Calendar,
    value: 25,
    suffix: " Years",
    prefix: "",
    label: "ROI Forecast Horizon",
    sub: "Financial Simulation",
    color: "neon-green" as const,
  },
]

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function PlatformStats() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] bg-neon-blue/5 blur-[180px] rounded-full pointer-events-none opacity-30" />
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] bg-neon-green/5 blur-[160px] rounded-full pointer-events-none opacity-25" />

      <div className="container px-6 mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 glass rounded-full px-6 py-2 border border-white/10"
          >
            <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse glow-blue" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-blue">
              System Metrics
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            Project{" "}
            <span className="text-neon-green text-glow-green">Capabilities</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-muted-foreground font-medium leading-relaxed max-w-xl mx-auto"
          >
            Key performance indicators demonstrating the efficiency and accuracy of the implemented solution.
          </motion.p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            const isBlue = stat.color === "neon-blue"
            const count = AnimatedCounter({
              target: stat.value,
              duration: 2 + i * 0.3,
              isInView,
            })

            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  delay: 0.3 + i * 0.12,
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group relative"
              >
                <div className="glass rounded-[2.5rem] p-8 border border-white/5 hover:border-neon-blue/20 transition-all duration-500 text-center relative overflow-hidden h-full flex flex-col items-center justify-center group-hover:scale-[1.03]">
                  {/* Hover glow bloom */}
                  <div
                    className={cn(
                      "absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-25 transition-opacity duration-700 pointer-events-none",
                      isBlue ? "bg-neon-blue" : "bg-neon-green"
                    )}
                  />

                  {/* Icon with pulse ring */}
                  <div className="relative mb-6">
                    <motion.div
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.15, 0, 0.15],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: i * 0.4,
                      }}
                      className={cn(
                        "absolute inset-0 rounded-2xl",
                        isBlue ? "bg-neon-blue/20" : "bg-neon-green/20"
                      )}
                    />
                    <div
                      className={cn(
                        "relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
                        isBlue
                          ? "bg-neon-blue/10 border border-neon-blue/20 glow-blue"
                          : "bg-neon-green/10 border border-neon-green/20 glow-green"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-7 h-7",
                          isBlue ? "text-neon-blue" : "text-neon-green"
                        )}
                      />
                    </div>
                  </div>

                  {/* Animated number */}
                  <p
                    className={cn(
                      "text-5xl md:text-6xl font-black tracking-tighter italic mb-3 transition-colors",
                      isBlue ? "text-foreground group-hover:text-neon-blue" : "text-foreground group-hover:text-neon-green"
                    )}
                  >
                    {stat.prefix}
                    {count.toLocaleString("en-IN")}
                    {stat.suffix}
                  </p>

                  {/* Label */}
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                    {stat.sub}
                  </p>

                  {/* Bottom accent line */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={isInView ? { width: "50%" } : {}}
                    transition={{
                      delay: 0.8 + i * 0.15,
                      duration: 0.8,
                      ease: "easeOut",
                    }}
                    className={cn(
                      "h-[2px] rounded-full mt-6",
                      isBlue ? "bg-neon-blue/30" : "bg-neon-green/30"
                    )}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
