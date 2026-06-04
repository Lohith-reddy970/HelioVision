/**
 * lib/api.ts
 * ──────────
 * Centralised API client for the Next.js frontend → FastAPI backend.
 *
 * Notes:
 * - Most backend endpoints return a standard success envelope:
 *   { "status": "success", "message": string, "data": ... }
 * - Some endpoints (e.g. /health) return a bare object (no envelope).
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// In development the backend bypasses API-key auth automatically.
// Keep the header anyway so the code works seamlessly in production.
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "dev-insecure-key-do-not-use-in-production";

const jsonHeaders: HeadersInit = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export type SuccessEnvelope<T> = {
  status: "success";
  message: string;
  data: T;
};

type ErrorEnvelope = {
  status?: "error";
  code?: number;
  message?: string;
  detail?: unknown;
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as ErrorEnvelope;
      detail = (body?.detail as string) || body?.message || detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`[${res.status}] ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ── Health ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/health
 * Fast liveness probe — no dependencies checked.
 */
export async function getHealthStatus() {
  const res = await fetch(`${API_BASE_URL}/health`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY },
    // 5 s timeout via AbortController
    signal: AbortSignal.timeout(5000),
  });
  return handleResponse<{
    status: string;
    version: string;
    environment: string;
    models_loaded: Array<{ key: string; type: string }>;
  }>(res);
}

/**
 * GET /api/v1/health/ready
 * Readiness probe — checks all sub-systems.
 */
export async function getReadinessStatus() {
  const res = await fetch(`${API_BASE_URL}/health/ready`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY },
    signal: AbortSignal.timeout(8000),
  });
  return handleResponse<{ status: string; checks: Record<string, unknown> }>(res);
}

// ── Roof Detection ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/roof/analyze
 * Upload a satellite/aerial image and receive roof analysis.
 */
