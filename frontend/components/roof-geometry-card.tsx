"use client"

import { motion } from "framer-motion"
import {
  Square,
  Hexagon,
  Percent,
  SlidersHorizontal,
  LayoutGrid,
  Zap,
  ChevronRight,
  FlaskConical,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types matching the backend RoofDetectionResponse / DetectedRoofSegment ──

interface RoofSegment {
  segment_id: number
  confidence: number
  area_m2: number
  usable_area_m2: number
  panel_placement_area_m2: number
  raw_bounding_box_area_m2: number
  utilization_factor: number
  geometry_source: string
  pixel_count: number
}

interface RoofDetectionResult {
  roof_area_m2: number
  usable_area_m2: number
  panel_placement_area_m2: number
  estimated_panel_count: number
  capacity_kwp: number
  detection_confidence: number
  segments: RoofSegment[]
  maximum_feasible_capacity_kwp?: number
}

interface RoofGeometryCardProps {
  result: RoofDetectionResult
  className?: string
}

// ─── Constants (mirrored from backend config) ────────────────────────────────
const PANEL_WATTAGE_W = 550
const PANEL_AREA_M2 = 2.4

// ─── Sub-components ──────────────────────────────────────────────────────────

interface ChainRowProps {
  icon: React.ElementType
  label: string
  value: string
  unit?: string
  subtext?: string
  color: "blue" | "green" | "amber" | "violet"
  isLast?: boolean
  delay?: number
}

const COLOR_MAP = {
  blue: {
    text: "text-neon-blue",
    bg: "bg-neon-blue/10",
    border: "border-neon-blue/20",
    bar: "bg-neon-blue",
    dot: "bg-neon-blue",
    glow: "glow-blue",
    connector: "border-neon-blue/20",
  },
  green: {
    text: "text-neon-green",
    bg: "bg-neon-green/10",
    border: "border-neon-green/20",
    bar: "bg-neon-green",
    dot: "bg-neon-green",
    glow: "glow-green",
    connector: "border-neon-green/20",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
    glow: "",
    connector: "border-amber-400/20",
  },
  violet: {
    text: "text-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/20",
    bar: "bg-violet-400",
    dot: "bg-violet-400",
    glow: "",
    connector: "border-violet-400/20",
  },
}

function ChainRow({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  color,
  isLast = false,
  delay = 0,
}: ChainRowProps) {
  const c = COLOR_MAP[color]
  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[1.375rem] top-12 bottom-0 w-px border-l border-dashed border-white/10" />
      )}

      {/* Icon node */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay, type: "spring", stiffness: 260, damping: 20 }}
        className={cn(
          "shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border mt-0.5",
          c.bg,
          c.border
        )}
      >
        <Icon className={cn("w-5 h-5", c.text)} />
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.05, duration: 0.4 }}
        className="flex-1 pb-6"
      >
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-xl font-black tracking-tight tabular-nums", c.text)}>
              {value}
            </span>
            {unit && (
              <span className="text-xs font-bold text-muted-foreground opacity-60">{unit}</span>
            )}
          </div>
        </div>
        {subtext && (
          <p className="mt-1 text-[10px] font-medium text-muted-foreground/60 leading-relaxed">
            {subtext}
          </p>
        )}
      </motion.div>
    </div>
  )
}

