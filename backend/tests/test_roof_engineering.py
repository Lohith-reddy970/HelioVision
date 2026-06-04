import math

import pytest

from app.services.roof_geometry import (
    bbox_to_conservative_polygon,
    estimate_from_polygon,
    polygon_pixel_area,
)
from app.services.solar_sizing import (
    ENGINEERING_CAP_WARNING,
    SolarSizingConfig,
    calculate_solar_sizing,
)


def _rotated_rectangle(
    center_x: float,
    center_y: float,
    width: float,
    height: float,
    degrees: float,
) -> list[tuple[float, float]]:
    radians = math.radians(degrees)
    cos_a = math.cos(radians)
    sin_a = math.sin(radians)
    corners = [
        (-width / 2, -height / 2),
        (width / 2, -height / 2),
        (width / 2, height / 2),
        (-width / 2, height / 2),
    ]
    return [
        (center_x + (x * cos_a - y * sin_a), center_y + (x * sin_a + y * cos_a))
        for x, y in corners
    ]


def test_polygon_fallback_is_smaller_than_raw_bounding_box_area():
    polygon = bbox_to_conservative_polygon(0, 0, 100, 100)

    assert polygon_pixel_area(polygon) == pytest.approx(8200.0)
    assert polygon_pixel_area(polygon) < 100 * 100


@pytest.mark.parametrize(
    ("roof_type", "roof_area_m2", "expected_utilization"),
    [
        ("residential", 120.0, 0.65),
        ("commercial", 300.0, 0.70),
        ("warehouse", 900.0, 0.80),
    ],
)
def test_dynamic_utilization_and_panel_count_by_roof_type(
    roof_type: str,
    roof_area_m2: float,
    expected_utilization: float,
):
    result = calculate_solar_sizing(roof_area_m2)
    expected_panels = math.floor((roof_area_m2 * expected_utilization) / 2.4)

    assert roof_type
    assert result.utilization_factor == pytest.approx(expected_utilization)
    assert result.usable_area_m2 == pytest.approx(round(roof_area_m2 * expected_utilization, 2))
    assert result.estimated_panel_count == expected_panels
    assert result.capacity_kwp == pytest.approx(round((expected_panels * 550.0) / 1000.0, 2))
    assert result.capacity_kwp <= result.maximum_feasible_capacity_kwp


def test_capacity_is_capped_to_physical_engineering_limit():
    aggressive_config = SolarSizingConfig(panel_area_m2=1.0, panel_wattage_w=550.0)

    result = calculate_solar_sizing(1000.0, aggressive_config)

    assert ENGINEERING_CAP_WARNING in result.warnings
    assert result.capacity_kwp <= result.maximum_feasible_capacity_kwp
    assert result.capacity_kwp == pytest.approx(
        round((result.estimated_panel_count * aggressive_config.panel_wattage_w) / 1000.0, 2)
    )


def test_l_shaped_roof_uses_polygon_area_not_bounding_box_area():
    l_shape = [(0, 0), (100, 0), (100, 40), (40, 40), (40, 100), (0, 100)]

    geometry = estimate_from_polygon(l_shape, meters_per_pixel=0.1, geometry_source="test")

    assert polygon_pixel_area(l_shape) == pytest.approx(6400.0)
    assert geometry.roof_area_m2 == pytest.approx(64.0)
    assert geometry.roof_area_m2 < geometry.raw_bounding_box_area_m2


def test_rotated_roof_uses_polygon_area_not_axis_aligned_box_area():
    rotated = _rotated_rectangle(100, 100, width=100, height=40, degrees=35)

    geometry = estimate_from_polygon(rotated, meters_per_pixel=0.1, geometry_source="test")

    assert polygon_pixel_area(rotated) == pytest.approx(4000.0)
    assert geometry.roof_area_m2 == pytest.approx(40.0)
    assert geometry.roof_area_m2 < geometry.raw_bounding_box_area_m2
