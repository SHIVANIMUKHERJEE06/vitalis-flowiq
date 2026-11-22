import os
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL_FILE = os.path.join(os.path.dirname(__file__), "vitalis_model.pkl")
if not os.path.exists(MODEL_FILE):
    from model_engine import train_and_export
    train_and_export()

model = joblib.load(MODEL_FILE)

DEPARTMENTS = [
    {"id": "D01", "name": "Emergency Care", "total_beds": 24, "active_beds": 21, "staff": 14, "base_wait": 82.5, "lead": "Dr. Arvind Rao"},
    {"id": "D02", "name": "Cardiology Heart Center", "total_beds": 18, "active_beds": 16, "staff": 8, "base_wait": 65.2, "lead": "Dr. Ananya Sen"},
    {"id": "D03", "name": "Radiology & Imaging Suite", "total_beds": 12, "active_beds": 7, "staff": 6, "base_wait": 38.0, "lead": "Dr. K. V. Sharma"},
    {"id": "D04", "name": "General Surgery Pavilion", "total_beds": 20, "active_beds": 12, "staff": 10, "base_wait": 24.5, "lead": "Dr. Meera Nambiar"},
    {"id": "D05", "name": "Pediatrics & Child Care", "total_beds": 16, "active_beds": 8, "staff": 7, "base_wait": 21.0, "lead": "Dr. Rajesh Gupta"},
    {"id": "D06", "name": "Orthopedics & Joint Clinic", "total_beds": 14, "active_beds": 11, "staff": 6, "base_wait": 42.1, "lead": "Dr. S. Mukherjee"}
]

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "hospital": "Vitalis Hospital",
        "service": "FlowIQ Spatial Engine",
        "theme": "Warm Botanical Healing"
    }), 200

@app.route("/api/departments", methods=["GET"])
def get_departments():
    out = []
    for d in DEPARTMENTS:
        occ = round(d["active_beds"] / d["total_beds"], 2)
        status = "CRITICAL" if occ >= 0.85 else ("ELEVATED" if occ >= 0.65 else "OPTIMAL")
        out.append({
            **d,
            "occupancy_rate": occ,
            "status": status,
            "action": "Deploy backup nurse" if status == "CRITICAL" else "Maintain schedule"
        })
    return jsonify(out), 200

@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.json or {}
    try:
        triage = float(data.get("triage_level", 3))
        arrival_hour = float(data.get("arrival_hour", 14))
        day_of_week = float(data.get("day_of_week", 2))
        age = float(data.get("age", 45))
        comorbidity = float(data.get("comorbidity_score", 1))
        occupancy = float(data.get("active_dept_occupancy", 0.85))
        labs = float(data.get("concurrent_lab_orders", 3))
        
        vec = [[triage, arrival_hour, day_of_week, age, comorbidity, occupancy, labs]]
        pred_wait = float(model.predict(vec)[0])
        
        return jsonify({
            "predicted_wait_time_mins": round(pred_wait, 1),
            "risk_tier": "CRITICAL" if pred_wait > 50 else ("ELEVATED" if pred_wait > 30 else "OPTIMAL"),
            "signals": {
                "occupancy_impact": round((occupancy - 0.70) * 24.5, 1),
                "diagnostics_queue_impact": round(labs * 4.3, 1),
                "acuity_priority_offset": round((3 - triage) * 7.8, 1)
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
