"""Verified local exports and schema-validated prediction from selected models."""

import csv
import hashlib
from io import BytesIO, StringIO
import json
import math
from pathlib import Path

from .artifacts import ArtifactStoreError
from .configuration import dependency_fingerprint
from .repository import PersistenceError
from .review import _current, selected_artifact
from .service import MLStudioServiceError
from .training import normalize_features, run_with_limits

MAX_INPUT_BYTES = 2 * 1024 * 1024
EXPORTS = {
    "model": ("model.joblib", "application/octet-stream", "Fitted prediction pipeline"),
    "preprocessor": ("preprocessor.joblib", "application/octet-stream", "Fitted feature preprocessor"),
    "schema": ("inference-schema.json", "application/json", "Input and output schema"),
    "report": ("evaluation-report.json", "application/json", "Development and final evidence"),
    "model_card": ("model-card.md", "text/markdown", "Intended use and limitations"),
    "manifest": ("reproducibility-manifest.json", "application/json", "Configuration, lineage and versions"),
    "example": ("inference-example.py", "text/x-python", "Local CSV inference example"),
    "summary": ("cycle-summary.json", "application/json", "Complete local experiment summary"),
}


def supported_exports(selection):
    if selection.get("task_type") == "forecasting":
        return {**EXPORTS, "runtime": ("forecast-runtime.py", "text/x-python", "Portable forecast inference runtime")}
    if selection.get("task_type") == "anomaly_detection":
        return {**EXPORTS, "runtime": ("anomaly-runtime.py", "text/x-python", "Portable detector scoring and threshold")}
    return EXPORTS


