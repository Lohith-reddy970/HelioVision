"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useState } from "react"
import Image from "next/image"
import {
  ScanSearch, Sun, LayoutDashboard, ChevronRight, CheckCircle2,
  ArrowRight, ShieldCheck, Zap, Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

const modules = [
  {
    id: "roof-detection",
    title: "Roof Detection Interface",
    description: "High-precision satellite computer vision for instant rooftop geometry decoding.",
    icon: ScanSearch,
    image: "/dashboard-roof.png",
    color: "neon-blue" as const,
    link: "/roof-detection",
    features: [
      "Sub-centimeter YOLOv8 bounding boxes",
      "Automatic obstacle & shadow exclusion",
      "Real-time latency (< 2.5s)",
      "Multi-roof batch processing support"
    ]
  },
  {
    id: "solar-estimation",
    title: "Energy & ROI Dashboard",
    description: "Deep financial and thermal simulation matrix for hyper-local yield forecasting.",
    icon: Sun,
    image: "/dashboard-solar.png",
    color: "neon-green" as const,
    link: "/solar-estimation",
    features: [
      "25-Year deterministic financial simulation",
      "Cloud pattern & local shading adjustments",
      "Hourly, Monthly, and Annual kWh yields",
      "Detailed NPV and Payback period metrics"
    ]
  },
  {
    id: "admin-analytics",
    title: "System Administration",
    description: "Global intelligence layer to monitor node health, API loads, and fleet metrics.",
    icon: LayoutDashboard,
    image: "/dashboard-admin.png",
    color: "neon-blue" as const,
    link: "/dashboard",
    features: [
      "Live global node activity map",
      "Real-time server health & API load tracking",
      "Historical data analysis & export",
      "User & tenant access management"
    ]
  }
]

export function PlatformModules() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })
  const [activeModule, setActiveModule] = useState(0)

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-neon-blue/5 blur-[200px] rounded-full pointer-events-none opacity-40" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-neon-green/5 blur-[160px] rounded-full pointer-events-none opacity-20" />

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
              User Dashboards
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            System <span className="text-neon-blue text-glow-blue">Interfaces</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-muted-foreground font-medium leading-relaxed max-w-xl mx-auto"
          >
            Interactive views designed to present complex machine learning outputs in an accessible format.
          </motion.p>
        </div>

        {/* Desktop Grid Layout (Hidden on Mobile) */}
        <div className="hidden lg:grid grid-cols-3 gap-8">
          {modules.map((mod, idx) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 + idx * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="group relative flex flex-col h-full"
            >
              <div className={cn(
                "glass rounded-[2.5rem] border border-white/5 p-2 transition-all duration-500 overflow-hidden relative flex-1 flex flex-col",
                mod.color === "neon-blue" ? "hover:border-neon-blue/30" : "hover:border-neon-green/30"
              )}>
                {/* Image Container with Hover Zoom */}
                <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden mb-6 border border-white/5">
                   <div className={cn(
                      "absolute inset-0 z-10 transition-opacity duration-500 opacity-0 group-hover:opacity-100",
                      mod.color === "neon-blue" ? "bg-neon-blue/10" : "bg-neon-green/10"
                   )} />
                  <Image 
                    src={mod.image} 
                    alt={mod.title} 
                    fill 
                    className="object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  {/* Floating Action Button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">
                     <Link href={mod.link} className={cn(
                        "w-16 h-16 rounded-full glass border flex items-center justify-center transition-transform hover:scale-110",
                        mod.color === "neon-blue" ? "border-neon-blue/30 text-neon-blue glow-blue" : "border-neon-green/30 text-neon-green glow-green"
                     )}>
                        <ArrowRight className="w-6 h-6" />
                     </Link>
                  </div>
                </div>

                <div className="px-6 pb-6 flex-1 flex flex-col">
                  {/* Title & Icon */}
                  <div className="flex items-center gap-4 mb-4">
                     <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-500 group-hover:scale-110",
                        mod.color === "neon-blue" ? "bg-neon-blue/10 border-neon-blue/20 text-neon-blue glow-blue" : "bg-neon-green/10 border-neon-green/20 text-neon-green glow-green"
                     )}>
                        <mod.icon className="w-6 h-6" />
                     </div>
                     <h3 className="text-xl font-black italic uppercase tracking-tight">{mod.title}</h3>
                  </div>

                  <p className="text-sm text-muted-foreground font-medium mb-6 leading-relaxed flex-1">
                     {mod.description}
                  </p>

                  {/* Feature List */}
                  <ul className="space-y-3 mb-6">
                     {mod.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2 text-[11px] font-semibold text-muted-foreground/80">
                           <CheckCircle2 className={cn(
                              "w-3.5 h-3.5 mt-0.5 shrink-0",
                              mod.color === "neon-blue" ? "text-neon-blue" : "text-neon-green"
                           )} />
                           {feature}
                        </li>
                     ))}
                  </ul>

                  {/* Bottom Accent */}
                  <div className={cn(
                     "h-[2px] w-0 group-hover:w-full transition-all duration-700 ease-out rounded-full mt-auto",
                     mod.color === "neon-blue" ? "bg-neon-blue" : "bg-neon-green"
                  )} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile Carousel Layout (Hidden on Desktop) */}
        <div className="lg:hidden relative">
           <div className="overflow-hidden">
              <motion.div 
                 className="flex transition-transform duration-500 ease-out"
                 style={{ transform: `translateX(-${activeModule * 100}%)` }}
              >
                 {modules.map((mod, idx) => (
                    <div key={mod.id} className="w-full shrink-0 px-2">
                       <div className={cn(
                          "glass rounded-[2rem] border border-white/5 p-2 overflow-hidden relative flex flex-col",
                          mod.color === "neon-blue" ? "border-neon-blue/20" : "border-neon-green/20"
                       )}>
                          <div className="relative aspect-[4/3] rounded-[1.5rem] overflow-hidden mb-6 border border-white/5">
                             <Image src={mod.image} alt={mod.title} fill className="object-cover" />
                             <Link href={mod.link} className="absolute inset-0 z-20" />
                          </div>
                          <div className="px-5 pb-5">
                             <div className="flex items-center gap-3 mb-3">
                                <div className={cn(
                                   "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                   mod.color === "neon-blue" ? "bg-neon-blue/10 border-neon-blue/20 text-neon-blue" : "bg-neon-green/10 border-neon-green/20 text-neon-green"
                                )}>
                                   <mod.icon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black italic uppercase tracking-tight">{mod.title}</h3>
                             </div>
                             <p className="text-xs text-muted-foreground font-medium mb-5">
                                {mod.description}
                             </p>
                             <ul className="space-y-2">
                                {mod.features.slice(0,3).map((feature, fIdx) => (
                                   <li key={fIdx} className="flex items-start gap-2 text-[10px] font-semibold text-muted-foreground/80">
                                      <CheckCircle2 className={cn("w-3 h-3 mt-0.5 shrink-0", mod.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")} />
                                      {feature}
                                   </li>
                                ))}
                             </ul>
                          </div>
                       </div>
                    </div>
                 ))}
              </motion.div>
           </div>
           
           {/* Carousel Controls */}
           <div className="flex items-center justify-center gap-3 mt-8">
              {modules.map((_, idx) => (
                 <button
                    key={idx}
                    onClick={() => setActiveModule(idx)}
                    className={cn(
                       "w-2 h-2 rounded-full transition-all duration-300",
                       activeModule === idx ? "w-6 bg-neon-blue glow-blue" : "bg-white/20"
                    )}
                 />
              ))}
           </div>
        </div>
      </div>
    </section>
  )
}
