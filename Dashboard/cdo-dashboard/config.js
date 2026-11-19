'use strict';

const config = {
  recordTypes: {
    account: 'Account', security: 'Security', transaction: 'Transaction',
    position: 'Position', price: 'Price', pipeline: 'Pipeline event',
  },
  requiredQuantities: { transaction: ['quantity'], position: ['quantity', 'settledQuantity'] },
  requiredCutoffFields: ['bookedAt', 'publishedAt'],
  severities: {
    High: 'Prevents critical processing, reconciliation, or NAV reporting.',
    Medium: 'Creates operational risk but allows processing with investigation or intervention.',
    Low: 'Limited immediate impact and eligible for routine remediation.',
  },
  severityByImpact: { blocking: 'High', intervention: 'Medium', routine: 'Low' },
  exceptions: {
    account: { label: 'Missing account master', owner: 'Account onboarding' },
    security: { label: 'Missing security master', owner: 'Security master' },
    duplicate: { label: 'Duplicate transaction ID', owner: 'Trade capture' },
    quantity: { label: 'Missing quantity', owner: 'Trade capture', ownersByType: { position: 'Position operations' } },
    price: { label: 'Missing valuation price', owner: 'Pricing / valuation operations' },
    timestamp: { label: 'Missing pipeline timestamp', owner: 'Platform operations' },
    cutoff: { label: 'Cutoff violation', owner: 'Platform operations, with the responsible processing team' },
  },
  breakdown: [
    { label: 'Missing quantities', classes: ['quantity'] },
    { label: 'Missing prices', classes: ['price'] },
    { label: 'Duplicate IDs', classes: ['duplicate'] },
    { label: 'Orphan references', classes: ['account', 'security'] },
  ],
  definitions: {
    'Account completeness': 'Share of account master records with a base currency.',
    'Duplicate transaction IDs': 'Distinct transaction IDs appearing more than once in the transaction feed.',
    'Orphan master references': 'Count of unresolved account and security references, once per affected record and reference type.',
    'Cutoff adherence': 'Share of events with an applicable cutoff that were both booked and published on or before it. Missing booking or publication timestamps make eligible events nonadherent.',
    'Missing quantities': 'Distinct transaction or position records with at least one required quantity field blank.',
    'Missing prices': 'Distinct records requiring valuation without a usable security price matched on business date and currency.',
    'Cutoff adherence trend': 'Daily share of eligible events meeting both cutoffs. Dates with no eligible events have no rate.',
    'Priority exceptions': 'Exceptions ordered by High, Medium, and Low downstream impact.',
    'Exception ownership': 'Operational function assigned to investigate and resolve each exception.',
    'Source system': 'Originating system recorded for each record or event.',
  },
  pageSize: 5,
};
