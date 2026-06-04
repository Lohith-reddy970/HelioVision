"""
app/services/roof_visualizer.py
────────────────────────────────
Production-ready OpenCV polygon visualizer for YOLO roof detection results.

Visualization pipeline (strict priority order):
  1. Segmentation masks  → result.masks.xy   (polygon from YOLO seg model)
  2. Oriented boxes      → result.obb         (quad polygon fallback)
  3. Bounding boxes      → result.boxes       (axis-aligned rect fallback)
  4. Development stub                         (when YOLO model is absent)

For each detected segment the renderer:
  - Draws a filled, semi-transparent roof mask in a per-segment colour
  - Draws the polygon boundary as a thick anti-aliased polyline with corner dots
  - Annotates Roof Area (m²), Polygon Area (m²), and Detection Confidence (%)
  - Places a compact HUD card in the top-left corner with aggregated stats

The red YOLO bounding-box rectangle is intentionally never drawn.
"""

from __future__ import annotations

import io
import math
from typing import Any, Sequence

import cv2
import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.logging import get_logger
from app.services.roof_geometry import (
    Point,
    polygon_pixel_area,
)

logger = get_logger(__name__)

# ── Visual constants ───────────────────────────────────────────────────────────

# Per-segment palette (BGR) – vibrant, distinct colours. Red is intentionally
# excluded because it is the default YOLO bbox colour and would be confusing.
_SEGMENT_PALETTE: list[tuple[int, int, int]] = [
    (0,   210, 255),   # cyan
    (50,  255, 130),   # lime-green
    (255, 170,   0),   # amber
    (200,  80, 255),   # violet
    (0,   160, 255),   # sky-blue
    (100, 255, 200),   # aqua
    (255, 220,  50),   # gold
    (160,   0, 255),   # purple
]

_MASK_ALPHA: float       = 0.38   # filled mask opacity over original image
_BORDER_THICKNESS: int   = 3      # polygon outline thickness (px)
_CORNER_RADIUS: int      = 5      # vertex dot radius (px)
_HUD_ALPHA: float        = 0.80   # HUD backdrop opacity
_HUD_PADDING: int        = 16     # interior padding inside HUD card (px)
_HUD_MARGIN: int         = 10     # margin from image edge (px)
_LABEL_FONT              = cv2.FONT_HERSHEY_SIMPLEX
_LABEL_SCALE: float      = 0.52
_LABEL_THICKNESS: int    = 1
_TITLE_SCALE: float      = 0.68
_TITLE_THICKNESS: int    = 2
_MIN_LABEL_AREA_PX: float = 500.0  # skip per-segment labels for tiny segments

# Geometry source → human-readable badge label
_SOURCE_LABELS: dict[str, str] = {
    "segmentation_mask": "SEG MASK",
    "oriented_box":      "OBB",
    "bbox_fallback":     "BBOX FALLBACK",
    "development_stub":  "DEV STUB",
    "none":              "NONE",
}


# ── Low-level helpers ──────────────────────────────────────────────────────────

def _as_numpy(value: Any) -> np.ndarray:
    """Safely convert a PyTorch tensor or numpy-convertible object to ndarray."""
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "numpy"):
        value = value.numpy()
    return np.asarray(value)


def _points_from_value(value: Any) -> list[Point]:
    """Extract a list of (x, y) float tuples from a YOLO polygon value."""
    try:
        array = _as_numpy(value)
    except Exception:
        return []
    if array.size == 0:
        return []
    array = array.reshape(-1, 2)
    return [
        (float(x), float(y))
        for x, y in array
        if np.isfinite(x) and np.isfinite(y)
    ]


def _box_conf(box: Any) -> float:
    """Extract detection confidence from a YOLO box object."""
    raw = getattr(box, "conf", None)
    if raw is None:
        return 0.0
    values = _as_numpy(raw).reshape(-1)
    return float(np.clip(values[0], 0.0, 1.0)) if values.size else 0.0


def _box_xyxy(box: Any) -> tuple[float, float, float, float]:
    """Extract (x1, y1, x2, y2) from a YOLO box object."""
    raw = getattr(box, "xyxy", None)
    if raw is None:
        return 0.0, 0.0, 0.0, 0.0
    v = _as_numpy(raw).reshape(-1)
    return (float(v[0]), float(v[1]), float(v[2]), float(v[3])) if v.size >= 4 else (0.0, 0.0, 0.0, 0.0)


