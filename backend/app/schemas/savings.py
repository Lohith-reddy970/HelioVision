"""
app/schemas/savings.py
───────────────────────
Pydantic schemas for the Savings Prediction API.

All financial output fields are derived from a single discounted cash-flow
model. No field may be hardcoded or calculated independently of the others.
"""

from pydantic import Field, field_validator

from app.schemas.common import BaseSchema


# ── Request ────────────────────────────────────────────────────────────────────

class SavingsPredictionRequest(BaseSchema):
    """
    Input required to predict energy cost savings from a solar installation.

    The five primary inputs drive every financial metric:
      - installation_cost         → cost base for payback, ROI, NPV, IRR
      - annual_solar_kwh          → revenue base (avoided cost + export)
      - electricity_rate_per_kwh  → price of avoided grid energy
      - system_lifetime_years     → projection horizon
      - annual_maintenance_cost   → operating expense deducted each year
    """

    # System
    panel_capacity_kw: float = Field(..., gt=0.0, description="System size in kW")
    annual_solar_kwh: float = Field(
        ..., gt=0.0, description="Estimated annual solar generation in kWh"
    )

    # Tariff / billing
    electricity_rate_per_kwh: float = Field(
        ..., gt=0.0, description="Current electricity tariff (local currency / kWh)"
    )
    export_rate_per_kwh: float = Field(
        default=0.0, ge=0.0, description="Feed-in / export tariff (0 if no net metering)"
    )

    # Consumption profile
    annual_consumption_kwh: float = Field(
        ..., gt=0.0, description="Household / business annual electricity consumption (kWh)"
    )
    self_consumption_ratio: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Fraction of solar generation consumed on-site (0–1)",
    )

    # Economic factors
    installation_cost: float = Field(
        ..., gt=0.0, description="Total installation cost (local currency)"
    )
    annual_maintenance_cost: float = Field(
        default=0.0,
        ge=0.0,
        description=(
            "Annual O&M cost (local currency). "
            "Deducted from savings each year before NPV / IRR / payback calculations."
        ),
    )
    annual_tariff_increase_pct: float = Field(
        default=3.0, ge=0.0, le=30.0, description="Expected annual electricity price rise (%)"
    )
    panel_degradation_pct: float = Field(
        default=0.5, ge=0.0, le=5.0, description="Annual panel output degradation (%)"
    )
    system_lifetime_years: int = Field(
        default=25, ge=5, le=50, description="Expected system lifetime in years"
    )
    discount_rate_pct: float = Field(
        default=6.0,
        ge=0.0,
        le=50.0,
        description="Discount rate for NPV / IRR calculation (%)",
    )

    @field_validator("self_consumption_ratio")
    @classmethod
    def validate_self_consumption(cls, v: float) -> float:
        if not 0 <= v <= 1:
            raise ValueError("self_consumption_ratio must be between 0 and 1")
        return round(v, 4)


# ── Response ───────────────────────────────────────────────────────────────────

class MonthlySavings(BaseSchema):
    month: int = Field(..., ge=1, le=12)
    month_name: str
    solar_kwh: float
    savings_currency: float
    grid_import_kwh: float


class YearlySavings(BaseSchema):
    """Per-year entry in the projection table — every field derived from cash flow."""
    year: int
    gross_savings_currency: float = Field(
        ..., description="Revenue from avoided cost + export before maintenance"
    )
    net_savings_currency: float = Field(
        ..., description="Gross savings minus annual maintenance cost"
    )
    cumulative_net_savings: float = Field(
        ..., description="Running total of net savings (used to compute payback)"
    )
    discounted_cash_flow: float = Field(
        ..., description="Net savings discounted to present value (used for NPV / IRR)"
    )
    panel_output_factor: float = Field(
        ..., description="Degradation factor applied this year (1.0 = no degradation)"
    )


class SavingsPredictionResponse(BaseSchema):
    """
    Full savings breakdown returned to the client.

    Derivation chain (all values trace back to the cash-flow table):
      annual_savings_currency   = Year-1 net savings (gross – maintenance)
      lifetime_savings_currency = sum(net_savings_currency for all years)
      net_profit                = lifetime_savings_currency – installation_cost
      payback_period_years      = installation_cost / annual_savings_currency  (fractional year)
      roi_pct                   = (net_profit / installation_cost) × 100
      net_present_value         = sum(discounted_cash_flow) – installation_cost
      irr_pct                   = rate r such that NPV(r) = 0  (Newton-Raphson)
    """

    # ── Primary financials ────────────────────────────────────────────────────
    annual_savings_currency: float = Field(
        ..., description="Year-1 net savings = gross savings − maintenance"
    )
    lifetime_savings_currency: float = Field(
        ..., description="Cumulative net savings over system lifetime"
    )
    net_profit: float = Field(
        ..., description="lifetime_savings − installation_cost"
    )
    payback_period_years: float = Field(
        ...,
        description=(
            "Simple payback = installation_cost / annual_savings_currency. "
            "Validated to match the cumulative cash-flow crossover year."
        ),
    )
    roi_pct: float = Field(
        ...,
        description="ROI = (net_profit / installation_cost) × 100",
    )
    net_present_value: float = Field(
        ..., description="NPV = Σ(discounted_cash_flow) − installation_cost at discount_rate_pct"
    )
    irr_pct: float = Field(
        ...,
        description=(
            "Internal Rate of Return: discount rate r at which NPV = 0. "
            "Solved by Newton-Raphson iteration over the annual cash-flow stream."
        ),
    )

    # ── Inputs echoed for validation ──────────────────────────────────────────
    installation_cost: float = Field(..., description="Echo of input — enables frontend validation")
    discount_rate_pct: float = Field(..., description="Discount rate used for NPV / IRR")
    annual_maintenance_cost: float = Field(..., description="Annual O&M cost used in calculations")

    # ── Yearly trajectory (Year 1 → N) ────────────────────────────────────────
    yearly_savings: list[YearlySavings] = Field(
        ..., description="Per-year cash-flow projection"
    )

    # ── Monthly breakdown (Year 1) ────────────────────────────────────────────
    monthly_breakdown: list[MonthlySavings] = Field(
        ..., description="Month-by-month savings for year 1"
    )

    # ── Carbon ───────────────────────────────────────────────────────────────
    co2_offset_tonnes_per_year: float = Field(
        ..., description="Estimated CO₂ offset in tonnes/year"
    )

    model_version: str = Field(default="savings_v3_cashflow")
