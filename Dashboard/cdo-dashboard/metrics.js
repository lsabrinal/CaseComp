'use strict';

const metrics = (() => {
  const blank = value => value == null || (typeof value === 'string' && value.trim() === '');
  const recordKey = record => JSON.stringify([record.type, record.id]);
  const priceKey = record => JSON.stringify([record.securityId, record.date, record.currency]);
  const distinct = exceptions => new Set(exceptions.map(item => recordKey(item.record))).size;
  const percent = (met, total) => total ? met / total * 100 : null;

  function cutoff(event) {
    const deadline = Date.parse(event.cutoffAt);
    const missing = config.requiredCutoffFields.filter(field => !Number.isFinite(Date.parse(event[field])));
    const late = config.requiredCutoffFields.filter(field => Date.parse(event[field]) > deadline);
    const eligible = Number.isFinite(deadline);
    return { eligible, missing, late, met: eligible && !missing.length && !late.length };
  }

  function summarizeCutoff(events) {
    const eligible = events.filter(event => cutoff(event).eligible);
    const met = eligible.filter(event => cutoff(event).met).length;
    return { met, total: eligible.length, rate: percent(met, eligible.length) };
  }

  function analyze(records) {
    const ids = type => new Set(records.filter(record => record.type === type).map(record => record.id));
    const accounts = ids('account');
    const securities = ids('security');
    const prices = new Set(records.filter(record =>
      record.type === 'price' && !blank(record.price) && Number.isFinite(Number(record.price))
    ).map(priceKey));
    const transactionCounts = new Map();
    for (const record of records) {
      if (record.type === 'transaction' && !blank(record.id)) {
        transactionCounts.set(record.id, (transactionCounts.get(record.id) || 0) + 1);
      }
    }
    const byException = new Map();
    function add(record, kind, details, impact = record.impact) {
      const key = JSON.stringify([record.type, record.id, kind]);
      if (!byException.has(key)) byException.set(key, { key, record, kind, sources: new Set(), occurrences: [] });
      const item = byException.get(key);
      const severity = config.severityByImpact[impact] || 'Medium';
      const order = Object.keys(config.severities);
      if (!item.severity || order.indexOf(severity) < order.indexOf(item.severity)) item.severity = severity;
      item.sources.add(record.source);
      item.occurrences.push({ record, details });
    }
    const accountRows = records.filter(record => record.type === 'account');
    const events = records.filter(record => record.type === 'pipeline');
    for (const record of records) {
      if ('accountId' in record && !accounts.has(record.accountId)) add(record, 'account', 'Unresolved account reference ' + (record.accountId || '(blank)'));
      if ('securityId' in record && ['transaction', 'position'].includes(record.type) && !securities.has(record.securityId)) {
        add(record, 'security', 'Unresolved security reference ' + (record.securityId || '(blank)'));
      }
      if (record.type === 'transaction' && transactionCounts.get(record.id) > 1) {
        add(record, 'duplicate', transactionCounts.get(record.id) + ' feed rows share this ID', 'blocking');
      }
      const missingFields = (config.requiredQuantities[record.type] || []).filter(field => blank(record[field]));
      if (missingFields.length) add(record, 'quantity', 'Missing fields: ' + missingFields.join(', '));
      if (record.requiresValuation && !prices.has(priceKey(record))) {
        add(record, 'price', 'No usable price for ' + [record.securityId, record.date, record.currency].join(' / '));
      }
      if (record.type === 'pipeline') {
        const result = cutoff(record);
        const missing = [...result.missing];
        if (!Number.isFinite(Date.parse(record.receivedAt))) missing.unshift('receivedAt');
        if (missing.length) add(record, 'timestamp', 'Missing or invalid timestamps: ' + missing.join(', '));
        if (result.eligible && result.late.length) add(record, 'cutoff', 'Past the applicable cutoff: ' + result.late.join(', '));
      }
    }
    const order = Object.keys(config.severities);
    const exceptions = [...byException.values()].sort((a, b) =>
      order.indexOf(a.severity) - order.indexOf(b.severity) || a.record.id.localeCompare(b.record.id)
    );
    const missingCurrency = accountRows.filter(record => blank(record.baseCurrency)).length;
    return {
      exceptions, events, missingCurrency,
      accountCompleteness: percent(accountRows.length - missingCurrency, accountRows.length),
      duplicates: [...transactionCounts.values()].filter(count => count > 1).length,
      orphanAccounts: exceptions.filter(item => item.kind === 'account').length,
      orphanSecurities: exceptions.filter(item => item.kind === 'security').length,
      cutoff: summarizeCutoff(events),
      missingReceived: events.filter(event => !Number.isFinite(Date.parse(event.receivedAt))).length,
      missingBooked: events.filter(event => cutoff(event).missing.includes('bookedAt')).length,
      missingPublished: events.filter(event => cutoff(event).missing.includes('publishedAt')).length,
    };
  }

  function matchesRecord(record, filters) {
    return (!filters.type || record.type === filters.type) &&
      (!filters.id || record.id.toLowerCase().includes(filters.id.toLowerCase())) &&
      (!filters.source || record.source === filters.source);
  }

  function investigate(analysis, filters) {
    const inScope = analysis.exceptions.filter(item =>
      (!filters.kinds.length || filters.kinds.includes(item.kind)) &&
      item.occurrences.some(({ record }) => matchesRecord(record, filters))
    );
    const affected = new Set(inScope.map(item => recordKey(item.record)));
    const linkedRecord = event => ({ type: event.relatedType, id: event.relatedId || '', source: event.source });
    const dates = [...new Set(analysis.events.map(event => event.date))].sort();
    const events = analysis.events.filter(event => {
      const linked = linkedRecord(event);
      return (matchesRecord(event, filters) || matchesRecord(linked, filters)) &&
        (!filters.kinds.length || affected.has(recordKey(event)) || affected.has(recordKey(linked)));
    });
    return {
      exceptions: inScope,
      breakdown: config.breakdown.map(group => distinct(inScope.filter(item => group.classes.includes(item.kind)))),
      trend: dates.map(date => {
        const daily = events.filter(event => event.date === date);
        const nonadherent = daily.filter(event => {
          const result = cutoff(event);
          return result.eligible && !result.met;
        });
        return { date, ...summarizeCutoff(daily), nonadherent };
      }),
    };
  }

  return { analyze, investigate, cutoff };
})();
