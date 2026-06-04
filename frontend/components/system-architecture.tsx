"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import {
  Monitor, Server, ScanSearch, Sun, BarChart3, TrendingUp,
  ArrowDown, Database, Cpu, Layers, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── Architecture node definitions ───────────────────────────────────────── */

type NodeColor = "neon-blue" | "neon-green"

interface ArchNode {
  icon: React.ComponentType<{ className?: string }>
  title: string
  tag: string
  color: NodeColor
  input: string
  output: string
  purpose: string
}

const archNodes: ArchNode[] = [
  {
    icon: Monitor,
    title: "Frontend (Next.js)",
    tag: "Client Layer",
    color: "neon-blue",
    input: "User interaction, image upload",
    output: "API requests to backend",
    purpose: "React / Next.js client for interactive data visualization.",
  },
  {
    icon: Server,
    title: "FastAPI Backend",
    tag: "API Gateway",
    color: "neon-green",
    input: "REST API requests, image payloads",
    output: "Structured JSON predictions",
    purpose: "FastAPI server handling image processing orchestration and model serving.",
  },
  {
    icon: ScanSearch,
    title: "YOLOv8 Roof Detection",
    tag: "Computer Vision",
    color: "neon-blue",
    input: "Satellite / drone roof images",
    output: "Bounding boxes, segmentation masks",
    purpose: "Instance segmentation model for rooftop boundary detection.",
  },
  {
    icon: Sun,
    title: "Solar Forecasting Model",
    tag: "Forecasting Engine",
    color: "neon-green",
    input: "Location, weather, panel specs",
    output: "Predicted kWh yield per hour",
    purpose: "Machine learning model for energy yield prediction.",
  },
  {
    icon: TrendingUp,
    title: "Savings Prediction Model",
    tag: "Financial Logic",
    color: "neon-blue",
    input: "Energy yield, tariffs, costs",
    output: "NPV, ROI, payback period",
    purpose: "Calculates Net Present Value (NPV), ROI, and payback periods.",
  },
  {
    icon: BarChart3,
    title: "Results Dashboard",
    tag: "Visualization",
    color: "neon-green",
    input: "All prediction outputs",
    output: "Charts, reports, PDF export",
    purpose: "Interactive graphs and comparative ROI matrices using Recharts.",
  },
]

/* ─── Animated connector between nodes ────────────────────────────────────── */

function FlowConnector({ index, isInView }: { index: number; isInView: boolean }) {
  return (
    <div className="flex justify-center py-1">
      <div className="relative flex flex-col items-center gap-0">
        {/* Vertical line */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={isInView ? { scaleY: 1 } : {}}
          transition={{ delay: 0.3 + index * 0.15, duration: 0.5, ease: "easeOut" }}
          className="w-px h-10 origin-top"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-neon-blue), var(--color-neon-green))",
          }}
        />

        {/* Data packet pulse traveling down the line */}
        <motion.div
          initial={{ y: -16, opacity: 0 }}
          animate={
            isInView
              ? {
                  y: [0, 40],
                  opacity: [0, 1, 1, 0],
                }
              : {}
          }
          transition={{
            delay: 1.5 + index * 0.3,
            duration: 1.2,
            repeat: Infinity,
            repeatDelay: 2.5,
            ease: "linear",
          }}
          className="absolute top-0 w-1.5 h-1.5 rounded-full bg-neon-blue glow-blue"
        />

        {/* Arrow chevron */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 0.5, scale: 1 } : {}}
          transition={{ delay: 0.5 + index * 0.15, duration: 0.3 }}
        >
          <ChevronDown className="w-4 h-4 text-neon-blue/50" />
        </motion.div>
      </div>
    </div>
  )
}

/* ─── Single architecture node card ───────────────────────────────────────── */

