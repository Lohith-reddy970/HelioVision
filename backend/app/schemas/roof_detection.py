"""
Pydantic schemas for the Roof Detection API.
"""

from enum import Enum

from pydantic import Field

from app.schemas.common import BaseSchema


class RoofOrientation(str, Enum):
    NORTH = "north"
    NORTH_EAST = "north_east"
    EAST = "east"
    SOUTH_EAST = "south_east"
    SOUTH = "south"
    SOUTH_WEST = "south_west"
    WEST = "west"
    NORTH_WEST = "north_west"
    FLAT = "flat"
    UNKNOWN = "unknown"


class ShadingLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class InstallationSuitability(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    UNSUITABLE = "unsuitable"


class DetectedRoofSegment(BaseSchema):
    """One roof segment identified by YOLO and converted to footprint geometry."""

    segment_id: int
    confidence: float = Field(..., ge=0.0, le=1.0, description="YOLO detection confidence")
    area_m2: float = Field(..., ge=0.0, description="Estimated roof footprint area in m2")
    usable_area_m2: float = Field(..., ge=0.0, description="Usable roof area in m2")
    panel_placement_area_m2: float = Field(
        default=0.0,
        ge=0.0,
        description="Installed module footprint on this segment after panel-count flooring",
    )
    pixel_count: float = Field(
        default=0.0,
        ge=0.0,
        description="Roof footprint pixels from mask or conservative polygon",
    )
    raw_bounding_box_area_m2: float = Field(
        default=0.0,
        ge=0.0,
        description="Raw YOLO bounding-box area retained for validation only",
    )
    utilization_factor: float = Field(default=0.0, ge=0.0, le=1.0)
    geometry_source: str = Field(
        default="unknown",
        description="segmentation_mask, oriented_box, or polygon_fallback",
    )
    polygon: list[dict[str, float]] = Field(
        default_factory=list,
        description="Roof footprint polygon in image pixel coordinates",
    )
    orientation: RoofOrientation
    tilt_degrees: float = Field(..., ge=0.0, le=90.0)
    shading_level: ShadingLevel
    bounding_box: dict = Field(
        ..., description="YOLO bounding box: {x1, y1, x2, y2, width, height}"
    )


class RoofDetectionResponse(BaseSchema):
    """Full result returned from the roof detection endpoint."""

    # Detection meta
    image_filename: str
    image_width_px: int
    image_height_px: int
    processing_time_ms: float

    # Detected segments
    total_segments_detected: int
    segments: list[DetectedRoofSegment]

    # Engineering response schema
    roof_area_m2: float = Field(..., ge=0.0)
    usable_area_m2: float = Field(..., ge=0.0)
    panel_placement_area_m2: float = Field(..., ge=0.0)
    estimated_panel_count: int = Field(..., ge=0)
    capacity_kwp: float = Field(..., ge=0.0)
    detection_confidence: float = Field(
        ..., ge=0.0, le=100.0, description="Area-weighted YOLO confidence as a percentage"
    )
    warnings: list[str] = Field(default_factory=list)

    # Calibration Diagnostics
    raw_roof_area_m2: float = Field(..., ge=0.0, description="Raw uncalibrated roof area sum")
    calibration_factor: float = Field(..., ge=0.0, description="Auto-calibration multiplier applied")
    engineering_validation_applied: bool = Field(..., description="Whether bounds constraints were applied")

    # Backwards-compatible aliases used by the current frontend
    total_roof_area_m2: float = Field(..., ge=0.0)
    total_usable_area_m2: float = Field(..., ge=0.0)
    estimated_system_capacity_kw: float = Field(
        ..., ge=0.0, description="Estimated installable system capacity in kWp"
    )
    estimated_annual_generation_kwh: float = Field(
        ..., ge=0.0, description="Rough annual generation estimate in kWh"
    )

    # Engineering context
    maximum_feasible_capacity_kwp: float = Field(
        ..., ge=0.0, description="Engineering cap from roof_area_m2 * 0.85 * 0.23"
    )
    dominant_orientation: RoofOrientation
    overall_shading: ShadingLevel
    suitability: InstallationSuitability

    # Advisory
    recommendations: list[str] = Field(
        ..., description="List of advisory recommendation strings"
    )
    model_version: str = Field(default="yolov8_engineering_v3")
