"use client"

import { useState, useRef } from "react"
import { motion, useInView } from "framer-motion"
import Image from "next/image"
import {
  Sparkles,
  ArrowLeftRight,
  ScanSearch,
  Ruler,
  Activity,
  CheckCircle2
} from "lucide-react"

const detectionBoxes = [
  { x: "22%", y: "20%", w: "56%", h: "55%", label: "Roof", conf: "98.7%", primary: true },
  { x: "1%", y: "2%", w: "22%", h: "28%", label: "Roof", conf: "94.1%", primary: false },
  { x: "1%", y: "35%", w: "18%", h: "26%", label: "Roof", conf: "92.8%", primary: false },
  { x: "1%", y: "68%", w: "22%", h: "30%", label: "Roof", conf: "91.3%", primary: false },
  { x: "78%", y: "3%", w: "21%", h: "27%", label: "Roof", conf: "93.5%", primary: false },
  { x: "80%", y: "36%", w: "19%", h: "25%", label: "Roof", conf: "90.7%", primary: false },
  { x: "78%", y: "70%", w: "21%", h: "28%", label: "Roof", conf: "92.1%", primary: false },
  { x: "30%", y: "1%", w: "20%", h: "18%", label: "Roof", conf: "89.4%", primary: false },
  { x: "55%", y: "1%", w: "20%", h: "18%", label: "Roof", conf: "88.9%", primary: false },
  { x: "30%", y: "82%", w: "20%", h: "17%", label: "Roof", conf: "90.2%", primary: false },
  { x: "55%", y: "82%", w: "20%", h: "17%", label: "Roof", conf: "91.6%", primary: false },
]

export function AIComparison() {
  const [sliderPos, setSliderPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" })

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    let clientX = 0
    if ("touches" in e) {
      clientX = e.touches[0].clientX
    } else {
      clientX = (e as React.MouseEvent).clientX
    }
    const x = clientX - rect.left
    const newPos = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(newPos)
  }

  return (
    <section ref={sectionRef} className="py-32 relative z-10 overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-neon-blue/5 blur-[160px] rounded-full pointer-events-none opacity-40" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-neon-green/5 blur-[160px] rounded-full pointer-events-none opacity-30" />

      <div className="container px-6 mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 glass rounded-full px-6 py-2 border border-white/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-neon-blue" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neon-blue">
              Computer Vision
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1, duration: 0.7 }}
            className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter"
          >
            AI Roof <span className="text-neon-blue text-glow-blue">Detection</span> Results
          </motion.h2>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Comparison Slider */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div
              ref={containerRef}
              className="relative aspect-video sm:aspect-[21/9] rounded-[2rem] overflow-hidden glass border border-white/10 shadow-2xl touch-none select-none"
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onMouseMove={handleMove}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onTouchMove={handleMove}
            >
              {/* Left Side: Original Image */}
              <div className="absolute inset-0 w-full h-full">
                <Image
                  src="/sample-roof.png"
                  alt="Original Roof Image"
                  fill
                  className="object-cover pointer-events-none"
                  priority
                />
                <div className="absolute top-6 left-6 glass px-4 py-2 rounded-lg border border-white/10">
                  <span className="text-xs font-black uppercase tracking-widest text-foreground shadow-black drop-shadow-md">
                    Original Imagery
                  </span>
                </div>
              </div>

              {/* Right Side: YOLO Detection Result */}
              <div
                className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
                style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
              >
                {/* Darkened filter for contrast */}
                <Image
                  src="/sample-roof.png"
                  alt="YOLO Detection Result"
                  fill
                  className="object-cover pointer-events-none brightness-50 contrast-125 grayscale-[50%]"
                  priority
                />
                
                {/* Detection Boxes */}
                {detectionBoxes.map((box, i) => {
                  const borderColor = box.primary ? "rgba(56, 189, 248, 0.85)" : "rgba(74, 222, 128, 0.6)"
                  const bgColor = box.primary ? "rgba(56, 189, 248, 0.15)" : "rgba(74, 222, 128, 0.08)"
                  const labelBg = box.primary ? "rgb(56, 189, 248)" : "rgb(74, 222, 128)"
                  const labelColor = box.primary ? "#000" : "#000"
                  const borderWidth = box.primary ? 3 : 2

                  return (
                    <div
                      key={i}
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
                      <div className="absolute -top-[18px] left-0 flex items-center">
                        <span
                          className="text-[8px] font-black uppercase tracking-wider px-1.5 py-[2px] leading-tight"
                          style={{ backgroundColor: labelBg, color: labelColor, borderRadius: "2px" }}
                        >
                          {box.label} {box.conf}
                        </span>
                      </div>
                    </div>
                  )
                })}

                <div className="absolute top-6 right-6 glass px-4 py-2 rounded-lg border border-neon-blue/30 bg-neon-blue/10">
                  <span className="text-xs font-black uppercase tracking-widest text-neon-blue shadow-black drop-shadow-md">
                    YOLOv8 Segmentation
                  </span>
                </div>
              </div>

              {/* Slider Handle */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-neon-blue cursor-ew-resize glow-blue flex items-center justify-center z-30 pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="w-10 h-10 bg-background border-2 border-neon-blue rounded-full flex items-center justify-center shadow-lg shadow-neon-blue/50 pointer-events-auto">
                  <ArrowLeftRight className="w-5 h-5 text-neon-blue" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Metrics Row */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10"
          >
            {/* Metric 1 */}
            <div className="glass rounded-2xl p-6 border border-white/5 hover:border-neon-blue/30 transition-all group relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-neon-blue/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center glow-blue shrink-0">
                  <Ruler className="w-5 h-5 text-neon-blue" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Usable Roof Area
                </p>
              </div>
              <p className="text-3xl font-black text-foreground tracking-tighter italic">
                148.5 <span className="text-sm text-muted-foreground ml-1 font-bold">m²</span>
              </p>
            </div>

            {/* Metric 2 */}
            <div className="glass rounded-2xl p-6 border border-white/5 hover:border-neon-green/30 transition-all group relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-neon-green/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center glow-green shrink-0">
                  <ScanSearch className="w-5 h-5 text-neon-green" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Detection Confidence
                </p>
              </div>
              <p className="text-3xl font-black text-neon-green tracking-tighter italic">
                98.7 <span className="text-sm text-neon-green/70 ml-1 font-bold">%</span>
              </p>
            </div>

            {/* Metric 3 */}
            <div className="glass rounded-2xl p-6 border border-white/5 hover:border-neon-blue/30 transition-all group relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-neon-blue/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center glow-blue shrink-0">
                  <Activity className="w-5 h-5 text-neon-blue" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Roof Coverage
                </p>
              </div>
              <p className="text-3xl font-black text-foreground tracking-tighter italic">
                74.2 <span className="text-sm text-muted-foreground ml-1 font-bold">%</span>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
