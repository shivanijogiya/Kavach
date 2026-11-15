"""
Turns the two raw CSV datasets in /data into compact JSON files the
dashboard reads from /public/data. Run again whenever the CSVs change:

    pip install pandas numpy
    python scripts/preprocess.py
"""
import json, os, hashlib
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "public", "data")
os.makedirs(OUT, exist_ok=True)

tel = pd.read_csv(os.path.join(DATA, "machine_telemetry_dataset_100k.csv"), parse_dates=["Timestamp"])
tel.columns = ["ts", "machine", "operator", "engine_hours", "fuel", "cycles", "idle", "seatbelt", "alert"]
tel["alert"] = (tel["alert"] == "Yes").astype(int)
tel["unbelted"] = (tel["seatbelt"] == "Unfastened").astype(int)
tel["type"] = tel["machine"].str[:3]
tel = tel.sort_values("ts")

tasks = pd.read_csv(os.path.join(DATA, "task_estimation_dataset_100k.csv"))
tasks.columns = ["task_id", "task_type", "weather", "skill", "age", "est", "actual"]

TYPE_NAME = {"EXC": "Hydraulic excavator", "DOZ": "Track-type tractor (dozer)", "GRD": "Motor grader", "LOD": "Wheel loader"}
MODELS = {"EXC": ["Cat 320", "Cat 323", "Cat 336", "Cat 330"], "DOZ": ["Cat D6", "Cat D5", "Cat D8"],
          "GRD": ["Cat 140", "Cat 120", "Cat 150"], "LOD": ["Cat 950", "Cat 966", "Cat 980"]}
TASKS_FOR = {"EXC": ["Earth Excavation", "Trenching", "Demolition"], "DOZ": ["Site Clearing", "Backfilling"],
             "GRD": ["Grading"], "LOD": ["Material Loading", "Hauling"]}
SERVICE_INTERVAL = 500  # engine hours between scheduled services


def h(s):  # deterministic small hash so every run gives the same demo data
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def norm(s):
    return (s - s.min()) / (s.max() - s.min() + 1e-9)


# ---------- task time model (blueprint 6.4: baseline x multipliers) ----------
tasks["ratio"] = tasks["actual"] / tasks["est"]
X = pd.get_dummies(tasks[["weather", "skill"]]).astype(float)
X["age"] = tasks["age"].astype(float)
X = X.drop(columns=["weather_Sunny", "skill_Expert"])
X.insert(0, "const", 1.0)
beta, *_ = np.linalg.lstsq(X.values, np.log(tasks["ratio"].values), rcond=None)
coef = dict(zip(X.columns, beta))
pred = tasks["est"] * np.exp(X.values @ beta)
mae_model = float(np.abs(pred - tasks["actual"]).mean())
mae_plan = float(np.abs(tasks["est"] - tasks["actual"]).mean())
model = {
    "base": float(np.exp(coef["const"])),
    "weather": {"Sunny": 1.0, **{k[8:]: float(np.exp(v)) for k, v in coef.items() if k.startswith("weather_")}},
    "skill": {"Expert": 1.0, **{k[6:]: float(np.exp(v)) for k, v in coef.items() if k.startswith("skill_")}},
    "agePerYear": float(np.exp(coef["age"])),
    "maePlanned": round(mae_plan, 2), "maeModel": round(mae_model, 2),
    "improvementPct": round((1 - mae_model / mae_plan) * 100, 1),
    "baseEstimate": {k: int(v) for k, v in tasks.groupby("task_type")["est"].median().items()},
    "n": int(len(tasks)),
}


def grp(col):
    g = tasks.groupby(col).agg(est=("est", "mean"), actual=("actual", "mean"), ratio=("ratio", "mean"), n=("est", "size")).reset_index()
    return [{"key": str(r[col]), "est": round(r.est, 1), "actual": round(r.actual, 1),
             "overrunPct": round((r.ratio - 1) * 100, 1), "n": int(r.n)} for _, r in g.iterrows()]


bins = [0, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5, 1.75, 2.0, 10]
labels = ["Early >10%", "Early 0-10%", "Late 0-10%", "Late 10-20%", "Late 20-30%", "Late 30-50%", "Late 50-75%", "Late 75-100%", "Late >100%"]
dist = pd.cut(tasks["ratio"], bins=bins, labels=labels, right=False).value_counts().reindex(labels).fillna(0)
ws = tasks.pivot_table(index="weather", columns="skill", values="ratio", aggfunc="mean")
task_analytics = {
    "byType": grp("task_type"), "byWeather": grp("weather"), "bySkill": grp("skill"), "byAge": grp("age"),
    "overrunDist": [{"bucket": k, "count": int(v)} for k, v in dist.items()],
    "weatherSkill": [{"weather": w, **{s: round((ws.loc[w, s] - 1) * 100, 1) for s in ws.columns}} for w in ws.index],
    "model": model,
}

