"""Target-free clustering with held-out assignments and explicit geometry limits."""

from copy import deepcopy
from dataclasses import asdict, dataclass
from io import BytesIO

from .contracts import RandomSeedPolicy, SplitPolicy
from .training import TrainingFailure, make_pipeline, normalize_features


@dataclass(frozen=True)
class PartitionSettings:
    """Only the split settings are needed by the shared partitioner."""
    split_policy: SplitPolicy
    random_seed_policy: RandomSeedPolicy


def unsupervised_partition(data, config):
    import pandas as pd
    from .evaluation import _partition_rows
    validation, roles = config["validation"], config["roles"]
    seed = validation["seed"]
    settings = PartitionSettings(SplitPolicy(validation["strategy"], validation["holdout_fraction"], validation["folds"],
        time_column=roles["time"][0] if validation["strategy"] == "time_ordered" else None,
        group_column=roles["group"][0] if validation["strategy"] == "grouped" else None), RandomSeedPolicy(seed, seed, seed))
    # Dummy values are only a positional input; random/time/group splits never
    # stratify on them, and they are never supplied to a fitted estimator.
    return _partition_rows(data, pd.Series(0, index=data.index), settings)


def prepare_features(data, config):
    import numpy as np
    roles = config["roles"]
    required = roles["numeric"] + roles["categorical"] + roles["time"] + roles["group"]
    if not set(required).issubset(data.columns) or len(data) > config["resource"]["max_rows"]:
        raise TrainingFailure("training_input_invalid", "The dataset does not match the saved schema or row limit.")
    if any(not np.isfinite(data[column].dropna().to_numpy(dtype=float)).all() for column in roles["numeric"]):
        raise TrainingFailure("nonfinite_training_data", "Numeric features must contain finite values or missing values.")
    return normalize_features(data.reset_index(drop=True), config)


def aggregate_metrics(folds):
    """Undefined metrics stay unavailable; counts disclose partial fold coverage."""
    import numpy as np
    means, spread, counts = {}, {}, {}
    for name in folds[0]:
        values = [fold[name] for fold in folds if fold[name] is not None]
        means[name] = float(np.mean(values)) if values else None
        spread[name] = float(np.std(values)) if values else None
        counts[name] = len(values)
    return means, spread, counts


def cluster_metrics(pipeline, frame, stability_pipeline, center, seed):
    import numpy as np
    from sklearn.metrics import adjusted_rand_score, silhouette_score
    from sklearn.metrics.pairwise import paired_euclidean_distances
    from scipy import sparse
    transformed = pipeline.named_steps["preprocessor"].transform(frame)
    labels = pipeline.named_steps["model"].predict(transformed)
    centers = pipeline.named_steps["model"].cluster_centers_[labels]
    if sparse.issparse(transformed):
        centers = sparse.csr_matrix(centers)
    distortion = float(np.mean(paired_euclidean_distances(transformed, centers) ** 2))
    # A bounded sample keeps pairwise distance memory independent of dataset size.
    indices = np.random.default_rng(seed).choice(len(labels), min(1000, len(labels)), replace=False)
    silhouette = None
    if 1 < len(np.unique(labels[indices])) < len(indices):
        silhouette = float(silhouette_score(transformed[indices], labels[indices]))
    comparison = stability_pipeline.predict(frame)
    stability = float(adjusted_rand_score(labels, comparison)) if len(np.unique(labels)) > 1 and len(np.unique(comparison)) > 1 else None
    # Squared distance to the training mean gives a one-cluster reference. It has
    # no silhouette or nontrivial stability, so those entries remain null.
    norms = np.asarray(transformed.multiply(transformed).sum(axis=1)).ravel() if sparse.issparse(transformed) else np.sum(transformed ** 2, axis=1)
    baseline = float(np.mean(np.maximum(0, norms - 2 * np.asarray(transformed @ center).ravel() + float(center @ center))))
    return {"silhouette": silhouette, "stability_ari": stability, "distortion": distortion}, {"silhouette": None, "stability_ari": None, "distortion": baseline}, labels


def fit_pair(data, config, family, seed):
    import numpy as np
    count = config["candidate"]["cluster_count"]
    if len(data) < max(10, count * 3):
        raise TrainingFailure("clustering_sample_small", "Every training partition needs at least three rows per cluster and ten rows overall.", "Reduce the cluster count or folds, or supply more data.")
    pipeline = make_pipeline(config, family).fit(data)
    if len(np.unique(pipeline.predict(data))) < 2:
        raise TrainingFailure("clustering_collapsed", "The fitted candidate found only one distinct group.", "Choose informative features or prepare more varied data.")
    subset = np.random.default_rng(seed).choice(len(data), max(count, int(len(data) * .8)), replace=False)
    perturbed_config = deepcopy(config)
    perturbed_config["validation"]["seed"] = (seed + 1) % (2**32)
    comparison = make_pipeline(perturbed_config, family).fit(data.iloc[subset])
    center = np.asarray(pipeline.named_steps["preprocessor"].transform(data).mean(axis=0)).ravel()
    return pipeline, comparison, center


