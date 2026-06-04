"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Upload, Camera, ImageIcon, CheckCircle2,
  AlertCircle, ArrowRight, Scan, Brain, Layers,
  ChevronRight, Search, Zap, Cpu, RefreshCcw,
  FileImage, ZoomIn, Download, X, AlertTriangle, LayoutGrid
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useRouter } from "next/navigation"
import { analyzeRoof, getSolarForecast, getSavingsPrediction } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import { RoofGeometryCard } from "@/components/roof-geometry-card"

export default function RoofDetectionPage() {
  const router = useRouter()
  const {
    analysisState,
    setAnalysisState,
    imageUrl,
    setImageUrl,
    roofDetectionResult,
    setRoofDetectionResult,
    solarEstimationResult,
    setSolarEstimationResult,
    savingsPredictionResult,
    setSavingsPredictionResult,
    resetAnalysis,
  } = useAppStore()

  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [confidenceScores, setConfidenceScores] = useState<Array<{ label: string; score: number; color: string }>>([])
  const [errorMsg, setErrorMsg] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null)

  const analysisSteps = [
    "Decrypting satellite headers...",
    "Running neural edge detection...",
    "Segmenting roof geometry...",
    "Detecting obstructions...",
    "Calculating usable surface area...",
    "Generating thermal irradiance overlay...",
    "Finalizing neural weights...",
  ]

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)

    try {
      // 1. Start UI simulation of steps
      setAnalysisState("analyzing")
      let step = 0
      setProgress(0)
      const stepInterval = setInterval(() => {
        step = Math.min(step + 1, analysisSteps.length - 1)
        setAnalysisStep(step)
        setProgress(Math.round((step / analysisSteps.length) * 100))
      }, 700)

      // 2. Roof Detection
      const roofResult = await analyzeRoof(file)
      let roofData = roofResult.data
      setRoofDetectionResult(roofData)

      const appendWarning = (warning: string) => {
        roofData = {
          ...roofData,
          warnings: Array.from(new Set([...(roofData.warnings ?? []), warning])),
        }
        setRoofDetectionResult(roofData)
      }

      const detectionConfidence = Math.max(0, Math.min(100, Math.round(roofData.detection_confidence ?? 0)))
      setConfidenceScores([
        { label: "Detection Confidence", score: detectionConfidence, color: "neon-blue" },
      ])

      setAnalysisState("estimating")

      // 3. Solar Forecast
      const capacity = roofData.capacity_kwp ?? roofData.estimated_capacity_kw ?? 0
      let annualKwh = roofData.estimated_annual_kwh || (capacity * 1150.0)

      if (capacity > 0) {
        try {
          const forecastPayload = {
              latitude: 28.6139,
              longitude: 77.209,
              month: new Date().getMonth() + 1,
              day_of_year: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000),
              hour: 12,
              temperature_celsius: 32.0,
              cloud_cover_pct: 15.0,
              humidity_pct: 45.0,
              wind_speed_ms: 3.0,
              ghi: 820.0,
              panel_capacity_kw: capacity,
              panel_efficiency_pct: 22.0,
              panel_tilt_degrees: 15.0,
              panel_azimuth_degrees: 180.0,
          }
          const forecast = await getSolarForecast(forecastPayload)
          setSolarEstimationResult(forecast.data)
          annualKwh = forecast.data.predicted_kwh || annualKwh
        } catch {
          appendWarning("Solar forecast could not be completed; roof geometry and sizing remain available.")
        }

        setAnalysisState("calculating")

        try {
          const savings = await getSavingsPrediction({
              panel_capacity_kw: capacity,
              annual_solar_kwh: annualKwh,
              electricity_rate_per_kwh: 0.15 * 80,
              export_rate_per_kwh: 0.05 * 80,
              annual_consumption_kwh: 12000,
              self_consumption_ratio: 0.7,
              installation_cost: capacity * 1500 * 80,
              annual_tariff_increase_pct: 3.0,
              panel_degradation_pct: 0.5,
              system_lifetime_years: 25,
          })
          setSavingsPredictionResult(savings.data)
        } catch {
          appendWarning("Savings calculation could not be completed; solar sizing remains available.")
        }
      }

      clearInterval(stepInterval)
      setAnalysisStep(analysisSteps.length)
      setProgress(100)

      setTimeout(() => setAnalysisState("success"), 600)
    } catch (err: any) {
      console.error("Analysis failed:", err)
      const errorStr = err?.response?.data?.detail || err?.message || "";
      if (errorStr.includes("Insufficient Data")) {
        setErrorMsg("Analysis Halted: Detected usable roof area is insufficient for a standard solar array.");
      } else {
        setErrorMsg(
          errorStr || "Backend connection failed. Make sure the FastAPI server is running on port 8000."
        )
      }
      setAnalysisState("error")
    }
  }, [analysisSteps.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const reset = () => {
    resetAnalysis()
    setProgress(0)
    setAnalysisStep(0)
    setConfidenceScores([])
    setErrorMsg("")
  }

  const detectedArea = roofDetectionResult?.roof_area_m2 ?? roofDetectionResult?.roof_area_sqm ?? 0
  const usableArea = roofDetectionResult?.usable_area_m2 ?? roofDetectionResult?.usable_area_sqm ?? 0
  const placementArea = roofDetectionResult?.panel_placement_area_m2 ?? roofDetectionResult?.panel_placement_area_sqm ?? 0
  const estimatedPanels = roofDetectionResult?.estimated_panel_count ?? roofDetectionResult?.panel_count ?? 0
  const estimatedCapacity = roofDetectionResult?.capacity_kwp ?? roofDetectionResult?.estimated_capacity_kw ?? 0
  const detectionConfidence = roofDetectionResult?.detection_confidence ?? 0
  const solarReady = analysisState === "success" && estimatedCapacity > 0
  const annualEnergy = solarEstimationResult?.predicted_kwh ?? roofDetectionResult?.estimated_annual_kwh ?? 0
  const annualSavings = savingsPredictionResult?.annual_savings_currency ?? 0
  const paybackYears = savingsPredictionResult?.payback_period_years ?? 0
  const resultWarnings: string[] = roofDetectionResult?.warnings ?? []
  const engineeringWarnings = resultWarnings.filter((warning) =>
    warning.toLowerCase().includes("engineering limits")
  )
  const generalWarnings = resultWarnings.filter((warning) =>
    !warning.toLowerCase().includes("engineering limits")
  )

  return (
    <div className="min-h-screen bg-background flex selection:bg-neon-blue/30 selection:text-white">
      <DashboardSidebar />

      <main className="flex-1 ml-64 min-h-screen relative overflow-hidden">
        {/* Futuristic Background */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-neon-blue/5 blur-[140px] rounded-full -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-neon-green/5 blur-[120px] rounded-full -ml-48 -mb-48 pointer-events-none" />

        <header className="sticky top-0 z-30 glass border-b border-white/5 px-8 h-20 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-foreground tracking-tight">Neural Roof Inspector</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Model: YOLOv8-X HighRes • Online</p>
            </div>
          </div>
          {analysisState !== "idle" && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl glass border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-neon-blue/20 transition-all"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Reset Buffer
            </button>
          )}
        </header>

        <div className="p-8 max-w-6xl mx-auto page-transition">
          <AnimatePresence mode="wait">
            {analysisState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="text-center space-y-3">
                  <h2 className="text-4xl font-black tracking-tight uppercase">Deploy Satellite Analysis</h2>
                  <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed font-medium">
                    Our high-density neural network segments roof architecture, detects thermal obstructions,
                    and calculates precise usable surface area for solar array deployment.
                  </p>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "glass rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center min-h-[420px] cursor-pointer transition-all duration-500 group relative overflow-hidden",
                    isDragging
                      ? "border-neon-blue/60 bg-neon-blue/5 glow-blue"
                      : "border-white/5 hover:border-neon-blue/40 hover:bg-neon-blue/[0.02]"
                  )}
                >
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                      backgroundImage: "radial-gradient(var(--color-neon-blue) 1px, transparent 1px)",
                      backgroundSize: "24px 24px"
                    }}
                  />
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8">
                    <div className={cn(
                      "w-24 h-24 rounded-[2rem] flex items-center justify-center transition-all duration-700",
                      isDragging
                        ? "bg-neon-blue/20 border border-neon-blue/40 glow-blue scale-110"
                        : "bg-neon-blue/10 border border-neon-blue/20 group-hover:scale-105 group-hover:rotate-3"
                    )}>
                      <Upload className="w-10 h-10 text-neon-blue" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold text-foreground">
                        {isDragging ? "Drop to Initiate" : "Satellite Asset Upload"}
                      </h3>
                      <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-sm">
                        Drag and drop your aerial imagery here to begin the neural decomposition process.
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <span className="glass rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-white/5 group-hover:border-neon-blue/20 transition-all">GeoTIFF</span>
                      <span className="glass rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-white/5 group-hover:border-neon-blue/20 transition-all">Ultra-HD PNG</span>
                      <span className="glass rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-white/5 group-hover:border-neon-blue/20 transition-all">Raw WebP</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: Scan, label: "Auto-Segmentation", sub: "99.8% precision edge detect" },
                    { icon: Brain, label: "Obstacle Masking", sub: "Deep chimney & vent detection" },
                    { icon: Layers, label: "Multi-Layer Mesh", sub: "3D roof geometry projection" }
                  ].map((item, i) => (
                    <div key={i} className="glass rounded-3xl p-6 border border-white/5 flex gap-5 items-center hover:border-neon-blue/20 transition-all group">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-neon-blue/10 transition-all">
                        <item.icon className="w-6 h-6 text-neon-blue/60 group-hover:text-neon-blue transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.label}</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {(analysisState === "analyzing" || ((analysisState === "estimating" || analysisState === "calculating") && !roofDetectionResult)) && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-12 py-8"
              >
                <div className="relative aspect-video glass rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl">
                  {imageUrl && (
                    <img src={imageUrl} alt="Scanning" className="w-full h-full object-cover opacity-60 grayscale scale-110 blur-[1px]" />
                  )}
                  {/* High-tech Scanning Overlay */}
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
                    <motion.div
                      animate={{ y: ["-100%", "100%"] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                      className="absolute top-0 left-0 right-0 h-1 bg-neon-blue glow-blue z-20"
                    />
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-15 pointer-events-none">
                      {Array.from({ length: 144 }).map((_, i) => (
                        <div key={i} className="border-[0.2px] border-white/10" />
                      ))}
                    </div>
                  </div>

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-12">
                    <div className="w-24 h-24 rounded-full border-4 border-neon-blue/20 border-t-neon-blue animate-spin glow-blue" />
                    <div className="text-center space-y-4">
                      <h3 className="text-3xl font-black uppercase tracking-[0.4em] text-neon-blue text-glow-blue drop-shadow-2xl">
                        {analysisState === "analyzing" ? "Encrypting Data" : analysisState === "estimating" ? "Forecasting Yield" : "Calculating Savings"}
                      </h3>
                      <div className="flex items-center justify-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse" />
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] animate-pulse">
                          {analysisSteps[analysisStep] || "Processing Vector..."}
                        </p>
                      </div>
                    </div>
                    <div className="w-full max-w-md h-2 glass rounded-full overflow-hidden relative border border-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-neon-blue glow-blue"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  {analysisSteps.slice(0, 4).map((step, i) => (
                    <div key={i} className="glass rounded-3xl p-6 border border-white/5 space-y-3 relative overflow-hidden">
                      <div className={cn("w-1.5 h-1.5 rounded-full", i <= analysisStep ? "bg-neon-blue glow-blue" : "bg-white/10")} />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-tight">Stage {i + 1}</p>
                        <p className="text-[11px] font-bold text-foreground truncate">{step}</p>
                      </div>
                      {i === analysisStep && <div className="absolute bottom-0 left-0 h-1 bg-neon-blue animate-pulse w-full" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {roofDetectionResult && (analysisState === "estimating" || analysisState === "calculating" || analysisState === "success") && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-4xl font-black tracking-tighter uppercase italic">
                      {solarReady ? "Engineering Assessment Complete" : "Roof Geometry Detected"}
                    </h2>
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em]">
                      Detection Confidence: {detectionConfidence.toFixed(1)}%
                    </p>
                    {false && (
                    <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em]">Matrix Lock: Latency 0.4s • Accuracy 98.4%</p>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={reset}
                      className="px-6 py-3 rounded-2xl glass border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                    >
                      Reset Analysis
                    </button>
                    <button
                      onClick={() => router.push("/solar-estimation")}
                      disabled={!solarReady}
                      className="px-8 py-3 rounded-2xl bg-neon-blue text-background text-[10px] font-black uppercase tracking-[0.2em] glow-blue flex items-center gap-3 hover:bg-neon-blue/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      View Solar Estimate <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass rounded-[3rem] overflow-hidden border border-white/10 aspect-square group relative shadow-2xl">
                    <img src={imageUrl!} alt="Result" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-neon-red/5 mix-blend-overlay opacity-20" />

                    {/* SVG Overlay with dynamic YOLO boundaries */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox={`0 0 ${roofDetectionResult.image_width_px || 100} ${roofDetectionResult.image_height_px || 100}`}
                      preserveAspectRatio="none"
                    >
                      {roofDetectionResult.segments && roofDetectionResult.segments.map((segment: any) => {
                        const polygonPoints = Array.isArray(segment.polygon) && segment.polygon.length > 2
                          ? segment.polygon.map((point: any) => `${point.x},${point.y}`).join(" ")
                          : ""
                        const { x1, y1, width, height } = segment.bounding_box;

                        return polygonPoints ? (
                          <polygon
                            key={segment.segment_id}
                            points={polygonPoints}
                            fill="var(--color-neon-red)"
                            fillOpacity="0.16"
                            stroke="var(--color-neon-red)"
                            strokeWidth={Math.max(2, (roofDetectionResult.image_width_px || 1000) / 250)}
                            className="animate-pulse"
                          />
                        ) : (
                          <rect
                            key={segment.segment_id}
                            x={x1}
                            y={y1}
                            width={width}
                            height={height}
                            fill="var(--color-neon-red)"
                            fillOpacity="0.10"
                            stroke="var(--color-neon-red)"
                            strokeWidth={Math.max(2, (roofDetectionResult.image_width_px || 1000) / 250)}
                            className="animate-pulse"
                          />
                        );
                      })}
                    </svg>

                    <div className="absolute top-8 left-8 glass rounded-2xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-neon-red border border-neon-red/30 flex items-center gap-3 shadow-lg">
                      <div className="w-2.5 h-2.5 rounded-full bg-neon-red glow-red animate-pulse" />
                      Roof Footprint Identified
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {[
                        { icon: Layers, label: "Detected Roof Area", value: detectedArea.toFixed(1), unit: "m²", color: "neon-blue" },
                        { icon: Scan, label: "Usable Roof Area", value: usableArea.toFixed(1), unit: "m²", color: "neon-green" },
                        { icon: CheckCircle2, label: "Detection Confidence", value: detectionConfidence.toFixed(1), unit: "%", color: "neon-blue" },
                      ].map((metric) => (
                        <div key={metric.label} className="glass rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-all group-hover:scale-110">
                            <metric.icon className={cn("w-12 h-12", metric.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")} />
                          </div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 leading-tight">{metric.label}</p>
                          <p className={cn("text-4xl font-black tracking-tighter flex items-baseline flex-wrap", metric.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")}>
                            {metric.value}
                            <span className="text-sm ml-1.5 font-bold opacity-50 tracking-normal">{metric.unit}</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {[
                        { icon: LayoutGrid, label: "Estimated Panels", value: solarReady ? String(estimatedPanels) : "---", unit: "panels", color: "neon-blue" },
                        { icon: Zap, label: "Estimated Capacity", value: solarReady ? estimatedCapacity.toFixed(1) : "---", unit: "kWp", color: "neon-green" },
                      ].map((metric) => (
                        <div key={metric.label} className="glass rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-all group-hover:scale-110">
                            <metric.icon className={cn("w-12 h-12", metric.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")} />
                          </div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 leading-tight">{metric.label}</p>
                          <p className={cn("text-4xl font-black tracking-tighter flex items-baseline flex-wrap", metric.color === "neon-blue" ? "text-neon-blue" : "text-neon-green")}>
                            {metric.value}
                            <span className="text-sm ml-1.5 font-bold opacity-50 tracking-normal">{metric.unit}</span>
                          </p>
                          {!solarReady && (
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                              Solar estimation running
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {solarReady && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          { label: "Annual Energy Production", value: annualEnergy > 0 ? `${Math.round(annualEnergy).toLocaleString('en-IN')} kWh` : "---" },
                          { label: "Annual Savings", value: annualSavings > 0 ? `₹${Math.round(annualSavings).toLocaleString('en-IN')}` : "---" },
                          { label: "Payback Period", value: paybackYears > 0 ? `${paybackYears.toFixed(1)} years` : "---" },
                        ].map((metric) => (
                          <div key={metric.label} className="glass rounded-2xl p-5 border border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">{metric.label}</p>
                            <p className="text-lg font-black text-foreground tracking-tight">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {false && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="glass rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-all group-hover:scale-110">
                          <Layers className="w-12 h-12 text-neon-blue" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Usable Roof Area</p>
                        <p className="text-4xl sm:text-5xl font-black text-neon-blue tracking-tighter flex items-baseline flex-wrap">
                          {roofDetectionResult.usable_area_m2 ? roofDetectionResult.usable_area_m2.toFixed(1) : roofDetectionResult.usable_area_sqm?.toFixed(1) || 0}
                          <span className="text-sm sm:text-lg ml-1.5 font-bold opacity-40 tracking-normal">M²</span>
                        </p>
                      </div>
                      <div className="glass rounded-[2rem] p-6 border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-all group-hover:scale-110">
                          <Zap className="w-12 h-12 text-neon-green" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Estimated Capacity</p>
                        <p className="text-4xl sm:text-5xl font-black text-neon-green tracking-tighter flex items-baseline flex-wrap">
                          {roofDetectionResult.estimated_capacity_kw?.toFixed(1) || 0}
                          <span className="text-sm sm:text-lg ml-1.5 font-bold opacity-40 tracking-normal">KW</span>
                        </p>
                      </div>
                    </div>

                    )}

                    {roofDetectionResult.calibration_factor !== undefined && (
                      <div className="glass rounded-[2.5rem] p-8 border border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Calibration Diagnostics</h3>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-neon-blue">
                            <Layers className="w-3.5 h-3.5" /> Geometric Engine
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Raw Area</p>
                            <p className="text-sm font-black">{roofDetectionResult.raw_roof_area_m2?.toFixed(1) || "---"} <span className="text-[10px] text-muted-foreground">m²</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Calib. Factor</p>
                            <p className="text-sm font-black">{roofDetectionResult.calibration_factor?.toFixed(2) || "---"}x</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Final Area</p>
                            <p className="text-sm font-black text-neon-blue">{detectedArea.toFixed(1)} <span className="text-[10px] text-muted-foreground">m²</span></p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Validation</p>
                            <p className={cn("text-sm font-black", roofDetectionResult.engineering_validation_applied ? "text-yellow-400" : "text-neon-green")}>
                              {roofDetectionResult.engineering_validation_applied ? "Constrained" : "Pass"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="glass rounded-[2.5rem] p-8 border border-white/5 space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Detection Diagnostics</h3>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-neon-green">
                          <CheckCircle2 className="w-3.5 h-3.5" /> YOLO Confidence
                        </div>
                      </div>
                      <div className="space-y-5">
                        {confidenceScores.map((item, i) => (
                          <div key={i} className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className={item.color === "neon-red" ? "text-neon-red" : item.color === "neon-blue" ? "text-neon-blue" : "text-neon-green"}>{item.score}%</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.score}%` }}
                                transition={{ delay: 0.5 + (i * 0.1), duration: 1 }}
                                className={cn(
                                  "h-full",
                                  item.color === "neon-red"
                                    ? "bg-neon-red glow-red"
                                    : item.color === "neon-blue"
                                      ? "bg-neon-blue glow-blue"
                                      : "bg-neon-green glow-green"
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => solarReady && router.push("/solar-estimation")}
                      className={cn(
                        "glass rounded-[2rem] p-8 border border-neon-blue/30 bg-neon-blue/5 flex items-center justify-between group relative overflow-hidden transition-all duration-500",
                        solarReady ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                    >
                      <div className="absolute inset-0 bg-neon-blue/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-neon-blue/20 flex items-center justify-center text-neon-blue glow-blue transition-transform group-hover:rotate-12">
                          <Brain className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="text-lg font-black tracking-tight text-foreground italic">
                            {solarReady ? "Open Solar Estimate" : "Solar Estimation Running"}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                            Panels, capacity, production, savings, and payback
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-6 h-6 text-neon-blue group-hover:translate-x-2 transition-transform relative z-10" />
                    </motion.div>
                  </div>
                </div>

                {engineeringWarnings.length > 0 && (
                  <div className="glass rounded-[2rem] p-6 border border-yellow-400/20 flex items-start gap-5 bg-yellow-400/[0.02]">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black text-yellow-400 uppercase tracking-[0.2em]">⚠ Engineering Validation Warning</p>
                      <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                        {engineeringWarnings.join(" ")} Adjusted capacity: {estimatedCapacity.toFixed(2)} kWp
                        {roofDetectionResult.maximum_feasible_capacity_kwp
                          ? `, maximum feasible capacity: ${roofDetectionResult.maximum_feasible_capacity_kwp.toFixed(2)} kWp.`
                          : "."}
                      </p>
                    </div>
                  </div>
                )}

                {generalWarnings.length > 0 && (
                  <div className="glass rounded-[2rem] p-6 border border-yellow-400/20 flex items-start gap-5 bg-yellow-400/[0.02]">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black text-yellow-400 uppercase tracking-[0.2em]">Analysis Warning</p>
                      <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                        {generalWarnings.join(" ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Roof Geometry Details card ────────────────────── */}
                <RoofGeometryCard result={roofDetectionResult} />

              </motion.div>
            )}

            {analysisState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto py-16 flex flex-col items-center text-center gap-8"
              >
                <div className="w-24 h-24 rounded-[2rem] bg-red-400/10 border border-red-400/30 flex items-center justify-center">
                  <AlertCircle className="w-12 h-12 text-red-400" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-black uppercase tracking-tight text-red-400">Analysis Failed</h2>
                  <p className="text-muted-foreground text-sm font-medium max-w-md leading-relaxed">
                    {errorMsg || "Could not connect to the AI backend. Make sure the FastAPI server is running."}
                  </p>
                </div>
                <div className="glass rounded-[2rem] p-6 border border-red-400/20 bg-red-400/[0.03] w-full text-left space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-400">How to fix:</p>
                  <code className="block text-xs font-mono text-muted-foreground bg-white/5 rounded-xl px-4 py-3">
                    cd Solar-ai-platform/backend<br />
                    python run.py
                  </code>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Then ensure <strong>NEXT_PUBLIC_API_URL</strong> in <code>.env.local</code> points to <code>http://localhost:8000/api/v1</code>
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="px-8 py-4 rounded-2xl bg-neon-blue text-background text-[10px] font-black uppercase tracking-[0.2em] glow-blue hover:bg-neon-blue/90 transition-all flex items-center gap-3"
                >
                  <RefreshCcw className="w-4 h-4" /> Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
