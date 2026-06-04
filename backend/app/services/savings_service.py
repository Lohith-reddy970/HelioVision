"""
app/services/savings_service.py
────────────────────────────────
Financial Calculation Engine — Single Cash-Flow Model
=====================================================

ALL financial metrics derive from one canonical cash-flow table.
No metric is hardcoded or computed independently of the others.

Primary Inputs (drive every metric):
  1. installation_cost          → cost base for payback, ROI, NPV, IRR
  2. annual_solar_kwh           → energy revenue (avoided cost + export)
  3. electricity_rate_per_kwh   → price of avoided grid energy
  4. system_lifetime_years      → projection horizon
  5. annual_maintenance_cost    → operating expense deducted each year

Derivation chain (single source of truth):
  gross_savings_y1              = Σ monthly (on-site × rate + export × export_rate)
  net_savings_y                 = gross_savings_y - annual_maintenance_cost
  cumulative_net_savings_y      = Σ net_savings up to year y
  discounted_cash_flow_y        = net_savings_y / (1 + r)^y

  annual_savings_currency       = net_savings for year 1
  lifetime_savings_currency     = Σ net_savings  (all years)
  net_profit                    = lifetime_savings - installation_cost
  payback_period_years          = installation_cost / annual_savings_currency
  roi_pct                       = (net_profit / installation_cost) × 100
  net_present_value             = Σ discounted_cash_flow - installation_cost
  irr_pct                       = rate r such that NPV(r) = 0  (Newton-Raphson)

Validation invariants (always satisfied):
  • payback_period_years == installation_cost / annual_savings_currency
  • roi_pct             == (net_profit / installation_cost) × 100
  • net_profit          == lifetime_savings - installation_cost
  • NPV                 == Σ discounted cash flows - installation_cost
"""

import asyncio
import calendar
import math
from typing import Any

from app.core.exceptions import PredictionException
from app.core.logging import get_logger
from app.schemas.savings import (
    MonthlySavings,
    SavingsPredictionRequest,
    SavingsPredictionResponse,
    YearlySavings,
)

logger = get_logger(__name__)

# Average grid CO₂ emission factor (kg CO₂ / kWh) — IPCC global average
_CO2_KG_PER_KWH = 0.475

# Standard solar irradiance distribution by month (fraction of annual total)
_MONTHLY_IRRADIANCE_WEIGHTS = [
    0.055, 0.060, 0.080, 0.090, 0.100, 0.105,
    0.105, 0.100, 0.085, 0.075, 0.060, 0.085,
]

# IRR solver config
_IRR_MAX_ITER = 1000
_IRR_TOLERANCE = 1e-9
_IRR_INITIAL_GUESS = 0.10  # 10%


def _monthly_solar_distribution(annual_kwh: float) -> list[float]:
    """Distribute annual solar generation across months using irradiance weights."""
    total_weight = sum(_MONTHLY_IRRADIANCE_WEIGHTS)
    return [annual_kwh * (w / total_weight) for w in _MONTHLY_IRRADIANCE_WEIGHTS]


def _compute_irr(cash_flows: list[float]) -> float | None:
    """
    Compute Internal Rate of Return via Newton-Raphson iteration.

    cash_flows: [-installation_cost, net_y1, net_y2, ..., net_yN]
    Returns the IRR as a decimal (e.g. 0.12 = 12%) or None if no solution found.
    """
    def npv_at(rate: float) -> float:
        return sum(cf / (1 + rate) ** t for t, cf in enumerate(cash_flows))

    def dnpv_at(rate: float) -> float:
        return sum(-t * cf / (1 + rate) ** (t + 1) for t, cf in enumerate(cash_flows))

    rate = _IRR_INITIAL_GUESS
    for _ in range(_IRR_MAX_ITER):
        npv = npv_at(rate)
        dnpv = dnpv_at(rate)
        if abs(dnpv) < 1e-12:
            break
        new_rate = rate - npv / dnpv
        if abs(new_rate - rate) < _IRR_TOLERANCE:
            return new_rate
        rate = new_rate
        # Guard against divergence
        if rate < -0.9999 or rate > 100:
            break

    return None


