/* Fictional reporting models. Monetary inputs use INR lakh unless noted. */
(function () {
  'use strict';
  const regions = ['Gujarat', 'Karnataka', 'Maharashtra', 'Rajasthan', 'Tamil Nadu', 'Telangana'];
  const periods = ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'];
  const models = {
    'sales-margin': {
      geography: true, segment: 'Channel', segments: ['Direct', 'Distributor', 'Digital'], group: 'Product family',
      groups: ['Core', 'Premium', 'Services'], driver: 'region', base: 'Net revenue', outcome: 'Gross profit', rate: 'Gross margin',
      unit: 'Units sold', money: true, outcomeMoney: true, goodHigh: true, bounded: true, shock: 2,
      scenario: 'Improve gross margin in the largest market', interpretation: 'Separate sales scale from conversion into gross profit. Review discount and fulfilment costs before changing price.',
      action: 'Review price realisation and cost-to-serve in the weakest market before reallocating sales effort.',
      method: 'Net revenue is post-discount revenue. Gross profit is net revenue less direct cost. Gross margin is total gross profit divided by total net revenue. Returns, taxes and indirect overhead are outside this example.',
      faq: ['Does a large market have the best margin?', 'Scale and margin answer different questions. Compare the market ranking with the rate matrix and the efficiency gap in Key insights.'],
      row(p, s, g, r) {
        const units = 90 + p * 9 + s * 34 + g * 41 + r * 17;
        const revenue = units * (0.44 + g * 0.13 + s * 0.023 - r * 0.009);
        return [revenue, revenue * (0.18 + g * 0.076 - s * 0.022 + (r % 3) * 0.031 + (p % 3) * 0.012), units];
      }
    },
    'supply-service': {
      geography: true, segment: 'Carrier', segments: ['Carrier A', 'Carrier B', 'Carrier C'], group: 'Service tier',
      groups: ['Economy', 'Express', 'Scheduled'], driver: 'region', base: 'Shipments', outcome: 'Late shipments', rate: 'Late shipment rate',
      unit: 'Freight cost', unitMoney: true, goodHigh: false, bounded: true, shock: 2,
      scenario: 'Reduce late delivery in the largest market', interpretation: 'A high-volume lane may carry more late shipments even when its delay rate is low. Check the rate and the count together.',
      action: 'Compare dispatch cut-off, carrier handoff and service tier in the highest-risk market before changing the carrier mix.',
      method: 'A shipment is late when delivery falls after its promised date. Late rate is total late shipments divided by total shipments. Freight cost is INR lakh. Each record represents shipments to a destination state.',
      faq: ['Is a higher late count always worse performance?', 'A higher late count can follow higher volume. Use late rate for service quality and counts to size the operational impact.'],
      row(p, s, g, r) {
        const shipments = 120 + p * 15 + s * 48 + g * 20 + r * 24;
        const late = Math.round(shipments * (0.035 + s * 0.019 + (2 - g) * 0.013 + (r % 3) * 0.016 + p % 2 * 0.009));
        return [shipments, late, shipments * (0.013 + g * 0.006 + s * 0.0025)];
      }
    },
    'receivables-cash': {
      geography: true, segment: 'Customer industry', segments: ['Retail', 'Manufacturing', 'Services'], group: 'Age band',
      groups: ['0–30 days', '31–60 days', '61+ days'], driver: 'region', base: 'Open receivables', outcome: 'Overdue balance', rate: 'Overdue share',
      unit: 'Open invoices', money: true, outcomeMoney: true, goodHigh: false, bounded: true, latestPeriod: true, shock: 5,
      scenario: 'Reduce overdue share in the largest billing market', interpretation: 'Use the latest selected snapshot to identify concentrated credit exposure. Age bands describe exposure and contractual due dates determine overdue status.',
      action: 'Separate disputes from genuine payment delays in the highest-overdue segment and prioritise accounts by value.',
      method: 'Each period is an end-of-month snapshot. Headline metrics use the latest selected period, so the same invoice is never summed across months in the headline. Age bands track days since invoice issue. Overdue means past the contractual due date.',
      faq: ['Does the scenario predict collected cash?', 'It measures the reduction in overdue balance implied by an assumed change in overdue share. Actual receipts depend on collections, disputes and customer liquidity.'],
      row(p, s, g, r) {
        const balance = 21 + p * 1.8 + s * 8.2 + g * 3.7 + r * 4.1;
        return [balance, balance * (0.04 + g * 0.27 + s * 0.024 + (r % 4) * 0.031 + p % 2 * 0.014), 9 + p + s * 5 + g * 3 + r * 2];
      }
    },
    'customer-retention': {
      period: 'Signup cohort', segment: 'Acquisition channel', segments: ['Organic', 'Paid', 'Referral'], group: 'Tenure',
      groups: ['Week 4', 'Week 8', 'Week 12'], driver: 'segment', matrix: ['period', 'group'], base: 'Customers at signup',
      outcome: 'Customers still active', rate: 'Retention', unit: 'Repeat orders', goodHigh: true, bounded: true, latestGroup: true, shock: 3,
      scenario: 'Improve retention in the largest channel', interpretation: 'Compare cohorts at the same maturity before attributing a gap to acquisition quality.',
      action: 'Inspect onboarding steps and offer mix in the weakest channel at the selected tenure. Run a controlled experiment before scaling the intervention.',
      method: 'A customer is active if they ordered in the 28 days ending at the observed tenure. The same starting cohort is measured at Weeks 4, 8 and 12. Headline metrics use the latest selected tenure, avoiding repeated denominators. The matrix compares all tenures in the current filter selection.',
      faq: ['Why can the Explorer contain more customers than the headline?', 'Explorer rows repeat cohort sizes across tenure observations. Choose one tenure before summing customer counts.'],
      row(p, s, g) {
        const starts = 310 + p * 36 + s * 90;
        const active = Math.round(starts * (0.75 - g * 0.116 - s * 0.057 + p % 3 * 0.024));
        return [starts, active, Math.round(active * (1.2 + g * 0.26 + s * 0.07))];
      }
    },
    'monsoon-readiness': {
      geography: true, segment: 'Response team', segments: ['District crews', 'Mobile crews', 'Partner crews'],
      group: 'Asset type', groups: ['Drainage', 'Backup power', 'Access routes'], driver: 'region',
      base: 'Incidents closed', outcome: 'Closed within target', rate: 'On-time recovery',
      unit: 'Crew hours', goodHigh: true, bounded: true, shock: 4, target: 90,
      scenario: 'Raise on-time recovery in the largest state operation',
      interpretation: 'Read closure volume, timeliness and crew hours together. A growing queue can be invisible if you only track closed incidents.',
      action: 'Check travel time, incident severity and crew coverage before reallocating capacity. Keep an eye on open incidents in the source system.',
      method: 'Each row groups resolved incidents by month, state, response team and asset type. On-time recovery divides closures within their assigned deadline by all closures. Crew hours are logged hours for those closures. The illustrative service target is 90%.',
      faq: ['Can this report tell me how many incidents are still open?', 'The dataset contains resolved incidents only. Pair it with a queue ageing report before deciding where to deploy crews.'],
      row(p, s, g, r) {
        const closed = 38 + 7 * p + 9 * s + 6 * g + 5 * r;
        const withinTarget = .88 + (r % 3) * .026 - .016 * s + .014 * g - (p === 2 || p === 3 ? .045 : 0);
        return [closed, Math.round(closed * withinTarget), Math.round(closed * (2.7 + .32 * r + .23 * g))];
      }
    },
    'portfolio-risk': {
      segment: 'Mandate', segments: ['Core', 'Income', 'Growth'], group: 'Sector', groups: ['Financials', 'Industrials', 'Consumer', 'Technology'],
      driver: 'group', base: 'Starting capital', outcome: 'Gross P&L', rate: 'Gross return', unit: 'Position count', money: true, outcomeMoney: true,
      goodHigh: true, bounded: false, latestPeriod: true, shock: 5, adverse: true,
      scenario: 'Apply an adverse return shock to the largest sector', interpretation: 'A large exposure and a strong contribution can coexist with concentrated downside.',
      action: 'Review exposure and loss under stress before deciding whether to rebalance. Check liquidity and correlated exposures separately.',
      method: 'Capital and positions are beginning-of-month snapshots. Headline values use the latest selected month. Gross return is gross P&L divided by starting capital. This example excludes trading costs, cash flows, leverage and cross-sector correlation.',
      faq: ['Is gross return a time-weighted performance number?', 'Each observation is a one-month gross return. The trend shows separate months. It does not compound the months or adjust for flows.'],
      row(p, s, g) {
        const capital = 140 + p * 11 + s * 34 + g * 19;
        const returns = [[-0.016, 0.022, -0.009, 0.038], [0.034, -0.012, 0.019, -0.024], [0.018, 0.041, 0.007, 0.012]];
        return [capital, capital * (returns[p % 3][g] + s * 0.004 - (p > 3 ? 0.005 : 0)), 3 + (s + g) % 4];
      }
    }
  };

  const report = models[document.body.dataset.report];
  if (!report) throw new Error('Unknown report model.');
  report.color = document.body.style.getPropertyValue('--report-accent');
  report.wash = document.body.style.getPropertyValue('--report-wash');
  report.regions = report.geography ? regions : [''];
  report.periods = periods;
  report.period = report.period || 'Reporting month';
  report.rows = periods.flatMap((period, p) => report.regions.flatMap((region, r) => report.segments.flatMap((segment, s) => report.groups.map((group, g) => {
    const [base, outcome, units] = report.row(p, s, g, r);
    const round = n => Math.round(n * 100) / 100;
    return { period, region, segment, group, base: round(base), outcome: round(outcome), units: round(units) };
  }))));
  window.MSReportModel = report;
})();
