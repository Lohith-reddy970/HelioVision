"""
Business logic for engineering-grade roof detection and solar sizing.

Pipeline:
  YOLO detection -> segmentation mask or conservative polygon fallback
  -> pixel-count roof area -> usable area -> panel count -> capacity
  -> engineering validation.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.model_registry import ModelRegistry
from app.schemas.roof_detection import (
    DetectedRoofSegment,
    InstallationSuitability,
    RoofDetectionResponse,
    RoofOrientation,
    ShadingLevel,
)
from app.services.roof_geometry import (
    Point,
    bbox_pixel_area,
    bbox_to_conservative_polygon,
    estimate_from_polygon,
    mask_pixel_count,
    polygon_bounding_box,
)
from app.services.solar_sizing import (
    ENGINEERING_CAP_WARNING,
    SolarSizingConfig,
    calculate_solar_sizing,
)

logger = get_logger(__name__)

_CONF_THRESHOLD = 0.35
_FALLBACK_FOOTPRINT_FACTOR = 0.82
_FALLBACK_WARNING = (
    "Segmentation mask unavailable; used conservative polygon approximation "
    "instead of raw bounding-box area."
)



def _as_numpy(value: Any) -> np.ndarray:
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "numpy"):
        value = value.numpy()
    return np.asarray(value)


def _points_from_value(value: Any) -> list[Point]:
    array = _as_numpy(value)
    if array.size == 0:
        return []
    array = array.reshape(-1, 2)
    return [
        (float(x), float(y))
        for x, y in array
        if np.isfinite(x) and np.isfinite(y)
    ]


def _box_xyxy(box: Any) -> tuple[float, float, float, float]:
    raw = getattr(box, "xyxy", None)
    if raw is None:
        return 0.0, 0.0, 0.0, 0.0

    values = _as_numpy(raw).reshape(-1)
    if values.size < 4:
        return 0.0, 0.0, 0.0, 0.0
    return float(values[0]), float(values[1]), float(values[2]), float(values[3])


def _box_confidence(box: Any, default: float = 0.0) -> float:
    raw = getattr(box, "conf", None)
    if raw is None:
        return default

    values = _as_numpy(raw).reshape(-1)
    if values.size == 0:
        return default
    return max(0.0, min(1.0, float(values[0])))


def _bbox_dict(x1: float, y1: float, x2: float, y2: float) -> dict[str, float]:
    left = min(x1, x2)
    right = max(x1, x2)
    top = min(y1, y2)
    bottom = max(y1, y2)
    return {
        "x1": round(left, 2),
        "y1": round(top, 2),
        "x2": round(right, 2),
        "y2": round(bottom, 2),
        "width": round(right - left, 2),
        "height": round(bottom - top, 2),
    }


def _classify_shading(confidence: float) -> ShadingLevel:
    if confidence > 0.85:
        return ShadingLevel.NONE
    if confidence > 0.70:
        return ShadingLevel.LOW
    if confidence > 0.50:
        return ShadingLevel.MODERATE
    return ShadingLevel.HIGH


def _classify_orientation_from_polygon(points: list[Point]) -> RoofOrientation:
    if len(points) < 3:
        return RoofOrientation.UNKNOWN

    x1, y1, x2, y2 = polygon_bounding_box(points)
    width = abs(x2 - x1)
    height = abs(y2 - y1)
    if width <= 0 or height <= 0:
        return RoofOrientation.UNKNOWN

    ratio = width / height
    if ratio > 2.0:
        return RoofOrientation.EAST
    if ratio < 0.5:
        return RoofOrientation.SOUTH
    return RoofOrientation.SOUTH_EAST


def _classify_suitability(
    usable_area_m2: float,
    dominant_orientation: RoofOrientation,
    overall_shading: ShadingLevel,
) -> InstallationSuitability:
    if usable_area_m2 < 5:
        return InstallationSuitability.UNSUITABLE
    if overall_shading == ShadingLevel.HIGH:
        return InstallationSuitability.POOR
    if dominant_orientation in (RoofOrientation.SOUTH, RoofOrientation.SOUTH_EAST):
        if usable_area_m2 >= 30:
            return InstallationSuitability.EXCELLENT
        return InstallationSuitability.GOOD
    if overall_shading == ShadingLevel.MODERATE:
        return InstallationSuitability.FAIR
    return InstallationSuitability.GOOD


def _calculate_iou(box1: dict[str, float], box2: dict[str, float]) -> float:
    xA = max(box1["x1"], box2["x1"])
    yA = max(box1["y1"], box2["y1"])
    xB = min(box1["x2"], box2["x2"])
    yB = min(box1["y2"], box2["y2"])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    if interArea == 0:
        return 0.0

    box1Area = box1["width"] * box1["height"]
    box2Area = box2["width"] * box2["height"]

    return interArea / float(box1Area + box2Area - interArea)


def _filter_overlapping_segments(segments: list[DetectedRoofSegment], iou_threshold: float = 0.5) -> list[DetectedRoofSegment]:
    if not segments:
        return []

    sorted_segments = sorted(segments, key=lambda s: s.confidence, reverse=True)
    kept_segments: list[DetectedRoofSegment] = []

    for segment in sorted_segments:
        keep = True
        for kept in kept_segments:
            iou = _calculate_iou(segment.bounding_box, kept.bounding_box)
            if iou > iou_threshold:
                keep = False
                break
        if keep:
            kept_segments.append(segment)

    return kept_segments


def _calibrate_roof_area(
    raw_area_m2: float, 
    segments: list[DetectedRoofSegment], 
    image_width: int, 
    image_height: int
) -> tuple[float, float, bool]:
    if raw_area_m2 <= 0 or not segments:
        return 0.0, 1.0, False
        
    calibration_factor = 1.0
    
    total_image_pixels = image_width * image_height
    total_roof_pixels = sum(s.pixel_count for s in segments if s.pixel_count is not None)
    
    if total_roof_pixels == 0:
        total_roof_pixels = sum(s.bounding_box["width"] * s.bounding_box["height"] for s in segments)
        
    coverage_pct = total_roof_pixels / total_image_pixels if total_image_pixels > 0 else 0
    
    if coverage_pct > 0.8:
        calibration_factor *= 0.6
    elif coverage_pct > 0.6:
        calibration_factor *= 0.8
        
    avg_confidence = sum(s.confidence for s in segments) / len(segments)
    if avg_confidence < 0.5:
        calibration_factor *= 0.8
    elif avg_confidence < 0.7:
        calibration_factor *= 0.9
        
    if raw_area_m2 > 2000:
        scaling_penalty = max(0.6, 1.0 - ((raw_area_m2 - 2000) / 10000) * 0.4)
        calibration_factor *= scaling_penalty

    calibrated_area_m2 = raw_area_m2 * calibration_factor
    
    engineering_validation_applied = False
    MAX_WAREHOUSE_AREA = 10000.0
    
    if calibrated_area_m2 > MAX_WAREHOUSE_AREA:
        calibrated_area_m2 = MAX_WAREHOUSE_AREA
        calibration_factor = calibrated_area_m2 / raw_area_m2
        engineering_validation_applied = True
        
    return round(calibrated_area_m2, 2), round(calibration_factor, 4), engineering_validation_applied


def _build_recommendations(
    segments: list[DetectedRoofSegment],
    suitability: InstallationSuitability,
    warnings: list[str],
) -> list[str]:
    recommendations: list[str] = []

    if suitability == InstallationSuitability.EXCELLENT:
        recommendations.append("Excellent roof suitability; maximize system size for ROI.")
    elif suitability == InstallationSuitability.GOOD:
        recommendations.append("Good installation candidate; confirm panel layout setbacks.")
    elif suitability in (InstallationSuitability.FAIR, InstallationSuitability.POOR):
        recommendations.append("Review shading and obstruction constraints before installation.")
    else:
        recommendations.append("Roof area may be insufficient for a viable solar installation.")

    if any(s.shading_level in (ShadingLevel.MODERATE, ShadingLevel.HIGH) for s in segments):
        recommendations.append("Shading risk detected on one or more roof segments.")

    if len(segments) > 1:
        recommendations.append(
            f"{len(segments)} roof segments detected; use segmented array layout planning."
        )

    if warnings:
        recommendations.append("Engineering warnings were generated; review adjusted values.")

    return recommendations


def _make_segment(
    segment_id: int,
    confidence: float,
    points: list[Point],
    geometry_source: str,
    bbox: tuple[float, float, float, float],
    pixel_count: float | None = None,
) -> DetectedRoofSegment | None:
    geometry = estimate_from_polygon(
        points=points,
        meters_per_pixel=settings.ROOF_METERS_PER_PIXEL,
        geometry_source=geometry_source,
        pixel_count=pixel_count,
    )
    if geometry.roof_area_m2 <= 0:
        return None

    raw_bbox_area = bbox_pixel_area(*bbox) * settings.ROOF_METERS_PER_PIXEL**2
    raw_bbox_area = max(raw_bbox_area, geometry.raw_bounding_box_area_m2)

    return DetectedRoofSegment(
        segment_id=segment_id,
        confidence=round(confidence, 4),
        area_m2=geometry.roof_area_m2,
        usable_area_m2=0.0,
        panel_placement_area_m2=0.0,
        pixel_count=geometry.pixel_count,
        raw_bounding_box_area_m2=round(raw_bbox_area, 2),
        utilization_factor=0.0,
        geometry_source=geometry.geometry_source,
        polygon=geometry.polygon,
        orientation=_classify_orientation_from_polygon(points),
        tilt_degrees=30.0,
        shading_level=_classify_shading(confidence),
        bounding_box=_bbox_dict(*bbox),
    )


def _synthetic_detection(
    image_width: int,
    image_height: int,
) -> tuple[list[DetectedRoofSegment], list[str]]:
    target_area_m2 = 120.0
    target_pixels = target_area_m2 / (settings.ROOF_METERS_PER_PIXEL**2)
    image_pixels = max(1, image_width * image_height)
    footprint_pixels = min(target_pixels, image_pixels * 0.18)
    width_px = min(image_width * 0.55, max(20.0, (footprint_pixels * 1.2) ** 0.5))
    height_px = max(20.0, footprint_pixels / width_px)
    height_px = min(height_px, image_height * 0.55)

    center_x = image_width / 2.0
    center_y = image_height / 2.0
    x1 = center_x - width_px / 2.0
    x2 = center_x + width_px / 2.0
    y1 = center_y - height_px / 2.0
    y2 = center_y + height_px / 2.0
    polygon = [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]

    segment = _make_segment(
        segment_id=0,
        confidence=0.884,
        points=polygon,
        geometry_source="development_stub_polygon",
        bbox=(x1, y1, x2, y2),
    )

    warning = "YOLO model unavailable; returned conservative development stub geometry."
    return ([segment] if segment else []), [warning]


def _segments_from_masks(
    result: Any,
    image_width: int,
    image_height: int,
) -> list[DetectedRoofSegment]:
    masks = getattr(result, "masks", None)
    mask_polygons = getattr(masks, "xy", None) if masks is not None else None
    if mask_polygons is None:
        return []
    try:
        mask_count = len(mask_polygons)
    except TypeError:
        mask_count = 0
    if mask_count == 0:
        return []

    boxes_obj = getattr(result, "boxes", None)
    boxes = list(boxes_obj) if boxes_obj is not None else []
    mask_data = getattr(masks, "data", None)
    segments: list[DetectedRoofSegment] = []

    for index, polygon_value in enumerate(mask_polygons):
        points = _points_from_value(polygon_value)
        if len(points) < 3:
            continue

        if index < len(boxes):
            bbox = _box_xyxy(boxes[index])
            confidence = _box_confidence(boxes[index])
        else:
            bbox = polygon_bounding_box(points)
            confidence = 0.0

        pixels: float | None = None
        if mask_data is not None:
            try:
                count = mask_pixel_count(mask_data[index], image_width, image_height)
                pixels = count if count > 0 else None
            except Exception:
                pixels = None

        segment = _make_segment(
            segment_id=index,
            confidence=confidence,
            points=points,
            geometry_source="segmentation_mask",
            bbox=bbox,
            pixel_count=pixels,
        )
        if segment:
            segments.append(segment)

    return segments


def _segments_from_oriented_boxes(result: Any) -> list[DetectedRoofSegment]:
    obb = getattr(result, "obb", None)
    if obb is None:
        return []

    try:
        oriented_boxes = list(obb)
    except TypeError:
        oriented_boxes = []

    segments: list[DetectedRoofSegment] = []
    for index, oriented_box in enumerate(oriented_boxes):
        raw_points = getattr(oriented_box, "xyxyxyxy", None)
        if raw_points is None:
            continue

        points = _points_from_value(raw_points)
        if len(points) < 4:
            continue

        bbox = polygon_bounding_box(points)
        confidence = _box_confidence(oriented_box)
        segment = _make_segment(
            segment_id=index,
            confidence=confidence,
            points=points[:4],
            geometry_source="oriented_box_polygon",
            bbox=bbox,
        )
        if segment:
            segments.append(segment)

    return segments


def _segments_from_boxes(result: Any) -> tuple[list[DetectedRoofSegment], list[str]]:
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return [], []

    segments: list[DetectedRoofSegment] = []
    for index, box in enumerate(list(boxes)):
        x1, y1, x2, y2 = _box_xyxy(box)
        polygon = bbox_to_conservative_polygon(
            x1,
            y1,
            x2,
            y2,
            footprint_factor=_FALLBACK_FOOTPRINT_FACTOR,
        )
        if len(polygon) < 3:
            continue

        segment = _make_segment(
            segment_id=index,
            confidence=_box_confidence(box),
            points=polygon,
            geometry_source="polygon_fallback",
            bbox=(x1, y1, x2, y2),
        )
        if segment:
            segments.append(segment)

    return segments, ([_FALLBACK_WARNING] if segments else [])


def _run_yolo_inference(
    yolo_model: Any,
    image_path: Path,
    image_width: int,
    image_height: int,
) -> tuple[list[DetectedRoofSegment], list[str]]:
    if yolo_model is None:
        logger.warning("YOLO model is unavailable; using development stub")
        return _synthetic_detection(image_width, image_height)

    results = yolo_model(str(image_path), conf=_CONF_THRESHOLD, verbose=False)
    all_segments: list[DetectedRoofSegment] = []
    warnings: list[str] = []

    for result in results:
        segments = _segments_from_masks(result, image_width, image_height)
        if not segments:
            segments = _segments_from_oriented_boxes(result)
        if not segments:
            segments, fallback_warnings = _segments_from_boxes(result)
            warnings.extend(fallback_warnings)

        all_segments.extend(segments)

    return all_segments, list(dict.fromkeys(warnings))


def _run_yolo_raw(
    yolo_model: Any,
    image_path: Path,
) -> list[Any] | None:
    """
    Run YOLO inference and return the raw result objects (for visualisation).
    Returns None when the model is unavailable so the visualiser can use its stub.
    """
    if yolo_model is None:
        return None
    try:
        return list(yolo_model(str(image_path), conf=_CONF_THRESHOLD, verbose=False))
    except Exception as exc:  # pragma: no cover
        logger.warning("YOLO raw inference failed", extra={"error": str(exc)})
        return None


def _aggregate_detection_confidence(segments: list[DetectedRoofSegment]) -> float:
    if not segments:
        return 0.0

    total_area = sum(segment.area_m2 for segment in segments)
    if total_area > 0:
        weighted = sum(segment.confidence * segment.area_m2 for segment in segments) / total_area
    else:
        weighted = sum(segment.confidence for segment in segments) / len(segments)

    return round(weighted * 100.0, 1)


def _allocate_segment_sizing(
    segments: list[DetectedRoofSegment],
    total_area_m2: float,
    usable_area_m2: float,
    panel_placement_area_m2: float,
    utilization_factor: float,
) -> None:
    if not segments or total_area_m2 <= 0:
        return

    for segment in segments:
        ratio = segment.area_m2 / total_area_m2
        segment.usable_area_m2 = round(usable_area_m2 * ratio, 2)
        segment.panel_placement_area_m2 = round(panel_placement_area_m2 * ratio, 2)
        segment.utilization_factor = utilization_factor


class RoofDetectionService:
    async def analyze(
        self,
        image: Image.Image,
        filename: str,
        temp_image_path: Path,
    ) -> RoofDetectionResponse:
        yolo_model = ModelRegistry._store.get("roof_detection")
        start_time = time.perf_counter()
        image_width, image_height = image.size

        loop = asyncio.get_event_loop()
        segments, warnings = await loop.run_in_executor(
            None,
            _run_yolo_inference,
            yolo_model,
            temp_image_path,
            image_width,
            image_height,
        )

        if not segments:
            warnings.append("No roof geometry detected; solar sizing was skipped.")
            logger.warning("No roof segments detected", extra={"original_filename": filename})

        segments = _filter_overlapping_segments(segments, iou_threshold=0.5)
        raw_total_area = round(sum(segment.area_m2 for segment in segments), 2)
        
        calibrated_area, calibration_factor, eng_validation_applied = _calibrate_roof_area(
            raw_total_area, segments, image_width, image_height
        )
        
        if eng_validation_applied:
            warnings.append("Area adjusted using engineering validation constraints.")

        total_area = calibrated_area
        sizing = calculate_solar_sizing(
            total_area,
            SolarSizingConfig(
                panel_area_m2=settings.SOLAR_PANEL_AREA_M2,
                panel_wattage_w=settings.SOLAR_PANEL_WATTAGE_W,
                kwh_per_kwp_per_year=settings.SOLAR_KWH_PER_KWP_PER_YEAR,
                max_roof_coverage_factor=settings.SOLAR_MAX_ROOF_COVERAGE_FACTOR,
                max_module_power_density_kw_per_m2=(
                    settings.SOLAR_MAX_MODULE_POWER_DENSITY_KW_PER_M2
                ),
            ),
        )
        warnings.extend(sizing.warnings)
        warnings = list(dict.fromkeys(warnings))

        if ENGINEERING_CAP_WARNING in sizing.warnings:
            logger.warning(
                "Engineering validation capped solar capacity",
                extra={
                    "original_filename": filename,
                    "roof_area_m2": total_area,
                    "maximum_feasible_capacity_kwp": sizing.maximum_feasible_capacity_kwp,
                    "adjusted_capacity_kwp": sizing.capacity_kwp,
                    "estimated_panel_count": sizing.estimated_panel_count,
                },
            )

        _allocate_segment_sizing(
            segments,
            total_area_m2=total_area,
            usable_area_m2=sizing.usable_area_m2,
            panel_placement_area_m2=sizing.panel_placement_area_m2,
            utilization_factor=sizing.utilization_factor,
        )

        dominant_orientation = (
            max(segments, key=lambda s: s.usable_area_m2).orientation
            if segments
            else RoofOrientation.UNKNOWN
        )
        shading_order = [
            ShadingLevel.NONE,
            ShadingLevel.LOW,
            ShadingLevel.MODERATE,
            ShadingLevel.HIGH,
        ]
        overall_shading = (
            max(segments, key=lambda s: shading_order.index(s.shading_level)).shading_level
            if segments
            else ShadingLevel.NONE
        )
        suitability = _classify_suitability(
            sizing.usable_area_m2,
            dominant_orientation,
            overall_shading,
        )
        detection_confidence = _aggregate_detection_confidence(segments)
        processing_ms = round((time.perf_counter() - start_time) * 1000, 2)
        recommendations = _build_recommendations(segments, suitability, warnings)

        logger.info(
            "Roof detection completed",
            extra={
                "original_filename": filename,
                "segments": len(segments),
                "roof_area_m2": sizing.roof_area_m2,
                "usable_area_m2": sizing.usable_area_m2,
                "panel_count": sizing.estimated_panel_count,
                "capacity_kwp": sizing.capacity_kwp,
                "detection_confidence": detection_confidence,
                "warnings": warnings,
                "processing_ms": processing_ms,
            },
        )

        return RoofDetectionResponse(
            image_filename=filename,
            image_width_px=image_width,
            image_height_px=image_height,
            processing_time_ms=processing_ms,
            total_segments_detected=len(segments),
            segments=segments,
            roof_area_m2=sizing.roof_area_m2,
            usable_area_m2=sizing.usable_area_m2,
            panel_placement_area_m2=sizing.panel_placement_area_m2,
            estimated_panel_count=sizing.estimated_panel_count,
            capacity_kwp=sizing.capacity_kwp,
            detection_confidence=detection_confidence,
            warnings=warnings,
            total_roof_area_m2=sizing.roof_area_m2,
            total_usable_area_m2=sizing.usable_area_m2,
            estimated_system_capacity_kw=sizing.capacity_kwp,
            estimated_annual_generation_kwh=sizing.estimated_annual_generation_kwh,
            maximum_feasible_capacity_kwp=sizing.maximum_feasible_capacity_kwp,
            dominant_orientation=dominant_orientation,
            overall_shading=overall_shading,
            suitability=suitability,
            recommendations=recommendations,
            raw_roof_area_m2=raw_total_area,
            calibration_factor=calibration_factor,
            engineering_validation_applied=eng_validation_applied,
        )


    async def visualize(
        self,
        image: Image.Image,
        temp_image_path: Path,
    ) -> bytes:
        """
        Run YOLO inference and return an OpenCV-rendered PNG with polygon
        overlays, semi-transparent fills, and metric annotations burned in.

        Priority order:
          1. Segmentation masks  (result.masks.xy)
          2. Oriented boxes      (result.obb)
          3. Bounding-box fallback
          4. Development stub    (when YOLO model is absent)
        """
        from app.services.roof_visualizer import render_roof_visualization

        yolo_model = ModelRegistry._store.get("roof_detection")
        loop = asyncio.get_event_loop()

        yolo_results = await loop.run_in_executor(
            None,
            _run_yolo_raw,
            yolo_model,
            temp_image_path,
        )

        png_bytes = await loop.run_in_executor(
            None,
            render_roof_visualization,
            image,
            yolo_results,
            "PNG",
        )
        return png_bytes


roof_detection_service = RoofDetectionService()
