import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

def synthesize_encounter_telemetry(n_records=8000):
    np.random.seed(42)
    df = pd.DataFrame({
        "triage_level": np.random.choice([1, 2, 3, 4, 5], p=[0.05, 0.15, 0.40, 0.25, 0.15], size=n_records),
        "arrival_hour": np.random.randint(0, 24, size=n_records),
        "day_of_week": np.random.randint(0, 7, size=n_records),
        "age": np.random.randint(1, 92, size=n_records),
        "comorbidity_score": np.random.randint(0, 6, size=n_records),
        "active_dept_occupancy": np.random.uniform(0.35, 1.45, size=n_records),
        "concurrent_lab_orders": np.random.poisson(lam=2.8, size=n_records)
    })
    
    noise = np.random.normal(0, 3.2, size=n_records)
    df["wait_time_mins"] = np.clip(
        (6 - df["triage_level"]) * 7.8 + 
        (df["active_dept_occupancy"] * 24.5) + 
        (df["concurrent_lab_orders"] * 4.3) + 
        (df["comorbidity_score"] * 1.9) + noise,
        a_min=2.0, a_max=240.0
    ).round(1)
    
    return df

def train_and_export():
    df = synthesize_encounter_telemetry()
    features = [
        "triage_level", "arrival_hour", "day_of_week", 
        "age", "comorbidity_score", "active_dept_occupancy", 
        "concurrent_lab_orders"
    ]
    target = "wait_time_mins"
    
    split_idx = int(len(df) * 0.70)
    X_train, y_train = df.iloc[:split_idx][features], df.iloc[:split_idx][target]
    X_test, y_test = df.iloc[split_idx:][features], df.iloc[split_idx:][target]
    
    model = GradientBoostingRegressor(
        n_estimators=140, 
        learning_rate=0.08, 
        max_depth=5, 
        random_state=42
    )
    model.fit(X_train, y_train)
    
    mae = mean_absolute_error(y_test, model.predict(X_test))
    r2 = r2_score(y_test, model.predict(X_test))
    
    export_path = os.path.join(os.path.dirname(__file__), "vitalis_model.pkl")
    joblib.dump(model, export_path)
    print(f"Model exported: {export_path} (MAE: {mae:.2f} mins, R2: {r2:.3f})")

if __name__ == "__main__":
    train_and_export()