# ---------- per machine ----------
machines = []
tasks_by_type = {tt: tasks[tasks.task_type == tt] for tt in tasks.task_type.unique()}


def rows(frame, key, fmt):
    out = []
    for i, r in frame.iterrows():
        d = {key: fmt(i)}
        for k, v in r.items():
            d[k] = round(float(v), 1) if k == "fuel" else int(v)
        out.append(d)
    return out


for mid, g in tel.groupby("machine"):
    t = mid[:3]
    last = g.iloc[-1]
    eh = float(last.engine_hours)
    since = eh % SERVICE_INTERVAL
    gi = g.set_index("ts")
    wk = gi.resample("W").agg({"cycles": "sum", "fuel": "sum", "idle": "sum", "alert": "sum", "unbelted": "sum", "machine": "size"}).rename(columns={"machine": "sessions"})
    mo = gi.resample("MS").agg({"cycles": "sum", "fuel": "sum", "idle": "sum", "alert": "sum", "machine": "size"}).rename(columns={"machine": "sessions"})
    mo = mo[mo.index < "2026-01-01"]
    ops = g.groupby("operator").agg(sessions=("cycles", "size"), cycles=("cycles", "sum"), fuel=("fuel", "sum"), alerts=("alert", "sum")).sort_values("sessions", ascending=False).head(6)
    recent = g.tail(25).iloc[::-1]
    pool = pd.concat([tasks_by_type[tt] for tt in TASKS_FOR[t]])
    rng = np.random.default_rng(h(mid))
    pick = pool.iloc[rng.choice(len(pool), 14, replace=False)]
    done, queue = pick.iloc[:8], pick.iloc[8:]
    machines.append({
        "id": mid, "type": t, "typeName": TYPE_NAME[t], "model": MODELS[t][h(mid) % len(MODELS[t])],
        "year": 2026 - int(rng.integers(1, 11)),
        "engineHours": round(eh, 1), "hoursSinceService": round(since, 1), "serviceDueIn": round(SERVICE_INTERVAL - since, 1),
        "sessions": int(len(g)), "cycles": int(g.cycles.sum()), "fuel": round(float(g.fuel.sum()), 1),
        "idleMin": int(g.idle.sum()), "alerts": int(g.alert.sum()), "unbelted": int(g.unbelted.sum()),
        "alertRate": round(float(g.alert.mean()), 4), "unbeltedRate": round(float(g.unbelted.mean()), 4),
        "avgIdle": round(float(g.idle.mean()), 2), "fuelPerCycle": round(float(g.fuel.sum() / max(g.cycles.sum(), 1)), 4),
        "lastOperator": last.operator, "lastSeen": last.ts.strftime("%Y-%m-%d %H:%M"),
        "weekly": rows(wk, "week", lambda i: i.strftime("%d %b")),
        "monthly": rows(mo, "month", lambda i: i.strftime("%b")),
        "operators": rows(ops, "id", lambda i: i),
        "recent": [{"ts": r.ts.strftime("%Y-%m-%d %H:%M"), "operator": r.operator, "cycles": int(r.cycles), "fuel": float(r.fuel),
                    "idle": int(r.idle), "seatbelt": r.seatbelt, "alert": int(r.alert)} for _, r in recent.iterrows()],
        "workDone": [{"taskId": r.task_id, "type": r.task_type, "weather": r.weather, "skill": r.skill, "est": int(r.est), "actual": int(r.actual)} for _, r in done.iterrows()],
        "workQueue": [{"taskId": r.task_id, "type": r.task_type, "est": int(r.est)} for _, r in queue.iterrows()],
    })

# health score: fleet-relative and explainable (each component is a penalty in points)
df = pd.DataFrame(machines)
comp = pd.DataFrame({
    "alerts": norm(df.alertRate) * 15, "idle": norm(df.avgIdle) * 10,
    "fuel": norm(df.fuelPerCycle) * 10, "service": (df.hoursSinceService / SERVICE_INTERVAL) * 15,
    "seatbelt": norm(df.unbeltedRate) * 5,
})
health = (100 - comp.sum(axis=1)).clip(0, 100).round(0)
for i, m in enumerate(machines):
    m["health"] = int(health[i])
    m["healthPenalty"] = {k: round(float(comp[k][i]), 1) for k in comp.columns}

# ---------- operators ----------
ops = tel.groupby("operator").agg(sessions=("cycles", "size"), cycles=("cycles", "sum"), fuel=("fuel", "sum"), idle=("idle", "mean"),
                                   alerts=("alert", "sum"), alertRate=("alert", "mean"), unbeltedRate=("unbelted", "mean"),
                                   machines=("machine", "nunique")).reset_index()