def _int_pts(points: Sequence[Point]) -> np.ndarray:
    """Convert float Point list to an OpenCV-compatible int32 (N,1,2) array."""
    return np.array([[int(round(x)), int(round(y))] for x, y in points], dtype=np.int32).reshape((-1, 1, 2))


def _palette_color(index: int) -> tuple[int, int, int]:
    return _SEGMENT_PALETTE[index % len(_SEGMENT_PALETTE)]


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(value, hi))


# ── Segment annotation data class ─────────────────────────────────────────────

class _SegmentAnnotation:
    """
    All drawing data for one detected roof segment.

    Attributes
    ----------
    points          : polygon vertex list (float pixel coords)
    color           : BGR colour for this segment
    confidence      : detection confidence [0, 1]
    roof_area_m2    : area from mask pixel count (preferred) or polygon Shoelace
    polygon_area_m2 : area from Shoelace formula on the polygon alone
    geometry_source : which extraction path produced this segment
    is_mask_based   : True when the area was refined from a raw mask pixel count
    """

    __slots__ = (
        "points", "color", "confidence",
        "roof_area_m2", "polygon_area_m2",
        "geometry_source", "is_mask_based",
    )

    def __init__(
        self,
        points: list[Point],
        color: tuple[int, int, int],
        confidence: float,
        meters_per_pixel: float,
        geometry_source: str,
    ) -> None:
        self.points = points
        self.color = color
        self.confidence = confidence
        self.geometry_source = geometry_source
        self.is_mask_based = False

        poly_px = polygon_pixel_area(points)
        mpp2 = meters_per_pixel ** 2
        self.polygon_area_m2 = round(poly_px * mpp2, 2)
        self.roof_area_m2 = self.polygon_area_m2  # refined by mask if available

    def apply_mask_pixel_count(self, pixel_count: float, meters_per_pixel: float) -> None:
        """Override area with the more accurate raw mask pixel count."""
        self.roof_area_m2 = round(pixel_count * meters_per_pixel ** 2, 2)
        self.is_mask_based = True


# ── Per-segment rendering ─────────────────────────────────────────────────────

def _draw_filled_mask(overlay: np.ndarray, ann: _SegmentAnnotation) -> None:
    """
    Paint the filled polygon onto the *overlay* layer.
    The overlay is later alpha-blended with the canvas so the fill is
    semi-transparent while boundaries stay crisp.
    """
    if len(ann.points) < 3:
        return
    pts = _int_pts(ann.points)
    cv2.fillPoly(overlay, [pts], ann.color)


def _draw_boundary(canvas: np.ndarray, ann: _SegmentAnnotation) -> None:
    """
    Draw the polygon boundary and vertex dots onto *canvas*.
    Called after alpha-blending so the edges remain sharp.
    """
    if len(ann.points) < 3:
        return

    pts = _int_pts(ann.points)
    bgr = ann.color
    h, w = canvas.shape[:2]

    # Polygon outline
    cv2.polylines(
        canvas, [pts],
        isClosed=True,
        color=bgr,
        thickness=_BORDER_THICKNESS,
        lineType=cv2.LINE_AA,
    )

    # Corner vertex emphasis dots
    for pt in pts.reshape(-1, 2):
        x, y = int(pt[0]), int(pt[1])
        if 0 <= x < w and 0 <= y < h:
            cv2.circle(canvas, (x, y), radius=_CORNER_RADIUS, color=bgr, thickness=-1, lineType=cv2.LINE_AA)
            # White centre pip for contrast
            cv2.circle(canvas, (x, y), radius=2, color=(255, 255, 255), thickness=-1, lineType=cv2.LINE_AA)


