# HelioVision – FastAPI Backend

Production-ready backend API for the AI-powered HelioVision Platform.

---

## Quick Start

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment (already set up for dev)
# .env is pre-configured for development – no changes needed for local testing

# 5. Start the server
python run.py --reload

# OR directly with uvicorn:
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Swagger UI:** http://localhost:8000/docs  
**ReDoc:** http://localhost:8000/redoc  
**OpenAPI JSON:** http://localhost:8000/openapi.json

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Liveness probe |
| GET | `/api/v1/health/ready` | Readiness probe (checks models) |
| GET | `/api/v1/health/models` | Model registry status |
| POST | `/api/v1/solar/forecast` | Predict solar energy output (kWh) |
| GET | `/api/v1/solar/forecast/info` | Forecast model metadata |
| POST | `/api/v1/savings/predict` | Full savings prediction (NPV, ROI, monthly/yearly) |
| GET | `/api/v1/savings/quick` | Quick savings estimate |
| POST | `/api/v1/roof/analyze` | Upload image → roof analysis + capacity estimate |
| GET | `/api/v1/roof/supported-formats` | Accepted image formats |
