'use strict';

const byId = id => document.getElementById(id);
const form = byId('filters');
const fields = form.elements;
const analysis = metrics.analyze(dataset.records);
const number = new Intl.NumberFormat('en-US');
const format = value => number.format(value);
const rate = value => value === null ? '—' : value.toFixed(1) + '%';
const dateLabel = date => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
}).format(new Date(date));
const sources = [...new Set(dataset.records.map(record => record.source))].sort();
let filters;
let page = 0;
let view;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function addOptions(select, options) {
  for (const [value, label] of options) select.add(new Option(label, value));
}

addOptions(fields.type, [['', 'All records'], ...Object.entries(config.recordTypes)]);
addOptions(fields.source, [['', 'All sources'], ...sources.map(source => [source, source])]);
addOptions(fields.kind, [
  ['', 'All exceptions'],
  ...Object.entries(config.exceptions).map(([key, { label }]) => [key, label]),
  ...config.breakdown.filter(group => group.classes.length > 1).map(group => [group.classes.join(','), group.label]),
]);

byId('snapshot').textContent = 'Snapshot ' + dataset.snapshot.label;
byId('as-of').textContent = 'Simulated snapshot · ' + dataset.snapshot.asOf;
byId('missing-received').textContent = format(analysis.missingReceived);
byId('timestamp-split').textContent = format(analysis.missingBooked) + ' missing booked · ' +
  format(analysis.missingPublished) + ' missing published';

const kpiCards = [
  ['Account completeness', rate(analysis.accountCompleteness), format(analysis.missingCurrency) + ' missing base currencies', 'layers'],
  ['Duplicate transaction IDs', format(analysis.duplicates), 'Repeated identifiers', 'documents'],
  ['Orphan master references', format(analysis.orphanAccounts + analysis.orphanSecurities),
    format(analysis.orphanAccounts) + ' account + ' + format(analysis.orphanSecurities) + ' security', 'link'],
  ['Cutoff adherence', rate(analysis.cutoff.rate), format(analysis.cutoff.met) + ' of ' + format(analysis.cutoff.total) + ' eligible events', 'clock'],
];
const iconPaths = {
  layers: 'M3 7 12 3l9 4-9 4z M3 11l9 4 9-4 M3 15l9 4 9-4',
  documents: 'M7 3h7l4 4v13H7z M14 3v5h4 M4 7v15h11 M10 12h5 M10 15h5',
  link: 'M10 15l4-6 M10 18l-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 5 0 M14 6l2-2a4 4 0 0 1 5 5l-4 4a4 4 0 0 1-5 0',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 1 1 0-20 M12 6v6l4 2',
};

for (const [label, value, note, icon] of kpiCards) {
  const card = element('article', null, 'kpi');
  const mark = element('span', null, 'kpi-icon');
  mark.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', iconPaths[icon]);
  svg.append(path);
  mark.append(svg);
  const copy = element('div');
  copy.append(element('h3', label), element('strong', value), element('p', note));
  card.append(mark, copy);
  byId('kpis').append(card);
}

function showDetails(title, pairs, items = []) {
  byId('detail-title').textContent = title;
  const list = element('dl');
  for (const [label, value] of pairs) list.append(element('dt', label), element('dd', value));
  const content = byId('detail-content');
  content.replaceChildren(list);
  if (items.length) {
    const related = element('ul');
    for (const item of items) related.append(element('li', item));
    content.append(related);
  }
  byId('details').showModal();
}

byId('definitions').addEventListener('click', () => {
  showDetails('Provisional metric definitions', Object.entries(config.definitions),
    Object.entries(config.severities).map(([level, definition]) => level + ' — ' + definition));
});

function ownerOf(item) {
  const exception = config.exceptions[item.kind];
  return exception.ownersByType?.[item.record.type] || exception.owner;
}

function showException(item) {
  const { record, kind } = item;
  const visibleField = {
    date: 'Business date', accountId: 'Account ID', securityId: 'Security ID', currency: 'Currency',
    relatedId: 'Linked record', processingTeam: 'Processing team', cutoffAt: 'Applicable cutoff',
    receivedAt: 'Received', bookedAt: 'Booked', publishedAt: 'Published',
  };
  const fields = Object.entries(visibleField).filter(([key]) => key in record)
    .map(([key, label]) => [label, record[key] ?? 'Missing']);
  if (record.type === 'pipeline') {
    const result = metrics.cutoff(record);
    fields.push(['Cutoff outcome', result.eligible ? (result.met ? 'Adherent' : 'Nonadherent') : 'No applicable cutoff']);
  }
  showDetails(record.id, [
    ['Record type', config.recordTypes[record.type]],
    ['Exception', config.exceptions[kind].label],
    ['Severity', item.severity + ' — ' + config.severities[item.severity]],
    ['Owner', ownerOf(item)], ['Source systems', [...item.sources].join(', ')],
    ...fields,
  ], [...new Set(item.occurrences.map(({ record, details }) => record.source + ' · ' + details))]);
}

