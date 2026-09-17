// Anonymized structural fixtures captured from the bounded Fact Provider
// canary. They intentionally contain no provider content or business text.
export const FACT_PROVIDER_SHAPE_CANARY_FIXTURES = Object.freeze({
  invalid_empty_domain_metadata: Object.freeze({
    facts: Object.freeze([Object.freeze({
      subject_type: 'subject',
      subject_name: null,
      entities: Object.freeze([]),
      status: 'unknown',
      scopes: Object.freeze([]),
      quantities: Object.freeze([]),
      validity: Object.freeze({ status: 'unknown', valid_from: null, valid_until: null }),
      domain_metadata: Object.freeze({ capability: Object.freeze({}) })
    })])
  }),
  valid_empty_result: Object.freeze({ facts: Object.freeze([]) })
});
