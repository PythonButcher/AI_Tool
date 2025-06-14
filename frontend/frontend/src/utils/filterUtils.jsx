export function inferFieldTypes(sampleRows) {
    const fieldTypes = {};

    if (!Array.isArray(sampleRows) || sampleRows.length === 0) {
        return fieldTypes;
    }

    const inferType = (value) => {
        if (typeof value === 'number') {
            return 'number';
        } else if (typeof value === 'boolean') {
            return 'boolean';
        } else if (Object.prototype.toString.call(value) === '[object Date]') {
            return 'date';
        } else {
            return 'string';
        }
    };

    const firstRow = sampleRows[0];
    for (const fieldName in firstRow) {
        if (firstRow.hasOwnProperty(fieldName)) {
            fieldTypes[fieldName] = inferType(firstRow[fieldName]);
        }
    }

    return fieldTypes;
}

export function applyRules(data, rules) {
    if (!Array.isArray(data) || !Array.isArray(rules)) {
        return data;
    }

    return data.filter((item) => {
        return rules.every((rule) => {
            const { field, operator, value } = rule;
            if (!item.hasOwnProperty(field)) {
                return false;
            }

           switch (operator) {
                case 'equals':
                    if (typeof item[field] === 'string' && typeof value === 'string') {
                        return item[field].trim().toLowerCase() === value.trim().toLowerCase();
                    }
                    return item[field] === value;
                case 'notEquals':
                    if (typeof item[field] === 'string' && typeof value === 'string') {
                        return item[field].trim().toLowerCase() !== value.trim().toLowerCase();
                    }
                    return item[field] !== value;
                case 'greaterThan':
                    // Handles numbers and numeric-like strings
                    return Number(item[field]) > Number(value);
                case 'lessThan':
                    return Number(item[field]) < Number(value);
                case 'contains':
                    if (typeof item[field] === 'string' && typeof value === 'string') {
                        return item[field].toLowerCase().includes(value.trim().toLowerCase());
                    }
                    return false;
                default:
                    return true;
            }

        });
    });
}

export function debounce(fn, ms) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), ms);
    };
}