def _json(value):
    return json.dumps(value, allow_nan=False, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8")


def selection_for(service, experiment_id, workspace_id, selection_id):
    envelope = service.get_draft(experiment_id, workspace_id)
    selection = next((value for value in service._repository.list_selections(experiment_id, workspace_id) if value["selection_id"] == selection_id), None)
    if selection is None:
        raise MLStudioServiceError("selection_not_found", "The selected candidate is unavailable in this experiment.", "Open a saved selection from the current workspace.", status_code=404)
    config = service._repository.get_experiment(f"studio-{experiment_id}", selection["specification_version"])
    return selection, config, envelope


def inference_schema(selection, config):
    schema = {"contract_version": "ml_studio_inference_schema_v1",
        "selection_id": selection["selection_id"], "task_type": config["task_type"],
        "fields": [{"name": column, "logical_type": "number", "required": True, "nullable": True, "missing_policy": "training_median"} for column in config["roles"]["numeric"]]
            + [{"name": column, "logical_type": "string", "required": True, "nullable": True, "missing_policy": "training_mode", "unknown_category_policy": "ignore"} for column in config["roles"]["categorical"]],
        "additional_fields": False, "max_rows": 10000, "max_input_bytes": MAX_INPUT_BYTES,
        "outputs": [{"name": "prediction", "logical_type": "number" if config["task_type"] == "regression" else "string"}],
        "probabilities_supported": False}
    if config["task_type"] == "clustering":
        schema["outputs"] = [{"name": "cluster", "logical_type": "integer"}]
        schema["assignment_note"] = "Assignments use development-fitted centers. Cluster IDs are arbitrary labels, not class predictions."
    if config["task_type"] == "anomaly_detection":
        schema["outputs"] = [{"name": "score", "logical_type": "number"}, {"name": "is_unusual", "logical_type": "boolean"}]
        schema["detector"] = selection["inference_context"]
        schema["assignment_note"] = "Larger scores mean more unusual. Flags use the fitted training threshold and are not confirmed errors or probabilities."
    if config["task_type"] == "forecasting":
        import pandas as pd
        roles = config["roles"]
        schema["fields"] += [{"name": column, "logical_type": "string", "required": True, "nullable": False, "missing_policy": "reject"} for column in roles["time"] + roles["group"]]
        schema["outputs"] = [{"name": "prediction", "logical_type": "number"}, {"name": "time", "logical_type": "string"}, {"name": "series", "logical_type": "string"}, {"name": "horizon", "logical_type": "number"}]
        schema["forecast"] = selection["inference_context"]
        schema["fields"][len(roles["numeric"]) + len(roles["categorical"])]["format"] = "ISO 8601 UTC"
        stream = StringIO(newline="")
        writer = csv.DictWriter(stream, fieldnames=[field["name"] for field in schema["fields"]])
        writer.writeheader()
        for origin in schema["forecast"]["origins"]:
            dates = pd.date_range(origin["origin"], periods=config["validation"]["horizon"] + 1, freq=config["validation"]["frequency"])[1:]
            for date in dates:
                row = {field["name"]: "" for field in schema["fields"]}
                row[roles["time"][0]] = date.isoformat()
                if roles["group"]: row[roles["group"][0]] = origin["series"]
                writer.writerow(row)
        schema["template_csv"] = stream.getvalue()
    return {**schema, "schema_id": "schema-" + hashlib.sha256(_json(schema)).hexdigest()[:32]}


def cycle_summary(service, selection, config):
    development = service.get_run(selection["development_run_id"])
    final = service.get_run(selection["final_run_id"])
    return {"contract_version": "ml_studio_cycle_summary_v1", "selection": selection, "problem_statement": selection.get("problem_statement", selection["intended_use"]),
        "configuration": config, "dataset_snapshot": development["run_specification"]["dataset_snapshot"],
        "development_evidence": development["evaluation_result"], "final_evidence": final["evaluation_result"],
        "limitations": development["evaluation_result"]["limitations"] + final["evaluation_result"]["limitations"],
        "model_artifact": selection["artifact"], "created_at": selection["selected_at"], "publication": "local_only"}


def _stored_name(selection, kind):
    return f"{selection['selection_id']}--{supported_exports(selection)[kind][0]}"


def export_descriptors(service, selection):
    registered = {item["name"]: item for item in service._repository.list_artifacts(selection["development_run_id"])}
    return [{"kind": kind, "filename": filename, "media_type": media, "description": description,
             "artifact": registered.get(_stored_name(selection, kind))} for kind, (filename, media, description) in supported_exports(selection).items()]


def selection_details(service, experiment_id, workspace_id, selection_id):
    selection, config, envelope = selection_for(service, experiment_id, workspace_id, selection_id)
    return {"selection": selection, "configuration": config, "inference_schema": inference_schema(selection, config),
        "current": selection["input_fingerprint"] == dependency_fingerprint(envelope["draft"]),
        "exports": export_descriptors(service, selection), "predictions": service._repository.list_prediction_receipts(selection_id),
        "summary": cycle_summary(service, selection, config)}


def _persist_artifact(service, run_id, name, content, media):
    """Recover a lost registration without trusting altered file metadata."""
    expected_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
    registered = next((item for item in service._repository.list_artifacts(run_id) if item["name"] == name), None)
    if registered:
        service._artifact_store.read_verified(registered)
        if registered["sha256"] != expected_hash:
            raise MLStudioServiceError("output_identity_conflict", "An immutable output already exists with different content.", "Use its original input and runtime versions, or submit a new prediction.", status_code=409)
        return registered
    try:
        metadata = service._artifact_store.write(run_id, name, content, media_type=media, server_created=True)
    except ArtifactStoreError as exc:
        if exc.code != "artifact_immutable":
            raise
        metadata = service._artifact_store.verify(run_id, name)
        if metadata.sha256 != expected_hash:
            raise MLStudioServiceError("output_integrity_failed", "The stored output does not match the expected content.", "Restore the verified output before retrying.", status_code=409) from exc
    try:
        return service._repository.register_artifact(metadata)
    except PersistenceError:
        # A concurrent identical request may have registered the same bytes.
        prior = next((item for item in service._repository.list_artifacts(run_id) if item["name"] == name), None)
        if prior != metadata.to_dict():
            raise
        return prior


def prepare_exports(service, experiment_id, workspace_id, selection_id, payload):
    if payload != {}:
        raise MLStudioServiceError("export_request_invalid", "Export preparation accepts an empty object.", "Use the saved selection without overriding its artifacts.")
    import joblib
    selection, config, _ = selection_for(service, experiment_id, workspace_id, selection_id)
    _, content = selected_artifact(service, selection)
    bundle = joblib.load(BytesIO(content))
    if bundle["configuration"]["configuration_id"] != selection["configuration_id"] or bundle["family"] != selection["family"]:
        raise MLStudioServiceError("artifact_binding_invalid", "The model does not match the selected configuration.", "Restore the original model.", status_code=409)
    schema = inference_schema(selection, config)
    summary = cycle_summary(service, selection, config)
    def serialize(model):
        stream = BytesIO()
        joblib.dump(model, stream, compress=3)
        return stream.getvalue()
    example = '''"""Run with Python and the library versions in reproducibility-manifest.json.
Load only the model.joblib exported from this trusted local selection.
Usage: python inference-example.py input.csv predictions.csv
"""
import json
import sys
import joblib
import numpy as np
import pandas as pd

with open("inference-schema.json", encoding="utf-8") as source:
    schema = json.load(source)
fields = schema["fields"]
frame = pd.read_csv(sys.argv[1], dtype={field["name"]: str for field in fields if field["logical_type"] == "string"})
if set(frame.columns) != {field["name"] for field in fields}:
    raise ValueError("CSV columns must match inference-schema.json exactly")
for field in fields:
    name = field["name"]
    if field["logical_type"] == "number":
        frame[name] = pd.to_numeric(frame[name], errors="raise")
        if not np.isfinite(frame[name].dropna()).all():
            raise ValueError("Numeric input must be finite")
    else:
        frame[name] = frame[name].map(lambda value: np.nan if pd.isna(value) else str(value)).astype(object)
model = joblib.load("model.joblib")
predictions = pd.DataFrame({"prediction": model.predict(frame)})
# Keep text labels from being interpreted as formulas by spreadsheet readers.
for column in predictions.select_dtypes(include="object"):
    predictions[column] = predictions[column].map(lambda value: "'" + value if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\\t", "\\r")) else value)
predictions.to_csv(sys.argv[2], index=False)
'''
    card = "\n".join(["# Local model card", "", f"Task: {config['task_type']}", f"Candidate: {selection['family']}", "", "## Intended use", selection["intended_use"], "", "## Prohibited use", selection["prohibited_use"], "", "## Evaluation and limitations", *[f"- {item}" for item in summary["limitations"]], "", "This is a local selection receipt, not a deployment approval. Classification probabilities are not provided."])
    preprocessor = bundle["pipeline"]["estimator"].named_steps["preprocessor"] if config["task_type"] in ("forecasting", "anomaly_detection") else bundle["pipeline"].named_steps["preprocessor"]
    payloads = {"model": serialize(bundle["pipeline"]), "preprocessor": serialize(preprocessor),
        "schema": _json(schema), "report": _json({"development": summary["development_evidence"], "final": summary["final_evidence"]}),
        "model_card": card.encode("utf-8"), "example": example.encode("utf-8"), "summary": _json(summary)}
    if config["task_type"] == "forecasting":
        example = example.replace('predictions = pd.DataFrame({"prediction": model.predict(frame)})',
            'import runpy\nforecast, horizon = runpy.run_path("forecast-runtime.py")["predict_forecast"](model, frame)\npredictions = pd.DataFrame({"prediction": forecast, "horizon": horizon})')
        payloads["example"] = example.encode("utf-8")
        payloads["runtime"] = (Path(__file__).parent / "forecast_runtime.py").read_bytes()
    elif config["task_type"] == "clustering":
        payloads["example"] = example.replace('"prediction"', '"cluster"').encode("utf-8")
    elif config["task_type"] == "anomaly_detection":
        example = example.replace('predictions = pd.DataFrame({"prediction": model.predict(frame)})',
            'import runpy\nscores, flags = runpy.run_path("anomaly-runtime.py")["predict_anomalies"](model, frame)\npredictions = pd.DataFrame({"score": scores, "is_unusual": flags})')
        payloads["example"] = example.encode("utf-8")
        payloads["runtime"] = (Path(__file__).parent / "anomaly_runtime.py").read_bytes()
    existing = {item["kind"]: item["artifact"] for item in export_descriptors(service, selection)}
    artifacts = {}
    for kind, value in payloads.items():
        if existing[kind]:
            service._artifact_store.read_verified(existing[kind])
            artifacts[kind] = existing[kind]
        else:
            artifacts[kind] = _persist_artifact(service, selection["development_run_id"], _stored_name(selection, kind), value, supported_exports(selection)[kind][1])
    manifest = {"contract_version": "ml_studio_manifest_v1", "selection_id": selection_id, "configuration": config,
        "dataset_snapshot": summary["dataset_snapshot"], "runtime_versions": summary["development_evidence"]["runtime_versions"],
        "development_code_revision": service.get_run(selection["development_run_id"])["run_specification"]["code_revision"],
        "final_code_revision": service.get_run(selection["final_run_id"])["run_specification"]["code_revision"], "artifacts": artifacts,
        "serialization": "joblib; load only trusted local artifacts with the recorded runtime versions"}
    _persist_artifact(service, selection["development_run_id"], _stored_name(selection, "manifest"), _json(manifest), "application/json")
    return {"exports": export_descriptors(service, selection)}


def download_export(service, experiment_id, workspace_id, selection_id, kind):
    selection, _, _ = selection_for(service, experiment_id, workspace_id, selection_id)
    if kind not in supported_exports(selection):
        raise MLStudioServiceError("export_not_found", "This export format is unsupported.", "Choose a listed supported export.", status_code=404)
    descriptor = next(item for item in export_descriptors(service, selection) if item["kind"] == kind)
    if descriptor["artifact"] is None:
        raise MLStudioServiceError("export_not_ready", "The export is not prepared yet.", "Prepare the selected model's exports first.", status_code=409)
    return descriptor, service._artifact_store.read_verified(descriptor["artifact"])


def _input_rows(payload, schema):
    if not isinstance(payload, dict) or set(payload) not in ({"input_schema_version", "rows"}, {"input_schema_version", "csv_text"}):
        raise MLStudioServiceError("prediction_request_invalid", "Provide a schema identity and either rows or CSV text.", "Use the selected candidate's input schema.")
    if payload["input_schema_version"] != schema["schema_id"]:
        raise MLStudioServiceError("inference_schema_conflict", "The input schema does not match this selection.", "Reload the selected model's input schema.", status_code=409)
    if "csv_text" in payload:
        if not isinstance(payload["csv_text"], str) or len(payload["csv_text"].encode("utf-8")) > MAX_INPUT_BYTES:
            raise MLStudioServiceError("prediction_input_too_large", "CSV input must be text of at most 2 MB.", "Use a smaller batch.")
        try:
            reader = csv.DictReader(StringIO(payload["csv_text"].lstrip('\ufeff')), strict=True)
            if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
                raise ValueError("duplicate header")
            rows = []
            for record in reader:
                for field in schema["fields"]:
                    if field["name"] in record:
                        value = record[field["name"]]
                        if value == "": record[field["name"]] = None
                        elif field["logical_type"] == "number":
                            try: record[field["name"]] = float(value)
                            except (ValueError, TypeError): pass
                rows.append(record)
                if len(rows) > schema["max_rows"]: break
        except (ValueError, csv.Error) as exc:
            raise MLStudioServiceError("prediction_csv_invalid", "CSV headers must be unique and quoting must be valid.", "Use a comma-separated UTF-8 file with a header row.") from exc
    else:
        rows = payload["rows"]
    if not isinstance(rows, list) or not 1 <= len(rows) <= schema["max_rows"]:
        raise MLStudioServiceError("prediction_row_limit", "A prediction batch must contain between 1 and 10000 rows.", "Choose a nonempty bounded batch.")
    def finite_number(value):
        if type(value) not in (int, float):
            return False
        try:
            return math.isfinite(value)
        except OverflowError:
            return False
    issues = {}
    allowed = {field["name"] for field in schema["fields"]}
    for row in rows:
        if not isinstance(row, dict) or set(row) != allowed:
            issues["columns must match the input schema exactly"] = issues.get("columns must match the input schema exactly", 0) + 1
            continue
        for field in schema["fields"]:
            value = row[field["name"]]
            valid = (value is None and field["nullable"]) or (field["logical_type"] == "number" and finite_number(value)) or (field["logical_type"] == "string" and isinstance(value, str) and len(value) <= 10000)
            if not valid:
                rule = f"{field['name']}: expected finite number or null" if field["logical_type"] == "number" else f"{field['name']}: expected bounded text or null"
                issues[rule] = issues.get(rule, 0) + 1
    if issues:
        descriptions = [f"{rule} ({count} rows)" for rule, count in list(issues.items())[:10]]
        # Column names are user data; avoid exposing them through StructuredError,
        # whose text intentionally disallows paths and implementation details.
        error = MLStudioServiceError("prediction_schema_invalid", "Input rows do not match the selected model schema.", "Check required columns, finite numeric values and text fields.")
        error.validation_issues = descriptions
        raise error
    return rows


def _prediction_worker(connection, data, config):
    try:
        import joblib
        import numpy as np
        from threadpoolctl import threadpool_limits
        bundle = joblib.load(BytesIO(config["serialized_model"]))
        if bundle["configuration"]["configuration_id"] != config["configuration_id"] or bundle["family"] != config["family"]:
            raise ValueError("artifact binding mismatch")
        with threadpool_limits(limits=1):
            if config["task_type"] == "anomaly_detection":
                from .anomaly_runtime import predict_anomalies
                values, flags = predict_anomalies(bundle["pipeline"], normalize_features(data, config))
                connection.send({"result": {"predictions": values.tolist(), "flags": flags.tolist()}})
                return
            if config["task_type"] == "forecasting":
                from .forecast_runtime import predict_forecast
                try:
                    values, horizons = predict_forecast(bundle["pipeline"], data)
                except (ValueError, TypeError, KeyError):
                    connection.send({"error": {"code": "forecast_input_invalid", "message": "Supply one exact horizon per known series immediately after its saved origin.", "remediation": "Match the frequency, series keys and future feature schema using the input template."}})
                    return
                connection.send({"result": {"predictions": values.tolist(), "horizons": horizons.tolist()}})
                return
            values = bundle["pipeline"].predict(normalize_features(data, config)).tolist()
        if config["task_type"] == "regression" and not np.isfinite(values).all():
            raise ValueError("predictions must be finite")
        connection.send({"result": {"predictions": values}})
    except Exception:
        connection.send({"error": {"code": "prediction_failed", "message": "The selected model could not predict these inputs.", "remediation": "Check the schema and saved runtime versions, then retry."}})
    finally:
        connection.close()


def predict_batch(service, experiment_id, workspace_id, selection_id, key, payload):
    import pandas as pd
    selection, config, _ = selection_for(service, experiment_id, workspace_id, selection_id)
    if not isinstance(key, str) or not key.strip() or len(key) > 256:
        raise MLStudioServiceError("idempotency_key_invalid", "Provide a stable prediction key of 1 to 256 characters.", "Retry the same input with the original key.")
    rows = _input_rows(payload, inference_schema(selection, config))
    input_hash = hashlib.sha256(_json(rows)).hexdigest()
    prior = service._repository.prediction_receipt(selection_id, key)
    if prior:
        if prior["input_hash"] != input_hash:
            raise MLStudioServiceError("idempotency_key_conflict", "This prediction key belongs to different input.", "Reuse it only for the original batch.", status_code=409)
        service._artifact_store.read_verified(prior["output_artifact"])
        return prior
    _current(service, experiment_id, workspace_id, selection["input_fingerprint"])
    metadata, content = selected_artifact(service, selection)
    if metadata != selection["artifact"]:
        raise MLStudioServiceError("artifact_binding_invalid", "The model differs from the selected artifact.", "Restore the original selected model.", status_code=409)
    runtime = {**config, "family": selection["family"], "serialized_model": content, "resource": {**config["resource"], "timeout_seconds": min(config["resource"]["timeout_seconds"], 60)}}
    try:
        result = run_with_limits(pd.DataFrame(rows), runtime, cancelled=lambda: False, progress=lambda _: None, worker=_prediction_worker)
    except Exception as exc:
        safe = getattr(exc, "error", None)
        if safe:
            raise MLStudioServiceError(safe.code, safe.message, safe.remediation) from exc
        raise
    predictions = result["predictions"]
    output_name = "cluster" if config["task_type"] == "clustering" else "prediction"
    records = [{"input_row": index + 1, output_name: value} for index, value in enumerate(predictions)]
    if config["task_type"] == "anomaly_detection":
        records = [{"input_row": index + 1, "score": value, "is_unusual": result["flags"][index]} for index, value in enumerate(predictions)]
    if config["task_type"] == "forecasting":
        for index, record in enumerate(records):
            record.update({"time": rows[index][config["roles"]["time"][0]], "series": rows[index][config["roles"]["group"][0]] if config["roles"]["group"] else "Single series", "horizon": result["horizons"][index]})
    columns = list(records[0])
    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(columns)
    for record in records:
        writer.writerow(["'" + value if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")) else value for value in record.values()])
    prediction_id = "prediction-" + hashlib.sha256(f"{selection_id}:{key}".encode()).hexdigest()[:32]
    artifact = _persist_artifact(service, selection["development_run_id"], f"{prediction_id}.csv", output.getvalue().encode("utf-8"), "text/csv")
    receipt = {"contract_version": "ml_studio_prediction_receipt_v1", "prediction_id": prediction_id, "selection_id": selection_id,
        "configuration_id": selection["configuration_id"], "input_schema_version": inference_schema(selection, config)["schema_id"],
        "input_hash": input_hash, "row_count": len(rows), "output_artifact": artifact, "model_artifact_hash": metadata["sha256"],
        "preview": records[:100], "output_columns": columns,
        "warnings": ["Preview is limited to 100 rows. Unknown categories use the fitted encoder's ignore policy. Probabilities are not provided."] + (["Flags mean unusual under the fitted detector, not confirmed errors. Scores use the saved training threshold."] if config["task_type"] == "anomaly_detection" else []),
        "created_at": service._clock().isoformat()}
    try:
        return service._repository.save_prediction_receipt(receipt, key)
    except PersistenceError as exc:
        raise service._translate_persistence(exc) from exc
