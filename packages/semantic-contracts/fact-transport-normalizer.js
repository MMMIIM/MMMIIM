const DECIMAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const TOP_LEVEL_FIELDS = new Set([
  'subject_type', 'subject_name', 'entities', 'status', 'status_source_text',
  'scopes', 'quantities', 'validity', 'domain_metadata'
]);

function safeNumericNumber(value) {
  if (typeof value !== 'string' || !DECIMAL.test(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) return null;
  // Preserve decimal spellings such as 3.0; they remain valid canonical text.
  if (String(number) !== value) return null;
  return number;
}

function normalizeNumeric(value, removedPropertyNames, path, counters) {
  const converted = safeNumericNumber(value);
  if (converted === null) return value;
  counters.numeric_coercion_count += 1;
  return converted;
}

/**
 * Narrow transport compatibility projection. It removes only the historical
 * nested source_text fields that are not part of the canonical transport
 * contract and losslessly converts plain numeric strings. Unknown properties
 * are deliberately retained so strict validation can reject them.
 */
export function normalizeEvidenceFactTransportData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.facts)) {
    return {
      data,
      normalizer_invoked: false,
      removed_property_names: [],
      numeric_coercion_count: 0,
      unknown_top_level_fields: []
    };
  }
  const removedPropertyNames = [];
  const counters = { numeric_coercion_count: 0 };
  const facts = data.facts.map((fact, factIndex) => {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return fact;
    const next = { ...fact };
    if (Array.isArray(next.scopes)) {
      next.scopes = next.scopes.map((scope, scopeIndex) => {
        if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return scope;
        const projected = { ...scope };
        if (Object.prototype.hasOwnProperty.call(projected, 'source_text')) {
          delete projected.source_text;
          removedPropertyNames.push(`scopes[${scopeIndex}].source_text`);
        }
        return projected;
      });
    }
    if (Array.isArray(next.quantities)) {
      next.quantities = next.quantities.map((quantity, quantityIndex) => {
        if (!quantity || typeof quantity !== 'object' || Array.isArray(quantity)) return quantity;
        const projected = { ...quantity };
        if (Object.prototype.hasOwnProperty.call(projected, 'source_text')) {
          delete projected.source_text;
          removedPropertyNames.push(`quantities[${quantityIndex}].source_text`);
        }
        if (Object.prototype.hasOwnProperty.call(projected, 'value')) {
          projected.value = normalizeNumeric(projected.value, removedPropertyNames, `quantities[${quantityIndex}].value`, counters);
        }
        if (Object.prototype.hasOwnProperty.call(projected, 'sample_size')) {
          projected.sample_size = normalizeNumeric(projected.sample_size, removedPropertyNames, `quantities[${quantityIndex}].sample_size`, counters);
        }
        if (Array.isArray(projected.conditions)) {
          projected.conditions = projected.conditions.map((condition, conditionIndex) => {
            if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return condition;
            const nextCondition = { ...condition };
            if (Object.prototype.hasOwnProperty.call(nextCondition, 'value')) {
              nextCondition.value = normalizeNumeric(nextCondition.value, removedPropertyNames, `quantities[${quantityIndex}].conditions[${conditionIndex}].value`, counters);
            }
            return nextCondition;
          });
        }
        return projected;
      });
    }
    return next;
  });
  return {
    data: removedPropertyNames.length || counters.numeric_coercion_count
      ? { ...data, facts }
      : data,
    normalizer_invoked: true,
    removed_property_names: [...new Set(removedPropertyNames)].sort(),
    numeric_coercion_count: counters.numeric_coercion_count,
    unknown_top_level_fields: Object.keys(data).filter(key => key !== 'facts' && !TOP_LEVEL_FIELDS.has(key))
  };
}
