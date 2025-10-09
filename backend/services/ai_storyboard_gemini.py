# ──────────────────────────────────────────────────────────────────────────────
#  ai_storyboard.py  ─ UNIFIED TEXT-&-CHART STORYBOARD ENDPOINT  (FULL FILE)
# ──────────────────────────────────────────────────────────────────────────────
import os, json, textwrap
from flask import Blueprint, request, jsonify
import google.generativeai as genai

ai_storyboard_gemini = Blueprint("ai_storyboard_gemini", __name__)

# ─── Gemini init ────────────────────────────────────────────────────────────
_gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not _gemini_api_key:
    raise ValueError("Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set for Gemini storyboard support.")
genai.configure(api_key=_gemini_api_key)
gemini = genai.GenerativeModel("gemini-pro")
# ─── Helpers ────────────────────────────────────────────────────────────────
def normalise_dataset(payload):
    if isinstance(payload, str):
        payload = json.loads(payload)

    if isinstance(payload, dict) and "data_preview" in payload:
        payload = json.loads(payload["data_preview"])

    if isinstance(payload, list):
        return payload[:200]
    return [payload]

def summarise_schema(rows, limit=50):
    sample = rows[:limit]
    field_types = {}
    for k in sample[0].keys():
        values = [r.get(k) for r in sample]
        num_count = sum(isinstance(v, (int, float)) for v in values if v is not None)
        uniq = len(set(values))
        field_types[k] = "numeric" if num_count / len(values) > 0.8 else "categorical"
        field_types[k] += f" (≈{uniq} distinct)"
    return field_types

def gemini_call(prompt):
    resp = gemini.generate_content(
        prompt,
        generation_config={"temperature": 0.7, "top_p": 1.0, "max_output_tokens": 1100},
    )
    if not resp or not getattr(resp, "text", None):
        raise RuntimeError("Empty response from Gemini")
    return resp.text.strip()

# ─── Route ───────────────────────────────────────────────────────────────────
@ai_storyboard_gemini.route("/api/storyboard-gemini", methods=["POST"])
def storyboard():
    try:
        body = request.get_json(silent=True) or {}
        dataset = body.get("cleanedData") or body.get("uploadedData")
        if not dataset:
            return jsonify({"error": "Provide 'uploadedData' or 'cleanedData'"}), 400

        rows = normalise_dataset(dataset)
        schema_summary = summarise_schema(rows)

        prompt = textwrap.dedent(f"""
        You are a senior BI analyst. 
        1️⃣ Analyse the *schema* and *sample rows* below.  
        2️⃣ Produce a JSON **only** object with EXACTLY:
            "sections": [{{"title": str, "content": str}}, … 3–4 items total],
            "charts":   [
               {{
                 "title": str,
                 "type": "Bar"|"Line"|"Pie",
                 "labels": [str, …],
                 "values": [number, …]
               }}, … up to 3 charts
            ]

        Rules:
        • pick chart encodings automatically – e.g. Bar for category vs numeric, Line for date vs numeric, Pie for shares.
        • labels & values MUST be parallel arrays and numeric values must be numbers.
        • NEVER wrap output in markdown or commentary – pure JSON only.

        ── SCHEMA ──
        {json.dumps(schema_summary, separators=(',', ':'))}

        ── SAMPLE ROWS (≤50) ──
        {json.dumps(rows[:50], separators=(',', ':'))}
        """)

        raw = gemini_call(prompt)

        # strip any stray code fences
        if raw.startswith("```"):
            raw = "\n".join(l for l in raw.splitlines() if not l.startswith("```"))

        result = json.loads(raw)

        # minimal validation
        if not isinstance(result.get("sections"), list):
            raise ValueError("Missing 'sections'")
        if not isinstance(result.get("charts"), list):
            result["charts"] = []

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": f"Server failure: {e}"}), 500