function ArchCard({
  node,
  index,
  isInView,
}: {
  node: ArchNode
  index: number
  isInView: boolean
}) {
  const Icon = node.icon
  const isBlue = node.color === "neon-blue"

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        delay: 0.2 + index * 0.12,
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group relative"
    >
      <div
        className={cn(
          "glass rounded-[2rem] p-6 md:p-8 border transition-all duration-500 relative overflow-hidden",
          "hover:scale-[1.02] cursor-default",
          isBlue
            ? "border-white/5 hover:border-neon-blue/30"
            : "border-white/5 hover:border-neon-green/30"
        )}
      >
        {/* Hover glow bloom */}
        <div
          className={cn(
            "absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none",
            isBlue ? "bg-neon-blue" : "bg-neon-green"
          )}
        />

        {/* Top row: icon + title + tag */}
        <div className="flex items-start gap-4 mb-6 relative z-10">
          {/* Icon */}
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
              isBlue
                ? "bg-neon-blue/10 border border-neon-blue/20 glow-blue"
                : "bg-neon-green/10 border border-neon-green/20 glow-green"
            )}
          >
            <Icon
              className={cn(
                "w-6 h-6",
                isBlue ? "text-neon-blue" : "text-neon-green"
              )}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base font-black italic uppercase tracking-tight leading-tight">
                {node.title}
              </h3>
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-[0.3em] px-2.5 py-0.5 rounded-md border whitespace-nowrap",
                  isBlue
                    ? "text-neon-blue/60 border-neon-blue/15 bg-neon-blue/5"
                    : "text-neon-green/60 border-neon-green/15 bg-neon-green/5"
                )}
              >
                {node.tag}
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground leading-relaxed mt-2">
              {node.purpose}
            </p>
          </div>
        </div>

        {/* I/O pills */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neon-blue/50 mb-1.5">
              Input
            </p>
            <p className="text-[10px] font-semibold text-muted-foreground leading-snug">
              {node.input}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-neon-green/50 mb-1.5">
              Output
            </p>
            <p className="text-[10px] font-semibold text-muted-foreground leading-snug">
              {node.output}
            </p>
          </div>
        </div>

        {/* Bottom animated accent bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: "50%" } : {}}
          transition={{
            delay: 0.6 + index * 0.12,
            duration: 0.8,
            ease: "easeOut",
          }}
          className={cn(
            "h-[2px] rounded-full mt-5 mx-auto",
            isBlue ? "bg-neon-blue/30" : "bg-neon-green/30"
          )}
        />
      </div>
    </motion.div>
  )
}

/* ─── Main Architecture Section ───────────────────────────────────────────── */

export function SystemArchitecture() {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" })

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/3 left-0 w-[700px] h-[700px] bg-neon-blue/5 blur-[180px] rounded-full pointer-events-none opacity-30" />
      <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-neon-green/5 blur-[160px] rounded-full pointer-events-none opacity-25" />

      {/* Faint grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

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
              Technical Stack
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            System <span className="text-neon-blue text-glow-blue">Architecture</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="text-muted-foreground font-medium leading-relaxed max-w-xl mx-auto"
          >
            A decoupled architecture separating the React frontend from the FastAPI machine learning inference engine.
          </motion.p>
        </div>

        {/* Architecture Diagram — vertical pipeline */}
        <div className="max-w-2xl mx-auto">
          {archNodes.map((node, i) => (
            <div key={node.title}>
              <ArchCard node={node} index={i} isInView={isInView} />
              {i < archNodes.length - 1 && (
                <FlowConnector index={i} isInView={isInView} />
              )}
            </div>
          ))}
        </div>

        {/* Summary stat bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2, duration: 0.7 }}
          className="mt-16 max-w-3xl mx-auto glass rounded-[2rem] border border-white/5 p-6 md:p-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "6", label: "Pipeline Stages", color: "text-neon-blue" },
              { value: "3", label: "ML Models", color: "text-neon-green" },
              { value: "<5s", label: "Average Latency", color: "text-neon-blue" },
              { value: "92%", label: "Validation Accuracy", color: "text-neon-green" },
            ].map((stat) => (
              <div key={stat.label}>
                <p
                  className={cn(
                    "text-2xl md:text-3xl font-black tracking-tighter italic",
                    stat.color
                  )}
                >
                  {stat.value}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground mt-1.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