function renderBreakdown() {
  const container = byId('breakdown');
  container.replaceChildren();
  const max = Math.max(1, ...view.breakdown);
  config.breakdown.forEach((group, index) => {
    const count = view.breakdown[index];
    const selected = group.classes.join(',') === filters.kinds.join(',');
    const button = element('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', selected);
    button.setAttribute('aria-label', group.label + ', ' + format(count) + ' records. Toggle exception filter.');
    const track = element('span', null, 'track');
    const fill = element('span', null, 'fill');
    fill.style.width = count / max * 100 + '%';
    track.append(fill);
    button.append(element('span', group.label), track, element('span', format(count), 'count'));
    button.addEventListener('click', () => {
      const selection = group.classes.join(',');
      fields.type.value = filters.type;
      fields.recordId.value = filters.id;
      fields.source.value = filters.source;
      fields.kind.value = selected ? '' : selection;
      applyFilters({ ...filters, kinds: selected ? [] : group.classes });
      container.children[index].focus();
    });
    container.append(button);
  });
}

function renderTrend() {
  const container = byId('trend');
  container.replaceChildren();
  for (const day of view.trend) {
    const button = element('button');
    button.type = 'button';
    const label = dateLabel(day.date);
    button.setAttribute('aria-label', label + ', ' + (day.total ? rate(day.rate) + ' adherence' : 'no eligible events'));
    const slot = element('span', null, 'bar-slot');
    const bar = element('span', null, 'day-bar');
    bar.style.height = (day.rate || 0) + '%';
    slot.append(bar);
    button.append(element('strong', rate(day.rate)), slot, element('span', label, 'day-label'));
    button.addEventListener('click', () => showDetails('Cutoff adherence · ' + label, [
      ['Adherence', day.total ? rate(day.rate) : 'No eligible events'],
      ['Adherent events', format(day.met)],
      ['Eligible events', format(day.total)],
      ['Nonadherent events', format(day.total - day.met)],
    ], day.nonadherent.map(event => {
      const result = metrics.cutoff(event);
      const reasons = [...result.missing.map(field => field + ' missing'), ...result.late.map(field => field + ' late')];
      return event.id + ' · ' + event.source + ' · ' + reasons.join(', ');
    })));
    container.append(button);
  }
  if (!view.trend.length) container.append(element('p', 'No event dates available.'));
}

function renderTable() {
  const rows = byId('rows');
  rows.replaceChildren();
  const start = page * config.pageSize;
  const exceptions = view.exceptions;
  const visible = exceptions.slice(start, start + config.pageSize);
  for (const item of visible) {
    const row = element('tr');
    const first = element('td');
    const button = element('button', item.record.id, 'record');
    button.append(element('small', config.recordTypes[item.record.type]));
    button.addEventListener('click', () => showException(item));
    first.append(button);
    const severity = element('td');
    severity.append(element('span', item.severity, 'severity ' + item.severity));
    row.append(first, element('td', config.exceptions[item.kind].label), severity, element('td', ownerOf(item)));
    rows.append(row);
  }
  if (!visible.length) {
    const row = element('tr');
    const cell = element('td', 'No exceptions match the applied filters.');
    cell.colSpan = 4;
    row.append(cell);
    rows.append(row);
  }
  byId('pages').textContent = visible.length ?
    (start + 1) + '–' + (start + visible.length) + ' of ' + format(exceptions.length) + ' exceptions' : '0 exceptions';
  byId('previous').disabled = page === 0;
  byId('next').disabled = start + config.pageSize >= exceptions.length;
}

function applyFilters(next) {
  filters = next;
  page = 0;
  view = metrics.investigate(analysis, filters);
  const active = [
    config.recordTypes[filters.type], filters.id && 'ID contains “' + filters.id + '”',
    fields.kind.options[fields.kind.selectedIndex]?.value && fields.kind.options[fields.kind.selectedIndex].text,
    filters.source,
  ].filter(Boolean);
  byId('scope').textContent = active.join(' · ') || 'All records';
  renderBreakdown();
  renderTrend();
  renderTable();
}

function readFilters() {
  return {
    type: fields.type.value,
    id: fields.recordId.value.trim(),
    kinds: fields.kind.value.split(',').filter(Boolean),
    source: fields.source.value,
  };
}

form.addEventListener('submit', event => {
  event.preventDefault();
  applyFilters(readFilters());
});
form.addEventListener('reset', event => {
  event.preventDefault();
  fields.type.value = fields.recordId.value = fields.kind.value = fields.source.value = '';
  applyFilters(readFilters());
});
byId('previous').addEventListener('click', () => { page--; renderTable(); });
byId('next').addEventListener('click', () => { page++; renderTable(); });
applyFilters(readFilters());
