"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import {
  Upload, ScanSearch, Ruler, Sun, BarChart3, TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

const steps = [
  {
    icon: Upload,
    title: "Upload Roof Image",
    desc: "Ingest high-resolution satellite, aerial, or drone imagery of the target structure into the pipeline.",
    color: "neon-blue" as const,
  },
  {
    icon: ScanSearch,
    title: "YOLOv8 Roof Detection",
    desc: "A custom-trained YOLOv8 convolutional neural network segments rooftop boundaries and identifies obstructions.",
    color: "neon-green" as const,
  },
  {
    icon: Ruler,
    title: "Roof Area Calculation",
    desc: "Algorithms calculate the exact usable square footage of the roof surface, factoring in pitch and orientation.",
    color: "neon-blue" as const,
  },
  {
    icon: Sun,
    title: "Solar Irradiance Analysis",
    desc: "Cross-references geolocation coordinates with solar databases to map annual Global Horizontal Irradiance.",
    color: "neon-green" as const,
  },
  {
    icon: BarChart3,
    title: "Energy Generation Forecast",
    desc: "Machine learning models simulate system capacity to forecast hourly and annual AC electricity yield (kWh).",
    color: "neon-blue" as const,
  },
  {
    icon: TrendingUp,
    title: "Savings & ROI Prediction",
    desc: "Calculates the financial payback period, long-term ROI, and carbon offset based on local utility tariffs.",
    color: "neon-green" as const,
  },
]

export function AIWorkflow() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-neon-blue/5 blur-[180px] rounded-full pointer-events-none opacity-40" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-neon-green/5 blur-[160px] rounded-full pointer-events-none opacity-30" />

      <div className="container px-6 mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 glass rounded-full px-6 py-2 border border-white/10"
          >
            <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse glow-green" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-green">
              Machine Learning Pipeline
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            How SolarAI <span className="text-neon-blue text-glow-blue">Works</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-muted-foreground font-medium leading-relaxed max-w-xl mx-auto text-lg"
          >
            From rooftop imagery to financial forecasting in seconds.
          </motion.p>
        </div>

        {/* Workflow Grid */}
        <div className="relative">
          {/* Animated horizontal connector line (desktop only) */}
          <div className="hidden lg:block absolute top-[4.5rem] left-[8%] right-[8%] h-px z-0">
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-white/5" />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={isInView ? { scaleX: 1 } : {}}
                transition={{ delay: 0.4, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 origin-left"
              >
                <div className="h-full bg-gradient-to-r from-neon-blue/60 via-neon-green/40 to-neon-blue/60" />
              </motion.div>
              {/* Animated pulse traveling along the line */}
              <motion.div
                initial={{ x: "-10%", opacity: 0 }}
                animate={isInView ? { x: "110%", opacity: [0, 1, 1, 0] } : {}}
                transition={{
                  delay: 1.5,
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 1,
                  ease: "linear",
                }}
                className="absolute top-1/2 -translate-y-1/2 w-16 h-[3px] bg-gradient-to-r from-transparent via-neon-blue to-transparent glow-blue rounded-full"
              />
            </div>
          </div>

          {/* Step Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon
              const isBlue = step.color === "neon-blue"

              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    delay: 0.3 + i * 0.12,
                    duration: 0.7,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="group relative"
                >
                  <div className="glass rounded-[2rem] p-6 border border-white/5 hover:border-neon-blue/30 transition-all duration-500 h-full flex flex-col items-center text-center relative overflow-hidden group-hover:scale-[1.03]">
                    {/* Hover glow */}
                    <div
                      className={cn(
                        "absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none",
                        isBlue ? "bg-neon-blue" : "bg-neon-green"
                      )}
                    />

                    {/* Step number badge */}
                    <div className="absolute top-4 right-4">
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-[0.3em] px-2 py-0.5 rounded-md border",
                          isBlue
                            ? "text-neon-blue/50 border-neon-blue/10 bg-neon-blue/5"
                            : "text-neon-green/50 border-neon-green/10 bg-neon-green/5"
                        )}
                      >
                        0{i + 1}
                      </span>
                    </div>

                    {/* Icon container with animated ring */}
                    <div className="relative mb-6 mt-2">
                      {/* Outer pulse ring */}
                      <motion.div
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.2, 0, 0.2],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          delay: i * 0.3,
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
                            "w-7 h-7 transition-transform duration-500 group-hover:scale-110",
                            isBlue ? "text-neon-blue" : "text-neon-green"
                          )}
                        />
                      </div>
                    </div>

                    {/* Text */}
                    <h3 className="text-sm font-black italic uppercase tracking-tight mb-3 leading-tight">
                      {step.title}
                    </h3>
                    <p className="text-[11px] font-medium text-muted-foreground leading-relaxed flex-1">
                      {step.desc}
                    </p>

                    {/* Bottom progress accent */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={isInView ? { width: "60%" } : {}}
                      transition={{ delay: 0.8 + i * 0.15, duration: 0.8, ease: "easeOut" }}
                      className={cn(
                        "h-[2px] rounded-full mt-5",
                        isBlue ? "bg-neon-blue/40" : "bg-neon-green/40"
                      )}
                    />
                  </div>

                  {/* Mobile/tablet connector arrow (hidden on xl) */}
                  {i < steps.length - 1 && (
                    <div className="xl:hidden flex justify-center py-2">
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={isInView ? { opacity: 0.3, y: 0 } : {}}
                        transition={{ delay: 0.5 + i * 0.12 }}
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-neon-blue sm:hidden">
                          <path d="M10 4L10 16M10 16L5 11M10 16L15 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
