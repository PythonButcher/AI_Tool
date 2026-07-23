# Governed Data Source Relationship Contract

## Status

Draft contract for the active relationship persistence and trust gate. Codex must finalize field names, validation states, diagnostics, and error behavior against implementation and tests.

## Boundary

A relationship belongs to one durable data workspace and connects two sources that are members of that workspace. It records analytical intent and validation evidence only. It does not authorize dataframe joins, multi-source AI execution, chart execution, or frontend behavior.

## Relationship Object

The public object must include a contract version, stable relationship ID, workspace ID, left and right source IDs, ordered field pairs, declared cardinality, join behavior, filter direction, active state, validation state, diagnostics, the fingerprints used during validation, a monotonic version, and created and updated timestamps.

Field pairs name one left field and one right field. Composite relationships preserve field-pair order. Candidate suggestions remain inactive until explicit confirmation and successful validation.

## Validation

Validation checks workspace membership, field existence, type compatibility, null rates, uniqueness on the declared key side, unmatched keys, declared cardinality, cycles, ambiguous active paths, estimated row multiplication, and source fingerprint or schema staleness.

Validation states must distinguish at least valid, warning, blocked, and stale. Diagnostics use stable codes, severity, an evidence-based message, affected sources or fields, measured values when safe, and a direct next action. Candidate confidence is explanatory evidence, not proof that a join is semantically correct.

Unsupported many-to-many execution is blocked. A source fingerprint or schema change makes affected validation stale until it is rerun. No relationship becomes active merely because it was suggested.

## Isolation And Errors

Relationship reads and writes are scoped by workspace. Cross-workspace source membership fails safely. Stable errors must cover missing workspace, missing source, invalid membership, missing field, invalid field pair, relationship not found, version conflict, cycle, ambiguous path, stale source, and blocked cardinality without exposing managed source paths or row values.

## Compatibility

Existing source registration, one-source workspace context, governance, Data Hub resolution, Decision Chat identity, and the process-global single-dataset compatibility adapter remain unchanged. Relationship IDs remain absent from current analysis contexts until a later execution gate explicitly integrates them.