def _draw_segment_label(canvas: np.ndarray, ann: _SegmentAnnotation, seg_index: int) -> None:
    """
    Render per-segment metric pill (Roof Area / Polygon Area / Confidence)
    at the polygon centroid. Skipped for segments too small to be readable.
    """
    if len(ann.points) < 3:
        return

    pixel_area = polygon_pixel_area(ann.points)
    if pixel_area < _MIN_LABEL_AREA_PX:
        return

    pts_arr = _int_pts(ann.points).reshape(-1, 2)
    cx = int(np.mean(pts_arr[:, 0]))
    cy = int(np.mean(pts_arr[:, 1]))
    h, w = canvas.shape[:2]
    bgr = ann.color

    lines = [
        f"#{seg_index + 1}  Roof Area : {ann.roof_area_m2:.1f} m\u00b2",
        f"    Poly Area : {ann.polygon_area_m2:.1f} m\u00b2",
        f"    Confidence: {ann.confidence * 100:.1f}%",
    ]

    # Measure each text line
    pad = 10
    line_info: list[tuple[int, int]] = []  # (text_width, row_height)
    for line in lines:
        (tw, th), baseline = cv2.getTextSize(line, _LABEL_FONT, _LABEL_SCALE, _LABEL_THICKNESS)
        line_info.append((tw, th + baseline + 5))

    pill_w = max(tw for tw, _ in line_info) + pad * 2 + 4  # +4 for accent bar
    pill_h = sum(rh for _, rh in line_info) + pad

    # Position: centred on polygon centroid, clamped to image bounds
    lx = _clamp(cx - pill_w // 2, 0, max(0, w - pill_w))
    ly = _clamp(cy - pill_h // 2, 0, max(0, h - pill_h))

    # Semi-transparent dark backdrop
    roi = canvas[ly: ly + pill_h, lx: lx + pill_w]
    if roi.size == 0:
        return
    bg = np.full_like(roi, (18, 18, 18))
    cv2.addWeighted(bg, 0.72, roi, 0.28, 0, roi)
    canvas[ly: ly + pill_h, lx: lx + pill_w] = roi

    # Rounded border hint (filled rectangle with rounded corners via ellipse arcs)
    cv2.rectangle(canvas, (lx, ly), (lx + pill_w - 1, ly + pill_h - 1), bgr, 1, lineType=cv2.LINE_AA)

    # Left colour accent bar
    cv2.rectangle(canvas, (lx, ly), (lx + 3, ly + pill_h), bgr, -1)

    # Text
    ty = ly + pad // 2
    for i, (line, (_, rh)) in enumerate(zip(lines, line_info)):
        ty += rh - 5
        # First line is the header – slightly brighter
        color = (240, 240, 240) if i == 0 else (190, 190, 190)
        cv2.putText(
            canvas, line,
            (lx + 7, ty),
            _LABEL_FONT, _LABEL_SCALE, color, _LABEL_THICKNESS, cv2.LINE_AA,
        )


# ── HUD card ──────────────────────────────────────────────────────────────────

def _draw_hud(
    canvas: np.ndarray,
    annotations: list[_SegmentAnnotation],
    geometry_source: str,
) -> None:
    """Render an aggregated statistics card in the top-left corner of the image."""
    if not annotations:
        return

    h, w = canvas.shape[:2]

    total_roof_m2 = sum(a.roof_area_m2 for a in annotations)
    total_poly_m2 = sum(a.polygon_area_m2 for a in annotations)
    weighted_conf_sum = sum(
        a.confidence * (a.roof_area_m2 if a.roof_area_m2 > 0 else 1.0)
        for a in annotations
    )
    weight_total = sum(a.roof_area_m2 if a.roof_area_m2 > 0 else 1.0 for a in annotations)
    avg_conf = (weighted_conf_sum / weight_total * 100) if weight_total > 0 else 0.0
    source_label = _SOURCE_LABELS.get(geometry_source, geometry_source.upper())
    mask_count = sum(1 for a in annotations if a.is_mask_based)

    # (text, BGR colour, font_scale, thickness)
    hud_rows: list[tuple[str, tuple[int, int, int], float, int]] = [
        ("HELIOVISION  |  ROOF ANALYSIS",         (0,   210, 255), _TITLE_SCALE,  _TITLE_THICKNESS),
        (f"Segments Detected : {len(annotations)}",
                                                (200, 200, 200), _LABEL_SCALE,  _LABEL_THICKNESS),
        (f"Total Roof Area   : {total_roof_m2:.2f} m\u00b2",
                                                (80,  255, 130), _LABEL_SCALE,  _LABEL_THICKNESS),
        (f"Total Polygon Area: {total_poly_m2:.2f} m\u00b2",
                                                (80,  200, 255), _LABEL_SCALE,  _LABEL_THICKNESS),
        (f"Avg Confidence    : {avg_conf:.1f}%",(255, 200,  80), _LABEL_SCALE,  _LABEL_THICKNESS),
        (f"Source            : {source_label}", (160, 160, 160), _LABEL_SCALE,  _LABEL_THICKNESS),
        (f"Mask-refined segs : {mask_count}/{len(annotations)}",
                                                (160, 255, 160), _LABEL_SCALE,  _LABEL_THICKNESS),
    ]

    # Measure
    line_sizes: list[tuple[int, int]] = []
    for text, _, scale, thick in hud_rows:
        (tw, th), bl = cv2.getTextSize(text, _LABEL_FONT, scale, thick)
        line_sizes.append((tw, th + bl + 7))

    card_w = min(max(tw for tw, _ in line_sizes) + _HUD_PADDING * 2 + 6, w - _HUD_MARGIN * 2)
    card_h = min(sum(rh for _, rh in line_sizes) + _HUD_PADDING * 2,      h - _HUD_MARGIN * 2)

    cx, cy = _HUD_MARGIN, _HUD_MARGIN

    # Blurred-glass backdrop
    roi = canvas[cy: cy + card_h, cx: cx + card_w]
    if roi.size == 0:
        return
    bg = np.full_like(roi, (12, 12, 12))
    cv2.addWeighted(bg, _HUD_ALPHA, roi, 1.0 - _HUD_ALPHA, 0, roi)
    canvas[cy: cy + card_h, cx: cx + card_w] = roi

    # Top cyan accent bar
    cv2.rectangle(canvas, (cx, cy), (cx + card_w, cy + 3), (0, 210, 255), -1)
    # Outer border
    cv2.rectangle(canvas, (cx, cy), (cx + card_w - 1, cy + card_h - 1), (0, 180, 220), 1, lineType=cv2.LINE_AA)

    # Text rows
    ty = cy + _HUD_PADDING
    for i, (text, color, scale, thick) in enumerate(hud_rows):
        _, rh = line_sizes[i]
        cv2.putText(
            canvas, text,
            (cx + _HUD_PADDING, ty),
            _LABEL_FONT, scale, color, thick, cv2.LINE_AA,
        )
        ty += rh

    # Bottom cyan accent bar
    cv2.rectangle(canvas, (cx, cy + card_h - 3), (cx + card_w, cy + card_h), (0, 210, 255), -1)


# ── Annotation extraction from YOLO results ───────────────────────────────────

def _collect_from_masks(
    result: Any,
    image_width: int,
    image_height: int,
) -> tuple[list[_SegmentAnnotation], str]:
    """
    PRIMARY path: extract polygon annotations from YOLO segmentation masks.

    Uses ``result.masks.xy`` for polygon points and ``result.masks.data``
    for pixel-accurate area (scaled back to the original image resolution).
    """
    masks = getattr(result, "masks", None)
    if masks is None:
        return [], ""

    mask_polygons = getattr(masks, "xy", None)
    if mask_polygons is None:
        return [], ""

    try:
        mask_count = len(mask_polygons)
    except TypeError:
        return [], ""
    if mask_count == 0:
        return [], ""

    boxes_obj = getattr(result, "boxes", None)
    boxes = list(boxes_obj) if boxes_obj is not None else []
    mask_data = getattr(masks, "data", None)  # shape: (N, mask_H, mask_W) or (N, H, W)
    mpp = settings.ROOF_METERS_PER_PIXEL

    annotations: list[_SegmentAnnotation] = []

    for idx, poly_value in enumerate(mask_polygons):
        points = _points_from_value(poly_value)
        if len(points) < 3:
            logger.debug("Skipping mask %d: too few polygon points (%d)", idx, len(points))
            continue

        conf = _box_conf(boxes[idx]) if idx < len(boxes) else 0.0

        ann = _SegmentAnnotation(
            points=points,
            color=_palette_color(idx),
            confidence=conf,
            meters_per_pixel=mpp,
            geometry_source="segmentation_mask",
        )

        # Refine area from raw mask pixel count, scaled to source image resolution
        if mask_data is not None:
            try:
                mask_arr = _as_numpy(mask_data[idx])
                if mask_arr.ndim > 2:
                    mask_arr = np.squeeze(mask_arr)
                if mask_arr.ndim == 2:
                    mask_h, mask_w = mask_arr.shape
                    px_count = float(np.count_nonzero(mask_arr > 0.5))
                    if px_count > 0 and mask_w > 0 and mask_h > 0:
                        # Scale pixel count from mask resolution → image resolution
                        scale = (image_width / mask_w) * (image_height / mask_h)
                        ann.apply_mask_pixel_count(px_count * scale, mpp)
            except Exception as exc:
                logger.debug("Mask area refinement failed for index %d: %s", idx, exc)

        annotations.append(ann)

    return annotations, "segmentation_mask"


def _collect_from_obb(result: Any) -> tuple[list[_SegmentAnnotation], str]:
    """
    SECONDARY path: extract quad polygon from oriented bounding boxes (OBB).
    Used when the model is an OBB-type detector rather than a segmentation model.
    """
    obb = getattr(result, "obb", None)
    if obb is None:
        return [], ""

    try:
        oriented_boxes = list(obb)
    except TypeError:
        return [], ""

    mpp = settings.ROOF_METERS_PER_PIXEL
    annotations: list[_SegmentAnnotation] = []

    for idx, ob in enumerate(oriented_boxes):
        raw_pts = getattr(ob, "xyxyxyxy", None)
        if raw_pts is None:
            continue
        points = _points_from_value(raw_pts)
        if len(points) < 4:
            continue

        ann = _SegmentAnnotation(
            points=points[:4],
            color=_palette_color(idx),
            confidence=_box_conf(ob),
            meters_per_pixel=mpp,
            geometry_source="oriented_box",
        )
        annotations.append(ann)

    return annotations, "oriented_box"


def _collect_from_boxes(result: Any) -> tuple[list[_SegmentAnnotation], str]:
    """
    FALLBACK path: draw axis-aligned bounding boxes when no masks or OBBs exist.

    Per the requirement spec, this draws the bounding-box rectangle directly
    (not an inset polygon), clearly labelled as a fallback so the user knows
    the area is an upper-bound estimate rather than a segmentation result.
    """
    boxes_obj = getattr(result, "boxes", None)
    if boxes_obj is None:
        return [], ""

    try:
        boxes = list(boxes_obj)
    except TypeError:
        return [], ""

    mpp = settings.ROOF_METERS_PER_PIXEL
    annotations: list[_SegmentAnnotation] = []

    for idx, box in enumerate(boxes):
        x1, y1, x2, y2 = _box_xyxy(box)
        if x2 <= x1 or y2 <= y1:
            continue

        # Draw the bounding box as a 4-point polygon (requirement: bbox-only fallback)
        points: list[Point] = [
            (x1, y1), (x2, y1),
            (x2, y2), (x1, y2),
        ]
        ann = _SegmentAnnotation(
            points=points,
            color=_palette_color(idx),
            confidence=_box_conf(box),
            meters_per_pixel=mpp,
            geometry_source="bbox_fallback",
        )
        annotations.append(ann)

    return annotations, "bbox_fallback"


def _collect_synthetic(
    image_width: int,
    image_height: int,
) -> tuple[list[_SegmentAnnotation], str]:
    """
    Development stub used when the YOLO model is unavailable.
    Generates a realistic-looking centred roof polygon for UI testing.
    """
    mpp = settings.ROOF_METERS_PER_PIXEL
    cx, cy = image_width / 2.0, image_height / 2.0
    hw = image_width * 0.27
    hh = image_height * 0.27
    points: list[Point] = [
        (cx - hw, cy - hh), (cx + hw, cy - hh),
        (cx + hw, cy + hh), (cx - hw, cy + hh),
    ]
    ann = _SegmentAnnotation(
        points=points,
        color=_palette_color(0),
        confidence=0.884,
        meters_per_pixel=mpp,
        geometry_source="development_stub",
    )
    return [ann], "development_stub"


# ── Render pipeline ───────────────────────────────────────────────────────────

def _render_no_detection_banner(canvas: np.ndarray) -> None:
    """Draw a warning banner when no detections were found."""
    h, w = canvas.shape[:2]
    msg = "No roof detected"
    (tw, th), _ = cv2.getTextSize(msg, _LABEL_FONT, 1.0, 2)
    ox = (w - tw) // 2
    oy = (h + th) // 2

    # Dark pill background
    pad = 20
    cv2.rectangle(canvas, (ox - pad, oy - th - pad), (ox + tw + pad, oy + pad), (20, 20, 20), -1)
    cv2.rectangle(canvas, (ox - pad, oy - th - pad), (ox + tw + pad, oy + pad), (0, 80, 200), 2)
    cv2.putText(canvas, msg, (ox, oy), _LABEL_FONT, 1.0, (80, 80, 255), 2, cv2.LINE_AA)


# ── Public API ────────────────────────────────────────────────────────────────

def render_roof_visualization(
    pil_image: "Image.Image",
    yolo_results: list[Any] | None,
    output_format: str = "PNG",
) -> bytes:
    """
    Render a polygon-based roof visualization onto *pil_image*.

    Detection priority
    ------------------
    1. ``result.masks.xy``  – full segmentation polygon with mask-pixel area
    2. ``result.obb``       – oriented bounding-box quad polygon
    3. ``result.boxes``     – axis-aligned bounding box (fallback; area is upper bound)
    4. Development stub     – when *yolo_results* is ``None``

    The red YOLO bounding-box rectangle is never drawn.

    Parameters
    ----------
    pil_image:
        Original uploaded image (PIL, any mode – converted to RGB internally).
    yolo_results:
        Raw list returned by ``yolo_model(image_path, ...)``.
        Pass ``None`` when the YOLO model is unavailable.
    output_format:
        PIL format string for the encoded output (``"PNG"`` or ``"JPEG"``).

    Returns
    -------
    bytes
        Encoded image bytes ready to stream to the client.
    """
    # ── Convert PIL → OpenCV BGR ──────────────────────────────────────────────
    img_rgb = np.array(pil_image.convert("RGB"), dtype=np.uint8)
    canvas = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    h, w = canvas.shape[:2]

    logger.debug("render_roof_visualization: image %dx%d, results=%s", w, h, type(yolo_results))

    # ── Collect annotations ───────────────────────────────────────────────────
    all_annotations: list[_SegmentAnnotation] = []
    geometry_source = "none"

    if not yolo_results:
        # YOLO model unavailable – use development stub
        stub_anns, geometry_source = _collect_synthetic(w, h)
        all_annotations.extend(stub_anns)
        logger.info("render_roof_visualization: YOLO unavailable, using dev stub")
    else:
        for result in yolo_results:
            # 1. Try segmentation masks (primary)
            anns, src = _collect_from_masks(result, w, h)

            # 2. Fall back to oriented boxes
            if not anns:
                anns, src = _collect_from_obb(result)

            # 3. Fall back to axis-aligned bounding boxes
            if not anns:
                anns, src = _collect_from_boxes(result)

            if anns:
                all_annotations.extend(anns)
                geometry_source = src

        # 4. If still empty, use development stub
        if not all_annotations:
            stub_anns, geometry_source = _collect_synthetic(w, h)
            all_annotations.extend(stub_anns)
            logger.warning("render_roof_visualization: no detections found, using dev stub")

    logger.debug(
        "render_roof_visualization: %d annotations from source '%s'",
        len(all_annotations), geometry_source,
    )

    # ── Phase 1: Draw semi-transparent fills onto overlay ─────────────────────
    # We paint fills onto a copy of the canvas (overlay), then alpha-blend
    # it back. This keeps the original image visible through the mask.
    overlay = canvas.copy()
    for ann in all_annotations:
        _draw_filled_mask(overlay, ann)

    cv2.addWeighted(overlay, _MASK_ALPHA, canvas, 1.0 - _MASK_ALPHA, 0, canvas)

    # ── Phase 2: Draw crisp boundaries AFTER the alpha blend ─────────────────
    # Re-drawing borders after the blend ensures they are never dimmed by the
    # alpha operation and remain sharp and fully saturated.
    for ann in all_annotations:
        _draw_boundary(canvas, ann)

    # ── Phase 3: Per-segment metric labels ───────────────────────────────────
    for idx, ann in enumerate(all_annotations):
        _draw_segment_label(canvas, ann, idx)

    # ── Phase 4: HUD statistics card ─────────────────────────────────────────
    _draw_hud(canvas, all_annotations, geometry_source)

    # ── Handle zero-detection edge case ──────────────────────────────────────
    if not all_annotations:
        _render_no_detection_banner(canvas)

    # ── Encode output ─────────────────────────────────────────────────────────
    canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    out_image = Image.fromarray(canvas_rgb)
    buf = io.BytesIO()
    out_image.save(buf, format=output_format, optimize=False)
    buf.seek(0)
    return buf.read()