export async function analyzeRoof(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/roof/analyze`, {
    method: "POST",
    // Do NOT set Content-Type — browser sets multipart boundary automatically
    headers: { "X-API-Key": API_KEY },
    body: formData,
  });

  // Backend returns RoofDetectionResponse; the UI pages currently expect a smaller shape.
  const raw = await handleResponse<
    SuccessEnvelope<{
      roof_area_m2: number;
      usable_area_m2: number;
      panel_placement_area_m2: number;
      capacity_kwp: number;
      detection_confidence: number;
      warnings: string[];
      total_roof_area_m2: number;
      total_usable_area_m2: number;
      estimated_system_capacity_kw: number;
      estimated_annual_generation_kwh: number;
      estimated_panel_count: number;
      maximum_feasible_capacity_kwp: number;
      dominant_orientation: string;
      overall_shading: "none" | "low" | "moderate" | "high";
      suitability: string;
      recommendations: string[];
      segments: any[];
      image_width_px: number;
      image_height_px: number;
    }>
  >(res);

  const shadingFactorByLevel: Record<string, number> = {
    none: 1.0,
    low: 0.9,
    moderate: 0.75,
    high: 0.5,
  };

  const simplified = {
    roof_area_m2: raw.data.roof_area_m2 ?? raw.data.total_roof_area_m2,
    usable_area_m2: raw.data.usable_area_m2 ?? raw.data.total_usable_area_m2,
    panel_placement_area_m2: raw.data.panel_placement_area_m2,
    capacity_kwp: raw.data.capacity_kwp ?? raw.data.estimated_system_capacity_kw,
    roof_area_sqm: raw.data.roof_area_m2 ?? raw.data.total_roof_area_m2,
    usable_area_sqm: raw.data.usable_area_m2 ?? raw.data.total_usable_area_m2,
    panel_placement_area_sqm: raw.data.panel_placement_area_m2,
    estimated_capacity_kw: raw.data.capacity_kwp ?? raw.data.estimated_system_capacity_kw,
    estimated_annual_kwh: raw.data.estimated_annual_generation_kwh,
    panel_count: raw.data.estimated_panel_count,
    estimated_panel_count: raw.data.estimated_panel_count,
    detection_confidence: raw.data.detection_confidence,
    warnings: raw.data.warnings ?? [],
    maximum_feasible_capacity_kwp: raw.data.maximum_feasible_capacity_kwp,
    orientation: raw.data.dominant_orientation,
    shading_factor: shadingFactorByLevel[raw.data.overall_shading] ?? 0.85,
    suitability_rating: raw.data.suitability,
    recommendations: raw.data.recommendations,
    segments: raw.data.segments,
    image_width_px: raw.data.image_width_px,
    image_height_px: raw.data.image_height_px,
  };

  return {
    status: "success" as const,
    message: raw.message,
    data: simplified,
  } satisfies SuccessEnvelope<typeof simplified>;
}

/**
 * GET /api/v1/roof/supported-formats
 */
export async function getSupportedImageFormats() {
  const res = await fetch(`${API_BASE_URL}/roof/supported-formats`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY },
  });
  return handleResponse<SuccessEnvelope<Record<string, unknown>>>(res);
}

// ── Solar Forecasting ─────────────────────────────────────────────────────────

export interface SolarForecastPayload {
  latitude: number;
  longitude: number;
  month: number;
  day_of_year: number;
  hour: number;
  temperature_celsius: number;
  cloud_cover_pct: number;
  humidity_pct: number;
  wind_speed_ms: number;
  ghi: number;
  panel_capacity_kw: number;
  panel_efficiency_pct: number;
  panel_tilt_degrees?: number;
  panel_azimuth_degrees?: number;
}

export interface SolarForecastResult {
  predicted_kwh: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  irradiance_efficiency_factor: number;
  model_version: string;
  notes: string | null;
}

/**
 * POST /api/v1/solar/forecast
 * Predict hourly solar energy output using the Random Forest model.
 */
export async function getSolarForecast(payload: SolarForecastPayload) {
  const res = await fetch(`${API_BASE_URL}/solar/forecast`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  return handleResponse<SuccessEnvelope<SolarForecastResult>>(res);
}

/**
 * GET /api/v1/solar/forecast/info
 * Returns metadata about the loaded forecast model.
 */
export async function getSolarForecastInfo() {
  const res = await fetch(`${API_BASE_URL}/solar/forecast/info`, {
    method: "GET",
    headers: jsonHeaders,
  });
  return handleResponse<SuccessEnvelope<Record<string, unknown>>>(res);
}

// ── Savings Prediction ────────────────────────────────────────────────────────

export interface SavingsPredictionPayload {
  panel_capacity_kw: number;
  annual_solar_kwh: number;
  electricity_rate_per_kwh: number;
  export_rate_per_kwh?: number;
  annual_consumption_kwh: number;
  self_consumption_ratio?: number;
  installation_cost: number;
  annual_tariff_increase_pct?: number;
  panel_degradation_pct?: number;
  system_lifetime_years?: number;
}

export interface SavingsPredictionResult {
  annual_savings_currency: number;
  lifetime_savings_currency: number;
  payback_period_years: number;
  roi_pct: number;
  net_present_value: number;
  yearly_savings: Array<Record<string, unknown>>;
  monthly_breakdown: Array<{
    month: number;
    month_name: string;
    solar_kwh: number;
    savings_currency: number;
    grid_import_kwh: number;
  }>;
  co2_offset_tonnes_per_year: number;
  model_version: string;
}

/**
 * POST /api/v1/savings/predict
 * Full ML-powered financial savings prediction.
 */
export async function getSavingsPrediction(payload: SavingsPredictionPayload) {
  const res = await fetch(`${API_BASE_URL}/savings/predict`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  return handleResponse<SuccessEnvelope<SavingsPredictionResult>>(res);
}

/**
 * GET /api/v1/savings/quick
 * Lightweight rule-of-thumb savings estimate.
 */
export async function getQuickSavingsEstimate(params: {
  panel_capacity_kw: number;
  electricity_rate_per_kwh: number;
  annual_consumption_kwh: number;
  installation_cost: number;
}) {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();

  const res = await fetch(`${API_BASE_URL}/savings/quick?${query}`, {
    method: "GET",
    headers: jsonHeaders,
  });
  return handleResponse<SuccessEnvelope<Record<string, unknown>>>(res);
}
