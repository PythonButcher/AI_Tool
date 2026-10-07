"""Portable scoring for the trusted exported anomaly model and fitted threshold."""


def predict_anomalies(model, frame):
    import numpy as np
    scores = -np.asarray(model["estimator"].score_samples(frame), dtype=float)
    if not np.isfinite(scores).all():
        raise ValueError("Detector scores must be finite")
    return scores, scores > model["threshold"]
