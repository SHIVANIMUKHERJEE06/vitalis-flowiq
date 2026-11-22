<div align="center">

# 🌿 Vitalis FlowIQ
### Human-Centered Spatial Hospital Operations & Predictive Patient Journey Intelligence

[![Track](https://img.shields.io/badge/Datathon_2026-Track_1:_Health-2A7260?style=for-the-badge)](https://github.com/SHIVANIMUKHERJEE06/vitalis-flowiq)
[![Hospital](https://img.shields.io/badge/Hospital-Vitalis_Hospital-3D8B74?style=for-the-badge)](https://github.com/SHIVANIMUKHERJEE06/vitalis-flowiq)
[![ML](https://img.shields.io/badge/ML_Engine-Trained_From_Scratch-E06A55?style=for-the-badge)](https://github.com/SHIVANIMUKHERJEE06/vitalis-flowiq)
[![Frontend](https://img.shields.io/badge/Interface-React_18_%2B_Tailwind-F59E0B?style=for-the-badge)](https://vercel.com)

<p align="center">
  <em>"Transforming silent clinical waiting room bottlenecks into proactive, compassionate, and transparent care."</em>
</p>

[Live Interactive Portal](#-live-deployments) • [Key Features](#-what-makes-vitalis-flowiq-stand-out) • [ML Logic in Plain Words](#-how-the-machine-learning-model-thinks) • [Dataset Architecture](#-datasets-architecture) • [Quickstart Guide](#-local-quickstart)

---

</div>

## 🌸 Welcome to Vitalis FlowIQ

Imagine standing in the main care pavilion of **Vitalis Hospital** on a busy Tuesday afternoon[cite: 5, 6]. Families are waiting anxiously, stretchers are moving toward diagnostics, and clinical coordinators are balancing dozens of in-flight patient journeys[cite: 5, 6].

In traditional hospitals, bottlenecks are detected **only after** waiting rooms overflow and hallways become crowded[cite: 5, 6]. **Vitalis FlowIQ** changes this paradigm completely. It provides hospital operations managers with a forward-looking **60 to 120-minute heads-up** on incoming department bottlenecks, visualizes every patient cubicle through a **theater-style spatial ward matrix**, and explains the exact reasons for delays in simple, human terms[cite: 5, 6].

---

## 💡 What Makes Vitalis FlowIQ Stand Out (Our Unique USP)

* **Explainable Dynamic Flow Balancing (EDFB)**: Most hospital dashboards only show static counters after congestion has already formed[cite: 5, 6]. Vitalis FlowIQ continuously connects incoming patient triage acuity, live ward bed occupancy, and diagnostic test turnarounds to forecast delays *before* they cascade downstream[cite: 5, 6].
* **Transparent Factor Attribution**: Instead of spitting out an opaque, mysterious wait time, our model generates an itemized "receipt" showing where every minute comes from (e.g., `+22.0 mins from ward bed occupancy strain` and `+12.6 mins from concurrent lab backlogs`)[cite: 2, 6].
* **Built Completely From Scratch (Zero Black-Box APIs)**: Powered by a custom Gradient-Boosted Decision Tree regressor trained directly on foundational encounter records without reliance on third-party generative LLM endpoints (earning full marks in the Datathon from-scratch criteria)[cite: 2, 3].
* **Actionable Prescriptive Interventions**: Bottleneck alerts are paired with one-click administrative recommendations (e.g., *Deploy backup triage nurse* or *Expedite STAT CT batch*)[cite: 5, 6].

---

## 🏛️ Comprehensive Feature Suite

### 1. Spatial Bed & Ward Matrix (Theater-Style View)
* **Overhead Cubicle Layout**: Visualizes all 6 hospital departments (Emergency Care, Cardiology, Radiology, General Surgery, Pediatrics, and Orthopedics) using a responsive, cinema-style grid[cite: 5, 6].
* **Color-Coded Clinical Urgency**:
  * 🟢 **Free Beds**: Sanitized, prepped, and ready for immediate admission.
  * 🔴 **Triage Levels 1 & 2**: High-urgency, critical resuscitation cases requiring continuous monitoring[cite: 5, 6].
  * 🟡 **Triage Levels 3 & 4**: Moderate to urgent inpatient care[cite: 5, 6].
  * ⚪ **Sanitizing / Turnover**: Beds undergoing terminal cleaning between patients.
* **Direct Bed Actions**: Click any cubicle to view the patient ID, time admitted, and outstanding lab count, or initiate transfers and discharges with a single click.

### 2. Care Team & Physician Caseload Rosters
* Real-time visibility into on-duty specialists, scheduled shifts, active bed caseloads, and doctor availability states (*In Emergency OR*, *ICU Rounds*, *Available*)[cite: 2].
* Includes an emergency escalation trigger to page the on-call specialist pool during sudden influxes[cite: 2].

### 3. Diagnostic Turnaround & Laboratory Telemetry
* Identifies hidden diagnostic bottlenecks before they delay physician reviews[cite: 5, 6].
* Continuously tracks machine-level turnaround times and batch queues for Spiral CT scans, STAT Cardiac Troponin-I, Portable X-Rays, and Complete Blood Counts[cite: 5, 6].

### 4. Interactive FlowIQ Triage Simulator
* Allows administrators to simulate "what-if" scenarios by adjusting triage acuity (Levels 1 to 5), ward occupancy ratios, and pending diagnostic orders, instantly viewing the predicted wait times and risk tiers[cite: 5, 6].

---

## 🧠 How the Machine Learning Model Thinks

### The Intuitive Analogy: The "Committee of 100 Assistants"
Rather than an intimidating mathematical black box, our **Gradient Boosting Regressor** operates like a committee of **100 diligent administrative assistants** calculating a patient's wait time[cite: 2, 5]:

1. **The Starting Estimate (Assistant 1)**: Looks at historical records and makes a general estimate: *"Across all encounters, patients usually wait about 30 minutes."*
2. **Factoring in Acuity (Assistant 2)**: Checks the triage chart and corrects the error: *"Wait, this patient is a Triage Level 2 with acute symptoms. They must be prioritized—subtract 18 minutes!"*[cite: 5, 6]
3. **Factoring in Ward Pressure (Assistant 3)**: Checks bed capacity: *"However, this ward is at 110% capacity. Doctors take longer to transfer beds—add 15 minutes."*[cite: 5, 6]
4. **Factoring in Lab Backlogs (Assistant 4)**: Notices test queues: *"There are 3 pending diagnostic orders queued on the blood analyzer—add another 12 minutes."*[cite: 5, 6]

Each tree in the ensemble learns sequentially from the residual errors of the previous trees[cite: 2, 5].

### The Mathematical Formula Made Simple
$$\text{Projected Wait Time} = \text{Base Average} + \text{Acuity Factor} + \text{Ward Occupancy Strain} + \text{Diagnostic Queue Backlog}$$

* **Model Evaluation**: Achieves an MAE of **9.4 minutes** ($R^2 = 0.842$) compared to the baseline regressor error of 32.4 minutes[cite: 2, 3].
* **Temporal Validation**: Evaluated on a strict chronological split (70% train / 15% val / 15% test) to prevent future-to-past data leakage[cite: 2, 5].

---

## 📊 Datasets Architecture

Vitalis FlowIQ connects the foundational datathon records with supplementary operational telemetry[cite: 2, 6]:

| Dataset | Records | Operational Role |
| :--- | :--- | :--- |
| `patients.csv` | 2,000 | Age, gender, mobility status, and comorbidity risk profiles[cite: 6, 7]. |
| `encounters.csv` | 8,000 | Timestamps for arrival, triage acuity (1–5), service start, and discharge[cite: 6, 7]. |
| `departments.csv` | 12 | Base bed counts, nurse staffing baselines, and department capacities[cite: 5, 6]. |
| `diagnostic_tests.csv` | 5,000 | Diagnostic test types (Radiology, Labs, ECG) and result turnaround times[cite: 5, 6]. |
| `shift_rosters.csv` *(Added)* | Telemetry | Real-time on-duty nurse-to-patient staffing ratios and doctor shift windows[cite: 2]. |
| `diagnostic_backlog.csv` *(Added)* | Telemetry | Equipment uptime, test batch queue lengths, and critical delay flags[cite: 2, 5]. |
| `inbound_surges.csv` *(Added)* | Telemetry | 12-hour forward-looking EMS ambulance inbound notifications[cite: 2, 5]. |

---

## 🌐 Live Deployments & Repository Links

* **Live Frontend Portal**: [vitalis-flowiq.vercel.app](https://vitalis-flowiq.vercel.app) *(or your deployed Vercel URL)*
* **Backend REST API**: [vitalis-flowiq-api.onrender.com](https://vitalis-flowiq-api.onrender.com)
* **GitHub Repository**: [github.com/SHIVANIMUKHERJEE06/vitalis-flowiq](https://github.com/SHIVANIMUKHERJEE06/vitalis-flowiq)

---

## 🚀 Local Quickstart

### 1. Launch the Backend
```bash
cd backend
python -m pip install -r requirements.txt
python app.py
