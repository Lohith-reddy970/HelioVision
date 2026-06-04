# HelioVision

An enterprise-grade, machine-learning-powered web platform for remote solar feasibility assessments, layout optimization, and financial projections.

The platform combines satellite/aerial computer vision with physical irradiance models and deterministic financial analysis to provide instant, highly accurate solar installation predictions.

---

## 🏗 System Architecture

The platform is structured as a decoupled monorepo:

```
Solar-AI-platform/
├── backend/                  # FastAPI Application (Python 3.10+)
│   ├── app/
│   │   ├── api/              # API endpoints (v1/v2)
│   │   ├── core/             # Configuration, logging, exception management
│   │   ├── ml/               # Model loaders, pre/post-processing & inference
│   │   ├── schemas/          # Pydantic validation schemas
│   │   └── services/         # Business logic: geometry, forecasting, cash-flow
│   ├── run.py                # Server entrypoint
│   └── tests/                # Pytest suite
│
├── frontend/                 # Next.js Application (Next 16, React 19)
│   ├── app/                  # App Router pages (Dashboard, Detection, Estimation)
│   ├── components/           # Reusable UI elements (framer-motion, lucide-react)
│   ├── lib/                  # Fetch API hooks and general utility code
│   └── store/                # Zustand client-state management
│
└── trained-models/           # Pre-trained ML & Deep Learning weights
    ├── prediction_yolo1.pt             # YOLOv8-X high-res roof edge detection
    ├── solar_forecast_model.pkl        # Random Forest model for weather & yield
    └── savings_prediction_model.pkl    # Cash-flow regression estimator
```

---

## 🧠 AI & Machine Learning Pipeline

1. **Computer Vision (YOLOv8-X):** Detects and segments roof structures from satellite/aerial uploads.
   * Inputs: Aerial PNG/JPG/WebP/GeoTIFF.
   * Outputs: Oriented bounding boxes (OBB), exact polygon masks, and usable segmentation area metrics.
2. **Solar Irradiance Forecast (Random Forest):** Predicts active hourly/annual yield (kWh) based on location, weather profiles, panel azimuth, tilt angles, and panel efficiency.
3. **Deterministic Cash-Flow Analysis:** Generates 25-year financial simulations (NPV, IRR, Cumulative Savings, Payback Period) based on Year-1 yield, degradation rates, tariff projection, and installation costs.

---

## 🛠 Tech Stack

### Backend
* **Web Framework:** FastAPI (ASGI)
* **ML Inference:** PyTorch, OpenCV, NumPy, Scikit-learn
* **Quality Assurance:** Pydantic (data parsing/validation), Pytest (unit & integration testing)
* **Infrastructure:** Nginx, Docker, Uvicorn, Docker Compose

### Frontend
* **Framework:** Next.js 16 (App Router), React 19
* **Styling:** Tailwind CSS, Vanilla CSS
* **Animations:** Framer Motion (smooth, high-end transitions)
* **Data Visualization:** Recharts (interactive responsive area/bar charts)
* **State Management:** Zustand

---

## 🚀 Quick Start & Installation

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   python run.py --reload
   ```
   * **Swagger UI:** `http://localhost:8000/docs`
   * **ReDoc:** `http://localhost:8000/redoc`

### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Ensure you have a `.env.local` pointing to the backend:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```
4. Start the development environment:
   ```bash
   npm run dev
   ```
   * Access the client portal at: `http://localhost:3000`

---

## 🔌 API Summary Reference

| Method | Endpoint | Description |
|---|---|---|
| **GET** | `/api/v1/health` | Liveness & overall platform health check |
| **GET** | `/api/v1/health/ready` | Readiness probe (checks that all 3 ML models are loaded in memory) |
| **POST** | `/api/v1/roof/analyze` | Processes aerial uploads through YOLOv8 to isolate usable roof layout |
| **POST** | `/api/v1/solar/forecast` | Returns predicted power output (kWh) based on weather and tilt variables |
| **POST** | `/api/v1/savings/predict` | Runs 25-year financial modeling with detailed annual cash-flow charts |

---

## 📈 Financial Derivation Model

Every financial output in the projection (NPV, IRR, ROI) is strictly derived from a unified cash-flow table based on:
$$Net Savings = Gross Savings - Maintenance Costs$$
$$ROI = \frac{Net Profit}{Installation Cost} \times 100$$
$$NPV = \sum \frac{Discounted Cash Flow}{(1 + r)^t} - Installation Cost$$

The frontend maintains live data synchronization across tabs via Zustand stores, ensuring consistent state values from the backend prediction model.