// ─── Mini stat pill ───────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = "blue",
}: {
  label: string
  value: string
  color?: "blue" | "green" | "amber" | "violet"
}) {
  const c = COLOR_MAP[color]
  return (
    <div
      className={cn(
        "glass rounded-2xl px-4 py-3 border flex flex-col gap-1",
        c.border
      )}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-base font-black tracking-tight tabular-nums", c.text)}>{value}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RoofGeometryCard({ result, className }: RoofGeometryCardProps) {
  // Aggregate from first segment (primary) or response top-level
  const primarySegment = result.segments?.[0]

  const bboxAreaM2 = primarySegment?.raw_bounding_box_area_m2 ?? 0
  const polygonAreaM2 = result.roof_area_m2 ?? 0
  const utilizationFactor = primarySegment?.utilization_factor ?? 0
  const panelPlacementAreaM2 = result.panel_placement_area_m2 ?? 0
  const panelCount = result.estimated_panel_count ?? 0
  const panelWattage = PANEL_WATTAGE_W
  const panelArea = PANEL_AREA_M2
  const capacityKwp = result.capacity_kwp ?? 0

  // Correction factor = how much the segmentation polygon "corrects" the raw bbox
  const correctionFactor =
    bboxAreaM2 > 0 ? Math.min(polygonAreaM2 / bboxAreaM2, 1) : 1

  // Geometry source badge
  const geoSource = primarySegment?.geometry_source ?? "unknown"
  const sourceLabel: Record<string, string> = {
    segmentation_mask: "SEG MASK",
    oriented_box: "OBB",
    polygon_fallback: "POLY FALLBACK",
    bbox_fallback: "BBOX FALLBACK",
    development_stub_polygon: "DEV STUB",
    unknown: "UNKNOWN",
  }

  const chain: ChainRowProps[] = [
    {
      icon: Square,
      label: "Bounding Box Area",
      value: bboxAreaM2 > 0 ? bboxAreaM2.toFixed(2) : "—",
      unit: "m²",
      subtext: "Raw YOLO detection boundary before segmentation correction",
      color: "violet",
      delay: 0.05,
    },
    {
      icon: Hexagon,
      label: "Polygon Area",
      value: polygonAreaM2.toFixed(2),
      unit: "m²",
      subtext: `Refined footprint from ${sourceLabel[geoSource] ?? geoSource}. Used as the roof area baseline.`,
      color: "blue",
      delay: 0.12,
    },
    {
      icon: TrendingDown,
      label: "Correction Factor",
      value: bboxAreaM2 > 0 ? `${(correctionFactor * 100).toFixed(1)}%` : "N/A",
      unit: "",
      subtext:
        bboxAreaM2 > 0
          ? "Polygon ÷ Bounding box — how much area was reclaimed after precise segmentation"
          : "Not applicable — no bounding box area available from this detection source",
      color: "amber",
      delay: 0.19,
    },
    {
      icon: SlidersHorizontal,
      label: "Utilization Factor",
      value: `${(utilizationFactor * 100).toFixed(0)}%`,
      unit: "",
      subtext:
        utilizationFactor >= 0.75
          ? "Large roof (≥ 500 m²) — 80% utilization applied"
          : utilizationFactor >= 0.70
          ? "Medium roof (150–500 m²) — 70% utilization applied"
          : "Small roof (< 150 m²) — 65% utilization applied",
      color: "amber",
      delay: 0.26,
    },
    {
      icon: Percent,
      label: "Panel Area",
      value: panelPlacementAreaM2.toFixed(2),
      unit: "m²",
      subtext: `${panelCount} panels × ${panelArea} m² each — actual module footprint after integer flooring`,
      color: "green",
      delay: 0.33,
    },
    {
      icon: LayoutGrid,
      label: "Panel Count",
      value: String(panelCount),
      unit: "panels",
      subtext: `⌊ Usable area ÷ ${panelArea} m² per panel ⌋ — floored to whole panels`,
      color: "green",
      delay: 0.40,
    },
    {
      icon: Zap,
      label: "Panel Wattage",
      value: String(panelWattage),
      unit: "W / panel",
      subtext: `${panelCount} panels × ${panelWattage} W = ${(capacityKwp * 1000).toFixed(0)} W = ${capacityKwp.toFixed(2)} kWp installed capacity`,
      color: "blue",
      isLast: true,
      delay: 0.47,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn("glass rounded-[2.5rem] border border-white/5 overflow-hidden", className)}
    >
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center">
              <FlaskConical className="w-6 h-6 text-neon-blue" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.25em] text-foreground">
                Roof Geometry Details
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                Full calculation chain — detection → capacity
              </p>
            </div>
          </div>

          {/* Source badge */}
          <div
            className={cn(
              "glass rounded-2xl px-4 py-1.5 border text-[10px] font-black uppercase tracking-[0.15em]",
              geoSource === "segmentation_mask"
                ? "border-neon-green/30 text-neon-green bg-neon-green/5"
                : geoSource.includes("fallback") || geoSource.includes("stub")
                ? "border-amber-400/30 text-amber-400 bg-amber-400/5"
                : "border-neon-blue/30 text-neon-blue bg-neon-blue/5"
            )}
          >
            {sourceLabel[geoSource] ?? geoSource}
          </div>
        </div>
      </div>

      {/* Calculation chain */}
      <div className="px-8 pt-8 pb-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Step-by-step breakdown
          </p>
        </div>

        <div className="space-y-0">
          {chain.map((row, i) => (
            <ChainRow key={i} {...row} />
          ))}
        </div>
      </div>

      {/* Summary stat pills */}
      <div className="px-8 pb-8">
        <div className="pt-6 border-t border-white/5">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground mb-4">
            Summary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill
              label="Roof Area"
              value={`${polygonAreaM2.toFixed(1)} m²`}
              color="blue"
            />
            <StatPill
              label="Utilization"
              value={`${(utilizationFactor * 100).toFixed(0)}%`}
              color="amber"
            />
            <StatPill
              label="Panel Count"
              value={String(panelCount)}
              color="green"
            />
            <StatPill
              label="Capacity"
              value={`${capacityKwp.toFixed(2)} kWp`}
              color="green"
            />
          </div>
        </div>

        {/* Final capacity call-out */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-4 rounded-2xl bg-neon-blue/5 border border-neon-blue/15 px-6 py-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-neon-blue shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Estimated System Capacity
              </p>
              <p className="text-xs font-bold text-muted-foreground/70 mt-0.5">
                {panelCount} panels × {panelWattage} W ÷ 1000
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-3xl font-black tracking-tight text-neon-blue tabular-nums">
              {capacityKwp.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-muted-foreground opacity-60">kWp</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
