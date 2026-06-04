"""
Geometry helpers for converting detections into roof footprints.

The key rule is that bounding boxes are metadata only. Area is calculated from
segmentation masks when available, or from a conservative footprint polygon when
the model only returns boxes.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import numpy as np

Point = tuple[float, float]


@dataclass(frozen=True)
class RoofGeometryEstimate:
    polygon: list[dict[str, float]]
    pixel_count: float
    roof_area_m2: float
    raw_bounding_box_area_m2: float
    geometry_source: str


def polygon_pixel_area(points: Sequence[Point]) -> float:
    """Return the absolute area of a polygon in image pixels."""
    if len(points) < 3:
        return 0.0

    area = 0.0
    point_count = len(points)
    for index, (x1, y1) in enumerate(points):
        x2, y2 = points[(index + 1) % point_count]
        area += (x1 * y2) - (x2 * y1)
    return abs(area) / 2.0


def polygon_bounding_box(points: Sequence[Point]) -> tuple[float, float, float, float]:
    if not points:
        return 0.0, 0.0, 0.0, 0.0

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def bbox_pixel_area(x1: float, y1: float, x2: float, y2: float) -> float:
    return max(0.0, abs(x2 - x1) * abs(y2 - y1))


def bbox_to_conservative_polygon(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    footprint_factor: float = 0.82,
) -> list[Point]:
    """
    Approximate a roof footprint when no mask exists.

    The polygon is intentionally smaller than the YOLO bounding box to avoid
    treating pavement, shadow, landscaping, and box padding as roof geometry.
    """
    width = abs(x2 - x1)
    height = abs(y2 - y1)
    if width <= 0 or height <= 0:
        return []

    factor = min(max(footprint_factor, 0.2), 0.98)
    scale = math.sqrt(factor)
    center_x = (x1 + x2) / 2.0
    center_y = (y1 + y2) / 2.0
    half_width = (width * scale) / 2.0
    half_height = (height * scale) / 2.0

    left = center_x - half_width
    right = center_x + half_width
    top = center_y - half_height
    bottom = center_y + half_height

    return [(left, top), (right, top), (right, bottom), (left, bottom)]


def normalise_polygon(points: Sequence[Point], max_points: int = 80) -> list[dict[str, float]]:
    """
    Convert a point list into a compact JSON-safe polygon.

    Masks can contain hundreds of contour points. Sampling keeps responses small
    while preserving the footprint shape for the frontend overlay.
    """
    if len(points) <= max_points:
        selected = points
    else:
        step = math.ceil(len(points) / max_points)
        selected = points[::step]

    return [{"x": round(float(x), 2), "y": round(float(y), 2)} for x, y in selected]


def mask_pixel_count(mask: object, image_width: int, image_height: int) -> float:
    """
    Count active pixels from a YOLO mask and scale to the source image size.
    """
    if hasattr(mask, "detach"):
        mask = mask.detach()
    if hasattr(mask, "cpu"):
        mask = mask.cpu()
    if hasattr(mask, "numpy"):
        mask = mask.numpy()

    mask_array = np.asarray(mask)
    if mask_array.ndim > 2:
        mask_array = np.squeeze(mask_array)
    if mask_array.ndim != 2:
        return 0.0

    active_pixels = float(np.count_nonzero(mask_array > 0.5))
    mask_height, mask_width = mask_array.shape
    if mask_width <= 0 or mask_height <= 0:
        return active_pixels

    scale = (image_width / mask_width) * (image_height / mask_height)
    return active_pixels * scale


def estimate_from_polygon(
    points: Sequence[Point],
    meters_per_pixel: float,
    geometry_source: str,
    pixel_count: float | None = None,
) -> RoofGeometryEstimate:
    if not points:
        return RoofGeometryEstimate(
            polygon=[],
            pixel_count=0.0,
            roof_area_m2=0.0,
            raw_bounding_box_area_m2=0.0,
            geometry_source=geometry_source,
        )

    x1, y1, x2, y2 = polygon_bounding_box(points)
    bbox_area_px = bbox_pixel_area(x1, y1, x2, y2)
    footprint_pixels = pixel_count if pixel_count is not None else polygon_pixel_area(points)
    footprint_pixels = max(0.0, float(footprint_pixels))
    square_meters_per_pixel = meters_per_pixel * meters_per_pixel

    return RoofGeometryEstimate(
        polygon=normalise_polygon(points),
        pixel_count=round(footprint_pixels, 2),
        roof_area_m2=round(footprint_pixels * square_meters_per_pixel, 2),
        raw_bounding_box_area_m2=round(bbox_area_px * square_meters_per_pixel, 2),
        geometry_source=geometry_source,
    )
