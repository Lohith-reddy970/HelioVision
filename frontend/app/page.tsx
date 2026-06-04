"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import Link from "next/link"
import { useRef } from "react"
import {
  Zap, Sun, Brain, BarChart3, Shield, ArrowRight, Star,
  ChevronRight, Check, Upload, Cpu, TrendingUp, Globe,
  Activity, Layers, MousePointer2
} from "lucide-react"
import { ParticleBackground } from "@/components/particle-background"
import { TopNav } from "@/components/nav"
import { AIWorkflow } from "@/components/ai-workflow"
import { SystemArchitecture } from "@/components/system-architecture"
import { AIComparison } from "@/components/ai-comparison"
import { RoofAnalytics } from "@/components/roof-analytics"
import { SampleAnalysis } from "@/components/sample-analysis"
import { PlatformStats } from "@/components/platform-stats"
import { cn } from "@/lib/utils"

const features = [
  {
    icon: Brain,
    title: "Computer Vision Segmentation",
    desc: "YOLOv8-based model for accurate rooftop detection and usable area calculation from satellite imagery.",
    color: "neon-blue",
  },
  {
    icon: Sun,
    title: "Solar Irradiance Estimation",
    desc: "Location-based solar potential modeling factoring in meteorological data and roof orientation.",
    color: "neon-green",
  },
  {
    icon: BarChart3,
    title: "Financial ROI Prediction",
    desc: "Data-driven forecasting of energy generation, payback period, and environmental impact.",
    color: "neon-blue",
  },
]

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-neon-blue/30 selection:text-white overflow-x-hidden">
      <ParticleBackground />
      <TopNav />

      {/* Hero Section - Billion Dollar Aesthetic */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-neon-blue/5 blur-[160px] rounded-full opacity-50" />
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-neon-green/5 blur-[140px] rounded-full opacity-30" />
          <div className="absolute inset-0 opacity-[0.03]" 
               style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <div className="container relative z-10 px-6 mx-auto">
          <div className="max-w-5xl mx-auto text-center space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 glass rounded-full px-6 py-2 border border-white/10"
            >
              <div className="w-2 h-2 rounded-full bg-neon-blue animate-pulse glow-blue" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-blue">Solar Potential Analyzer</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] italic uppercase"
            >
              AI-Powered <br />
              <span className="text-neon-blue text-glow-blue">Solar</span>{" "}
              <span className="text-neon-green text-glow-green">Assessment</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground font-medium leading-relaxed"
            >
              Leveraging computer vision and machine learning to estimate rooftop solar potential, forecast energy generation, and predict financial ROI.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Link
                href="/roof-detection"
                className="group relative px-10 py-5 rounded-2xl bg-neon-blue text-background font-black uppercase tracking-[0.2em] text-xs glow-blue overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative z-10 flex items-center gap-3">
                  View Live Demo <ScanLine className="w-4 h-4" />
                </span>
              </Link>

            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-40 grayscale hover:grayscale-0 transition-all duration-700"
            >
              {["REACT", "NEXT.JS", "FASTAPI", "YOLOv8"].map((brand) => (
                <div key={brand} className="text-sm font-black tracking-[0.4em] text-center">{brand}</div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Floating Scanner Visual */}
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-full max-w-6xl pointer-events-none opacity-20"
        >
          <div className="aspect-[21/9] glass rounded-[4rem] border border-neon-blue/20 neon-border-moving overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
             <div className="absolute top-0 left-0 right-0 h-[2px] bg-neon-blue glow-blue animate-scan" />
          </div>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <section className="py-32 relative z-10">
        <div className="container px-6 mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-[2.5rem] p-10 border border-white/5 hover:border-neon-blue/20 transition-all group"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110 group-hover:rotate-6",
                  f.color === "neon-blue" ? "bg-neon-blue/10 border border-neon-blue/20 glow-blue" : "bg-neon-green/10 border border-neon-green/20 glow-green"
                )}>
                  <f.icon className={cn("w-7 h-7", f.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")} />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tight mb-4">{f.title}</h3>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Workflow Pipeline */}
      <AIWorkflow />

      {/* System Architecture */}
      <SystemArchitecture />

      {/* AI Comparison */}
      <AIComparison />

      {/* Roof Analytics Dashboard */}
      <RoofAnalytics />

      {/* Sample AI Analysis */}
      <SampleAnalysis />

      {/* Platform Intelligence */}
      <PlatformStats />

      {/* Global Impact Matrix */}
      <section className="py-32 relative overflow-hidden">
        <div className="container px-6 mx-auto relative z-10">
          <div className="glass rounded-[4rem] p-16 border border-white/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                <Globe className="w-64 h-64 text-neon-blue" />
             </div>
              <div className="max-w-2xl space-y-8">
                <h2 className="text-5xl font-black italic uppercase tracking-tighter">System Performance</h2>
                <p className="text-muted-foreground font-medium leading-relaxed">
                   A robust and scalable architecture designed for high-throughput image processing and accurate machine learning inference.
                </p>
                <div className="grid grid-cols-2 gap-12">
                   <div>
                      <p className="text-4xl font-black text-neon-blue tracking-tighter italic">&lt;3s</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Inference Latency</p>
                   </div>
                   <div>
                      <p className="text-4xl font-black text-neon-green tracking-tighter italic">92%</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-2">Detection mAP50</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 relative z-10">
        <div className="container px-6 mx-auto flex flex-col md:flex-row items-center justify-between gap-12 opacity-50">
           <div className="flex items-center gap-4">
              <Zap className="w-6 h-6 text-neon-blue" />
              <span className="text-xl font-black italic uppercase tracking-tighter">HelioVision</span>
           </div>
           <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.3em]">
              <a href="#" className="hover:text-neon-blue transition-colors">Documentation</a>
              <a href="#" className="hover:text-neon-blue transition-colors">Project Report</a>
              <a href="#" className="hover:text-neon-blue transition-colors">GitHub Repository</a>
           </div>
           <p className="text-[10px] font-bold uppercase tracking-widest">&copy; 2026 HelioVision</p>
        </div>
      </footer>
    </div>
  )
}

function ScanLine({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M3 17v2a2 2 0 0 1 2 2h2" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  )
}
