"""
app/api/v1/roof_detection.py
─────────────────────────────
Roof Detection API — with DI, rate limiting, and streaming async upload.

Endpoints:
  POST /api/v1/roof/analyze         – upload image, get roof analysis (rate: 10/min)
  GET  /api/v1/roof/supported-formats – accepted image types
"""

from fastapi import APIRouter, File, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
import io

from app.core.dependencies import ApiKey, RoofSvc
from app.core.rate_limit import LIMIT_FILE_UPLOAD, limiter
from app.schemas.common import SuccessResponse
from app.schemas.roof_detection import RoofDetectionResponse
from app.utils.file_utils import delete_file, save_upload, validate_and_read_image
from app.utils.response_utils import ok
from app.core.config import settings

router = APIRouter(
    prefix="/roof",
    tags=["Roof Detection"],
)


@router.post(
    "/analyze",
    response_model=SuccessResponse[RoofDetectionResponse],
    status_code=status.HTTP_200_OK,
    summary="Analyze Roof for Solar Potential",
    description=(
        "Upload a satellite or aerial image of a rooftop. "
        "The YOLOv8 model detects roof segments, converts masks or conservative "
        "fallback polygons into roof geometry, determines usable area, and "
        "calculates physically constrained solar sizing from panel count. "
        "**Rate limit: 10 requests/minute per IP (heavy inference).**"
    ),
)
@limiter.limit(LIMIT_FILE_UPLOAD)
async def analyze_roof(
    request: Request,
    api_key: ApiKey,
    service: RoofSvc,
    file: UploadFile = File(
        ...,
        description="Satellite or aerial rooftop image (JPEG, PNG, or WebP). Max 10 MB.",
    ),
) -> SuccessResponse[RoofDetectionResponse]:
    """
    **Input:** Satellite/aerial rooftop image (JPEG/PNG/WebP, max 10 MB).

    **Output:**
    - Detected roof segments with mask/polygon area, orientation, shading
    - Detected, usable, and panel placement area in m2
    - Estimated panel count and system capacity (kWp)
    - Detection confidence directly from YOLO confidence
    - Engineering validation warnings when values are adjusted
    - Estimated annual generation (kWh)
    - Installation suitability rating
    - Actionable recommendations

    **Notes:**
    - Image should be a top-down aerial view for best accuracy
    - Higher resolution = more accurate results
    - YOLO model runs in thread pool — does not block event loop
    """
    # 1. Validate and decode image (async read, then CPU validation in executor)
    image, raw_bytes = await validate_and_read_image(file)

    # 2. Persist image temporarily for YOLO (requires file path)
    temp_path = save_upload(raw_bytes, file.filename)

    try:
        # 3. Run detection pipeline
        result = await service.analyze(
            image=image,
            filename=file.filename or "unknown.jpg",
            temp_image_path=temp_path,
        )
    finally:
        # 4. Always clean up the temp file
        delete_file(temp_path)

    return ok(message="Roof analysis completed successfully", data=result)


@router.get(
    "/supported-formats",
    response_model=SuccessResponse[dict],
    status_code=status.HTTP_200_OK,
    summary="Supported Image Formats",
    description="Returns the list of accepted image MIME types and size limits.",
)
async def get_supported_formats() -> SuccessResponse[dict]:
    return ok(
        message="Supported image formats",
        data={
            "accepted_mime_types": settings.ALLOWED_IMAGE_TYPES,
            "max_file_size_mb": settings.MAX_UPLOAD_SIZE_MB,
            "recommended_resolution": "At least 512x512 pixels for best accuracy",
            "preferred_image_type": "Aerial / satellite top-down view",
        },
    )


@router.post(
    "/visualize",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
    summary="Roof Polygon Visualization",
    description=(
        "Upload a satellite or aerial rooftop image. "
        "Returns a PNG image with polygon-based roof overlays rendered by OpenCV. "
        "Segmentation masks from YOLO are used when available; falls back to "
        "oriented boxes, then axis-aligned bounding boxes. "
        "Red bounding boxes are never drawn. "
        "**Rate limit: 10 requests/minute per IP (heavy inference).**"
    ),
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "PNG image with polygon roof overlay and metric annotations.",
        }
    },
)
@limiter.limit(LIMIT_FILE_UPLOAD)
async def visualize_roof(
    request: Request,
    api_key: ApiKey,
    service: RoofSvc,
    file: UploadFile = File(
        ...,
        description="Satellite or aerial rooftop image (JPEG, PNG, or WebP). Max 10 MB.",
    ),
) -> StreamingResponse:
    """
    **Input:** Satellite/aerial rooftop image (JPEG/PNG/WebP, max 10 MB).

    **Output:** PNG image with:
    - Per-segment coloured polygon boundary (anti-aliased)
    - Semi-transparent filled roof mask (α ≈ 0.35)
    - Per-segment labels: Roof Area (m²) · Polygon Area (m²) · Confidence (%)
    - HUD card: total counts, aggregate areas, average confidence, geometry source

    Visualization priority:
      1. ``result.masks.xy``   — YOLO segmentation polygon (most accurate)
      2. ``result.obb``        — oriented bounding box quad
      3. ``result.boxes.xyxy`` — axis-aligned fallback box (no red box drawn)
      4. Development stub      — centred placeholder when model is absent
    """
    image, raw_bytes = await validate_and_read_image(file)
    temp_path = save_upload(raw_bytes, file.filename)

    try:
        png_bytes = await service.visualize(
            image=image,
            temp_image_path=temp_path,
        )
    finally:
        delete_file(temp_path)

    return StreamingResponse(
        io.BytesIO(png_bytes),
        media_type="image/png",
        headers={
            "Content-Disposition": 'inline; filename="roof_visualization.png"',
            "X-Roof-Visualization": "polygon",
        },
    )
