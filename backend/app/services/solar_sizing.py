"""
Engineering-grade solar sizing from roof geometry.

Capacity is never estimated directly from area. The pipeline is:
roof area -> usable area -> panel count -> capacity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import floor


ENGINEERING_CAP_WARNING = (
    "Estimated capacity exceeded engineering limits and has been adjusted to "
    "the maximum feasible value."
)


@dataclass(frozen=True)
class SolarSizingConfig:
    panel_area_m2: float = 2.4
    panel_wattage_w: float = 550.0
    kwh_per_kwp_per_year: float = 1150.0
    max_roof_coverage_factor: float = 0.85
    max_module_power_density_kw_per_m2: float = 0.23


@dataclass(frozen=True)
class SolarSizingResult:
    roof_area_m2: float
    utilization_factor: float
    usable_area_m2: float
    panel_placement_area_m2: float
    estimated_panel_count: int
    capacity_kwp: float
    maximum_feasible_capacity_kwp: float
    estimated_annual_generation_kwh: float
    warnings: list[str] = field(default_factory=list)


def utilization_factor_for_roof(roof_area_m2: float) -> float:
    if roof_area_m2 < 150.0:
        return 0.65
    if roof_area_m2 <= 500.0:
        return 0.70
    return 0.80


def calculate_solar_sizing(
    roof_area_m2: float,
    config: SolarSizingConfig | None = None,
) -> SolarSizingResult:
    cfg = config or SolarSizingConfig()
    warnings: list[str] = []

    if roof_area_m2 <= 0:
        return SolarSizingResult(
            roof_area_m2=0.0,
            utilization_factor=0.0,
            usable_area_m2=0.0,
            panel_placement_area_m2=0.0,
            estimated_panel_count=0,
            capacity_kwp=0.0,
            maximum_feasible_capacity_kwp=0.0,
            estimated_annual_generation_kwh=0.0,
            warnings=["No roof geometry detected; solar sizing was skipped."],
        )

    panel_area_m2 = cfg.panel_area_m2 if cfg.panel_area_m2 > 0 else 2.4
    panel_wattage_w = cfg.panel_wattage_w if cfg.panel_wattage_w > 0 else 550.0

    utilization_factor = utilization_factor_for_roof(roof_area_m2)
    usable_area_m2 = roof_area_m2 * utilization_factor
    estimated_panel_count = floor(usable_area_m2 / panel_area_m2)
    panel_placement_area_m2 = estimated_panel_count * panel_area_m2
    capacity_kwp = (estimated_panel_count * panel_wattage_w) / 1000.0

    maximum_feasible_capacity_kwp = (
        roof_area_m2
        * cfg.max_roof_coverage_factor
        * cfg.max_module_power_density_kw_per_m2
    )

    if capacity_kwp > maximum_feasible_capacity_kwp:
        max_panel_count = floor((maximum_feasible_capacity_kwp * 1000.0) / panel_wattage_w)
        estimated_panel_count = max(0, max_panel_count)
        panel_placement_area_m2 = estimated_panel_count * panel_area_m2
        capacity_kwp = (estimated_panel_count * panel_wattage_w) / 1000.0
        warnings.append(ENGINEERING_CAP_WARNING)

    return SolarSizingResult(
        roof_area_m2=round(roof_area_m2, 2),
        utilization_factor=round(utilization_factor, 4),
        usable_area_m2=round(usable_area_m2, 2),
        panel_placement_area_m2=round(panel_placement_area_m2, 2),
        estimated_panel_count=estimated_panel_count,
        capacity_kwp=round(capacity_kwp, 2),
        maximum_feasible_capacity_kwp=round(maximum_feasible_capacity_kwp, 2),
        estimated_annual_generation_kwh=round(capacity_kwp * cfg.kwh_per_kwp_per_year, 0),
        warnings=warnings,
    )
