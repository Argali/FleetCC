const monthly = [
  { month:"2026-01", fuel:3200, maintenance:1800, other:450, total:5450 },
  { month:"2026-02", fuel:2900, maintenance:2400, other:380, total:5680 },
  { month:"2026-03", fuel:3500, maintenance:1200, other:520, total:5220 },
  { month:"2026-04", fuel:1167, maintenance:650,  other:200, total:2017 },
];

const costRepository = {
  findAllMonthly: () => [...monthly],
};

module.exports = costRepository;
