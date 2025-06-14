/**
 * Aggregator helper functions.
 * Each takes an array of numbers and returns a single value.
 */
const aggregators = {
  sum: (values) => values.reduce((acc, val) => acc + val, 0),
  avg: (values) =>
    values.reduce((acc, val) => acc + val, 0) / (values.length || 1),
  max: (values) => Math.max(...values),
  min: (values) => Math.min(...values),
};



export function transformToChartData(
  data,
  {
    labelField = null,
    dataFields = [], // Allow multiple numeric fields
    aggregator = "sum",
    sortBy = "label", // Options: "label", "value", or "none"
  } = {}
) {
  if (!Array.isArray(data) || data.length === 0) {
    console.error("[transformToChartData] Data is empty or not an array.");
    return null;
  }

  const firstRow = data[0];
  if (typeof firstRow !== "object" || firstRow === null) {
    console.error("[transformToChartData] First row is invalid or not an object.");
    return null;
  }

  // Dynamically identify fields if not provided
  const possibleStringKeys = Object.keys(firstRow).filter(
    (key) => typeof firstRow[key] === "string"
  );
  const possibleNumericKeys = Object.keys(firstRow).filter(
    (key) => typeof firstRow[key] === "number" || !isNaN(parseFloat(firstRow[key]))
  );

  const chosenLabelField = labelField || possibleStringKeys[0];
  const chosenDataFields = dataFields.length > 0 ? dataFields : [possibleNumericKeys[0]];

  if (!chosenLabelField || chosenDataFields.length === 0) {
    console.error("[transformToChartData] Could not determine label/data fields.");
    return null;
  }

  const chosenAggregator = aggregators[aggregator] || aggregators["sum"];
  const groupedData = {};

  // Group data by labelField
  data.forEach((row, idx) => {
    const labelValue = row[chosenLabelField];
    if (!labelValue) return;

    chosenDataFields.forEach((field) => {
      const rawValue = row[field];
      const numericValue = typeof rawValue === "number" ? rawValue : parseFloat(rawValue);

      if (isNaN(numericValue)) {
        console.warn(`[transformToChartData] Non-numeric value in field "${field}" at row ${idx}.`);
        return;
      }

      if (!groupedData[labelValue]) groupedData[labelValue] = {};
      if (!groupedData[labelValue][field]) groupedData[labelValue][field] = [];

      groupedData[labelValue][field].push(numericValue);
    });
  });

  // Aggregate grouped data
  const labels = Object.keys(groupedData);
  const datasets = chosenDataFields.map((field) => ({
    label: field,
    data: labels.map((label) => chosenAggregator(groupedData[label][field] || [])),
    backgroundColor: "rgba(75,192,192,0.4)", // Example: teal background
    borderColor: "rgba(75,192,192,1)", // Example: teal border
    borderWidth: 1,
  }));

  // Sort labels and datasets if needed
  if (sortBy === "label") {
    labels.sort();
  } else if (sortBy === "value") {
    const aggregatedSums = labels.map(
      (label) => datasets[0].data[labels.indexOf(label)] || 0
    );
    labels.sort((a, b) => aggregatedSums[labels.indexOf(b)] - aggregatedSums[labels.indexOf(a)]);
  }

  return {
    labels,
    datasets,
  };
}