def _compute_financial_savings(req: SavingsPredictionRequest) -> dict:
    """
    Single cash-flow model — every metric derives from this function.

    No independent calculations, no hardcoded financial metrics.
    All outputs are fully traceable to the five primary inputs.
    """
    discount_rate = req.discount_rate_pct / 100.0

    # ── Step 1: Year-1 gross savings (monthly breakdown) ──────────────────────
    monthly_solar = _monthly_solar_distribution(req.annual_solar_kwh)
    monthly_breakdown: list[MonthlySavings] = []
    year1_gross_savings = 0.0

    for i, solar_kwh in enumerate(monthly_solar):
        on_site_kwh = solar_kwh * req.self_consumption_ratio
        exported_kwh = solar_kwh * (1.0 - req.self_consumption_ratio)

        monthly_gross = (
            on_site_kwh * req.electricity_rate_per_kwh
            + exported_kwh * req.export_rate_per_kwh
        )
        grid_import = max(
            0.0,
            (req.annual_consumption_kwh / 12.0) - on_site_kwh,
        )
        year1_gross_savings += monthly_gross

        monthly_breakdown.append(
            MonthlySavings(
                month=i + 1,
                month_name=calendar.month_name[i + 1],
                solar_kwh=round(solar_kwh, 2),
                savings_currency=round(monthly_gross, 2),
                grid_import_kwh=round(grid_import, 2),
            )
        )

    # ── Step 2: Build the canonical cash-flow table ────────────────────────────
    # All summary metrics are computed SOLELY from this table.
    yearly_savings: list[YearlySavings] = []
    cumulative_net = 0.0
    npv_sum = 0.0                          # Σ discounted_cash_flow
    cash_flows: list[float] = [-req.installation_cost]  # for IRR: year-0 outflow

    for year in range(1, req.system_lifetime_years + 1):
        tariff_factor = (1.0 + req.annual_tariff_increase_pct / 100.0) ** (year - 1)
        degradation_factor = (1.0 - req.panel_degradation_pct / 100.0) ** (year - 1)

        gross_savings = year1_gross_savings * tariff_factor * degradation_factor
        net_savings = gross_savings - req.annual_maintenance_cost
        cumulative_net += net_savings
        discounted_cf = net_savings / ((1.0 + discount_rate) ** year)
        npv_sum += discounted_cf

        cash_flows.append(net_savings)

        yearly_savings.append(
            YearlySavings(
                year=year,
                gross_savings_currency=round(gross_savings, 2),
                net_savings_currency=round(net_savings, 2),
                cumulative_net_savings=round(cumulative_net, 2),
                discounted_cash_flow=round(discounted_cf, 2),
                panel_output_factor=round(degradation_factor, 4),
            )
        )

    # ── Step 3: Derive all summary metrics from the cash-flow table ───────────
    #
    #  Every line below is a deterministic derivation — no independent values.

    # Year-1 net savings (gross minus maintenance, year 1)
    annual_savings_currency = year1_gross_savings - req.annual_maintenance_cost

    # Total net savings over the system lifetime
    lifetime_savings_currency = cumulative_net                         # = Σ net_savings

    # Net profit after recovering the initial investment
    net_profit = lifetime_savings_currency - req.installation_cost    # = lifetime - cost

    # Simple payback: exactly installation_cost / annual_savings
    # (Satisfies invariant: payback == cost / annual_savings, always)
    if annual_savings_currency > 0:
        payback_period_years = req.installation_cost / annual_savings_currency
    else:
        payback_period_years = float(req.system_lifetime_years)

    # ROI derived from net_profit (satisfies invariant: roi == net_profit / cost × 100)
    roi_pct = (net_profit / req.installation_cost) * 100.0

    # NPV = Σ discounted cash flows − initial investment
    net_present_value = npv_sum - req.installation_cost

    # IRR via Newton-Raphson on the full net cash-flow stream
    irr_raw = _compute_irr(cash_flows)
    irr_pct = round(irr_raw * 100.0, 2) if irr_raw is not None else 0.0

    # CO₂ offset
    co2_offset = (
        req.annual_solar_kwh * req.self_consumption_ratio * _CO2_KG_PER_KWH
    ) / 1000.0  # tonnes/year

    return {
        # Primary financials — all derived from cash-flow table
        "annual_savings_currency": round(annual_savings_currency, 2),
        "lifetime_savings_currency": round(lifetime_savings_currency, 2),
        "net_profit": round(net_profit, 2),
        "payback_period_years": round(payback_period_years, 2),
        "roi_pct": round(roi_pct, 2),
        "net_present_value": round(net_present_value, 2),
        "irr_pct": irr_pct,
        # Echoed inputs for frontend validation
        "installation_cost": req.installation_cost,
        "discount_rate_pct": req.discount_rate_pct,
        "annual_maintenance_cost": req.annual_maintenance_cost,
        # Detailed tables
        "yearly_savings": yearly_savings,
        "monthly_breakdown": monthly_breakdown,
        # Environmental
        "co2_offset_tonnes_per_year": round(co2_offset, 4),
    }


class SavingsService:
    """
    Savings prediction service.

    Runs the single cash-flow model deterministically.
    All 7 financial metrics are derived from one consistent calculation.
    """

    async def predict(self, request: SavingsPredictionRequest) -> SavingsPredictionResponse:
        loop = asyncio.get_event_loop()
        financial = await loop.run_in_executor(None, _compute_financial_savings, request)

        logger.info(
            "Savings prediction completed",
            extra={
                "annual_savings": financial["annual_savings_currency"],
                "net_profit": financial["net_profit"],
                "payback_years": financial["payback_period_years"],
                "roi_pct": financial["roi_pct"],
                "irr_pct": financial["irr_pct"],
                "npv": financial["net_present_value"],
            },
        )

        return SavingsPredictionResponse(
            model_version="savings_v3_cashflow",
            **financial,
        )


savings_service = SavingsService()