def profiles(frame, labels, config, *, partition):
    import numpy as np
    result = []
    for label in sorted(np.unique(labels)):
        group = frame.iloc[np.flatnonzero(labels == label)]
        numeric = {name: (float(group[name].mean()) if group[name].notna().any() else None) for name in config["roles"]["numeric"][:12]}
        categorical = {name: (str(group[name].mode().iloc[0]) if group[name].notna().any() else None) for name in config["roles"]["categorical"][:8]}
        result.append({"cluster": int(label), "rows": len(group), "numeric_means": numeric, "categorical_modes": categorical})
    return {"kind": "clusters", "partition": partition, "profiles": result,
        "profile_feature_limit": {"numeric": 12, "categorical": 8}, "total_rows": len(frame),
        "distance": "Euclidean after training-only standardization and one-hot encoding", "stability_method": "Adjusted Rand agreement after refitting on a seeded 80% training subsample; cluster label permutations do not affect agreement."}


LIMITATIONS = ["Cluster IDs are arbitrary local labels; they do not prove real-world segments or supervised accuracy.",
    "Euclidean geometry assumes compact groups after numeric standardization and categorical one-hot encoding; feature choice changes the result.",
    "Silhouette uses at most 1000 held-out rows per fold. A single occupied cluster makes separation unavailable.",
    "Stability is agreement under one seeded 80% training subsample, not a confidence interval or evidence of future stability.",
    "New rows are assigned to fitted centers; drift and previously unseen groups require reassessment."]


def train_clustering(data, config, progress):
    import joblib
    import numpy as np
    import pandas as pd
    import sklearn
    from threadpoolctl import threadpool_limits
    data = prepare_features(data, config)
    partition = unsupervised_partition(data, config)
    candidates, bundles, baseline_folds, warnings = [], {}, [], []
    seed = config["validation"]["seed"]
    with threadpool_limits(limits=1):
        for family in config["candidate"]["families"]:
            scores, baselines = [], []
            for index, (train, validation) in enumerate(partition.folds):
                progress(f"{family}_fold_{index + 1}")
                pipeline, comparison, center = fit_pair(data.iloc[train], config, family, (seed + index) % (2**32))
                metrics, baseline, _ = cluster_metrics(pipeline, data.iloc[validation], comparison, center, seed)
                scores.append(metrics); baselines.append(baseline)
            progress(f"{family}_development_fit")
            pipeline, comparison, center = fit_pair(data.iloc[partition.development], config, family, seed)
            evidence = profiles(data.iloc[partition.development], pipeline.predict(data.iloc[partition.development]), config, partition="Development fit; metrics use validation folds")
            metrics, spread, counts = aggregate_metrics(scores)
            evidence["valid_metric_folds"] = counts
            if any(value < len(scores) for value in counts.values()):
                warnings.append(f"Some {family} fold metrics are unavailable because assignments collapsed; valid fold counts are shown.")
            candidates.append({"family": family, "metrics": metrics, "fold_std": spread, "fold_metrics": scores, "evidence": evidence})
            stream = BytesIO()
            joblib.dump({"pipeline": pipeline, "stability_pipeline": comparison, "baseline_center": center, "configuration": config, "family": family,
                "development_indices": partition.development, "holdout_indices": partition.holdout}, stream, compress=3)
            bundles[family] = stream.getvalue()
            if sum(map(len, bundles.values())) > 64 * 1024 * 1024:
                raise TrainingFailure("model_size_limit", "The fitted models exceed the local artifact size limit.")
            baseline_folds = baselines
    return {"candidates": candidates, "bundles": bundles, "split": asdict(partition.evidence),
        "baseline": {"name": "One training-mean cluster", "metrics": aggregate_metrics(baseline_folds)[0]},
        "warnings": warnings, "limitations": ["Final holdout rows were reserved before any fitting or cluster profiling.", *LIMITATIONS],
        "runtime_versions": {"numpy": np.__version__, "pandas": pd.__version__, "sklearn": sklearn.__version__, "joblib": joblib.__version__}}


def evaluate_clustering(bundle, data, config):
    from threadpoolctl import threadpool_limits
    frame = prepare_features(data, config).iloc[bundle["holdout_indices"]]
    with threadpool_limits(limits=1):
        metrics, baseline, labels = cluster_metrics(bundle["pipeline"], frame, bundle["stability_pipeline"], bundle["baseline_center"], config["validation"]["seed"])
    return {"metrics": metrics, "baseline": baseline, "evidence": profiles(frame, labels, config, partition="Reserved final rows assigned to development-fitted centers"),
        "holdout_rows": len(frame), "limitations": ["Only the nominated candidate was evaluated; model, scaling and stability reference remain fitted on development rows.", *LIMITATIONS]}