ops["fuelPerCycle"] = ops.fuel / ops.cycles
ops["score"] = (100 - norm(ops.alertRate) * 45 - norm(ops.unbeltedRate) * 25 - norm(ops.idle) * 15 - norm(ops.fuelPerCycle) * 15).round(0)
skills = ["Beginner", "Intermediate", "Expert"]
first = ["Arun", "Priya", "Karthik", "Meena", "Suresh", "Lakshmi", "Vijay", "Divya", "Ravi", "Anitha", "Manoj", "Kavya", "Ganesh",
         "Deepa", "Rahul", "Sneha", "Prakash", "Nisha", "Senthil", "Pooja", "Imran", "Farah", "Joseph", "Mary", "Harish"]
last_ = ["K", "S", "R", "M", "P", "N", "V", "T", "A", "J"]
operators = []
for _, r in ops.iterrows():
    hv = h(r.operator)
    operators.append({"id": r.operator, "name": f"{first[hv % len(first)]} {last_[(hv // 7) % len(last_)]}.",
                      "skill": skills[hv % 3], "sessions": int(r.sessions), "cycles": int(r.cycles), "fuel": round(float(r.fuel), 1),
                      "avgIdle": round(float(r.idle), 2), "alerts": int(r.alerts), "alertRate": round(float(r.alertRate), 4),
                      "unbeltedRate": round(float(r.unbeltedRate), 4), "machines": int(r.machines), "score": int(r.score)})

# ---------- fleet ----------
mt = tel.set_index("ts").groupby("type").resample("MS").agg({"fuel": "sum", "cycles": "sum", "idle": "sum", "alert": "sum"}).reset_index()
monthly = []
for m, g in mt.groupby("ts"):
    if m >= pd.Timestamp("2026-01-01"):
        continue
    row = {"month": m.strftime("%b")}
    for _, r in g.iterrows():
        row[f"{r.type}_fuel"] = round(float(r.fuel), 0)
        row[f"{r.type}_cycles"] = int(r.cycles)
        row[f"{r.type}_alerts"] = int(r.alert)
        row[f"{r.type}_idleH"] = round(float(r.idle) / 60, 0)
    monthly.append(row)
hourly = tel.groupby(tel.ts.dt.hour).agg(alerts=("alert", "sum"), sessions=("alert", "size")).reset_index()
bytype = tel.groupby("type").agg(fuel=("fuel", "sum"), cycles=("cycles", "sum"), idle=("idle", "sum"), alerts=("alert", "sum"), sessions=("alert", "size")).reset_index()
ct = pd.crosstab(tel.seatbelt, tel.alert, normalize="index")
fleet = {
    "kpis": {"machines": int(tel.machine.nunique()), "operators": int(tel.operator.nunique()), "sessions": int(len(tel)),
             "fuel": round(float(tel.fuel.sum()), 0), "cycles": int(tel.cycles.sum()), "idleHours": round(float(tel.idle.sum()) / 60, 0),
             "alerts": int(tel.alert.sum()), "alertRate": round(float(tel.alert.mean()), 4),
             "beltCompliance": round(1 - float(tel.unbelted.mean()), 4),
             "from": tel.ts.min().strftime("%d %b %Y"), "to": tel.ts.max().strftime("%d %b %Y"),
             "fuelPerCycle": round(float(tel.fuel.sum() / tel.cycles.sum()), 4)},
    "seatbeltAlert": {"fastened": round(float(ct.loc["Fastened", 1]) * 100, 1), "unfastened": round(float(ct.loc["Unfastened", 1]) * 100, 1),
                      "shareOfAlertsUnbelted": round(float(tel[tel.alert == 1].unbelted.mean()) * 100, 1)},
    "monthly": monthly,
    "hourly": [{"hour": f"{int(r.ts):02d}", "alerts": int(r.alerts), "rate": round(r.alerts / r.sessions * 100, 2)} for _, r in hourly.iterrows()],
    "byType": [{"type": r.type, "name": TYPE_NAME[r.type], "fuel": round(float(r.fuel), 0), "cycles": int(r.cycles),
                "idleHours": round(float(r.idle) / 60, 0), "alerts": int(r.alerts), "alertRate": round(r.alerts / r.sessions * 100, 2)}
               for _, r in bytype.iterrows()],
    "serviceInterval": SERVICE_INTERVAL,
}


def dump(name, obj):
    p = os.path.join(OUT, name)
    with open(p, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"wrote {name}: {os.path.getsize(p) / 1024:.0f} KB")


dump("machines.json", machines)
dump("operators.json", operators)
dump("fleet.json", fleet)
dump("tasks.json", task_analytics)
