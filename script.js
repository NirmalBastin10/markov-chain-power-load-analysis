// DOM references
const inputs = {
  m11: document.getElementById("m11"),
  m12: document.getElementById("m12"),
  m13: document.getElementById("m13"),
  m21: document.getElementById("m21"),
  m22: document.getElementById("m22"),
  m23: document.getElementById("m23"),
  m31: document.getElementById("m31"),
  m32: document.getElementById("m32"),
  m33: document.getElementById("m33"),
  i1: document.getElementById("i1"),
  i2: document.getElementById("i2"),
  i3: document.getElementById("i3"),
  days: document.getElementById("days"),
  load1: document.getElementById("load1"),
  load2: document.getElementById("load2"),
  load3: document.getElementById("load3"),
  state1Name: document.getElementById("state1Name"),
  state2Name: document.getElementById("state2Name"),
  state3Name: document.getElementById("state3Name"),
  riskState: document.getElementById("riskState"),
  exampleSelect: document.getElementById("exampleSelect"),
};

const btn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");
const res1 = document.getElementById("res1");
const res2 = document.getElementById("res2");
const res3 = document.getElementById("res3");
const steadyRisk = document.getElementById("steadyRisk");
const expectedOverloadDays = document.getElementById("expectedOverloadDays");
const expectedLoadLastDay = document.getElementById("expectedLoadLastDay");
const tableBody = document.getElementById("tableBody");
const messageEl = document.getElementById("message");
const probChartCanvas = document.getElementById("probChart");
const labelL1 = document.getElementById("labelL1");
const labelL2 = document.getElementById("labelL2");
const labelL3 = document.getElementById("labelL3");
const thL1 = document.getElementById("thL1");
const thL2 = document.getElementById("thL2");
const thL3 = document.getElementById("thL3");

let chartInstance = null;

function toNumber(val, fallback = 0) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

function readMatrix() {
  const P = [
    [
      toNumber(inputs.m11.value, 0),
      toNumber(inputs.m12.value, 0),
      toNumber(inputs.m13.value, 0),
    ],
    [
      toNumber(inputs.m21.value, 0),
      toNumber(inputs.m22.value, 0),
      toNumber(inputs.m23.value, 0),
    ],
    [
      toNumber(inputs.m31.value, 0),
      toNumber(inputs.m32.value, 0),
      toNumber(inputs.m33.value, 0),
    ],
  ];
  return P;
}

function normalizeRow(row) {
  const s = row.reduce((a, b) => a + b, 0);
  if (s === 0)
    return [
      1 / row.length,
      ...Array(row.length - 1).fill(1 / row.length),
    ].slice(0, row.length);
  return row.map((x) => x / s);
}

function normalizeMatrixRows(P) {
  return P.map((row) => normalizeRow(row));
}

function readInitialVector() {
  const v = [
    toNumber(inputs.i1.value, 0),
    toNumber(inputs.i2.value, 0),
    toNumber(inputs.i3.value, 0),
  ];
  const s = v.reduce((a, b) => a + b, 0);
  if (s === 0) {
    return [1, 0, 0];
  }
  return v.map((x) => x / s);
}

function multiplyVectorMatrix(vec, P) {
  const res = [0, 0, 0];
  for (let j = 0; j < 3; j++) {
    let sum = 0;
    for (let i = 0; i < 3; i++) {
      sum += vec[i] * P[i][j];
    }
    res[j] = sum;
  }
  return res;
}

function nearlyEqual(a, b, eps = 1e-10) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum < eps;
}

function formatProb(x) {
  return Number.isFinite(x) ? x.toFixed(4) : "0.0000";
}

function formatNumber(x, digits = 2) {
  return Number.isFinite(x) ? x.toFixed(digits) : "0.00";
}

function clearTable() {
  tableBody.innerHTML = "";
}

function appendRow(day, v) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="p-2 text-[#4c739a] dark:text-slate-400">${day}</td>
    <td class="p-2 text-[#0d141b] dark:text-slate-300">${formatProb(v[0])}</td>
    <td class="p-2 text-[#0d141b] dark:text-slate-300">${formatProb(v[1])}</td>
    <td class="p-2 text-[#0d141b] dark:text-slate-300">${formatProb(v[2])}</td>
  `;
  tableBody.appendChild(tr);
}

function computeSteadyStateByPowerMethod(P, tol = 1e-12, maxIter = 5000) {
  let v = [1 / 3, 1 / 3, 1 / 3];
  for (let iter = 0; iter < maxIter; iter++) {
    const next = multiplyVectorMatrix(v, P);
    const sum = next.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < 3; i++) next[i] = next[i] / sum;
    if (nearlyEqual(v, next, tol)) {
      return next;
    }
    v = next;
  }
  return v;
}

function showMessage(txt, timeout = 3000) {
  messageEl.textContent = txt;
  if (timeout > 0) {
    setTimeout(() => {
      if (messageEl.textContent === txt) messageEl.textContent = "";
    }, timeout);
  }
}

function updateLabelsFromNames() {
  const n1 = inputs.state1Name.value.trim() || "Low load (L1)";
  const n2 = inputs.state2Name.value.trim() || "Normal load (L2)";
  const n3 = inputs.state3Name.value.trim() || "Overload (L3)";
  labelL1.textContent = n1;
  labelL2.textContent = n2;
  labelL3.textContent = n3;
  thL1.textContent = `Probability (${n1})`;
  thL2.textContent = `Probability (${n2})`;
  thL3.textContent = `Probability (${n3})`;
}

// Example scenarios
const examples = {
  1: {
    matrix: [
      [0.9, 0.1, 0.0],
      [0.3, 0.6, 0.1],
      [0.4, 0.5, 0.1],
    ],
    init: [1.0, 0.0, 0.0],
    days: 15,
    loads: [50, 90, 130],
    names: ["Low load (L1)", "Normal load (L2)", "Overload (L3)"],
    riskState: 2,
  },
  2: {
    matrix: [
      [0.6, 0.2, 0.2],
      [0.1, 0.5, 0.4],
      [0.05, 0.25, 0.7],
    ],
    init: [0.7, 0.3, 0.0],
    days: 20,
    loads: [80, 130, 180],
    names: ["Normal (L1)", "High (L2)", "Severe overload (L3)"],
    riskState: 2,
  },
  3: {
    matrix: [
      [0.5, 0.3, 0.2],
      [0.3, 0.4, 0.3],
      [0.2, 0.5, 0.3],
    ],
    init: [0.3, 0.4, 0.3],
    days: 25,
    loads: [60, 110, 160],
    names: ["Off-peak (L1)", "Mid (L2)", "Peak (L3)"],
    riskState: 2,
  },
};

function applyExample(which) {
  const ex = examples[which];
  if (!ex) return;

  inputs.m11.value = ex.matrix[0][0];
  inputs.m12.value = ex.matrix[0][1];
  inputs.m13.value = ex.matrix[0][2];
  inputs.m21.value = ex.matrix[1][0];
  inputs.m22.value = ex.matrix[1][1];
  inputs.m23.value = ex.matrix[1][2];
  inputs.m31.value = ex.matrix[2][0];
  inputs.m32.value = ex.matrix[2][1];
  inputs.m33.value = ex.matrix[2][2];

  inputs.i1.value = ex.init[0];
  inputs.i2.value = ex.init[1];
  inputs.i3.value = ex.init[2];

  inputs.days.value = ex.days;

  inputs.load1.value = ex.loads[0];
  inputs.load2.value = ex.loads[1];
  inputs.load3.value = ex.loads[2];

  inputs.state1Name.value = ex.names[0];
  inputs.state2Name.value = ex.names[1];
  inputs.state3Name.value = ex.names[2];

  inputs.riskState.value = ex.riskState.toString();

  updateLabelsFromNames();
  clearTable();
  res1.textContent = "—";
  res2.textContent = "—";
  res3.textContent = "—";
  steadyRisk.textContent = "—";
  expectedOverloadDays.textContent = "—";
  expectedLoadLastDay.textContent = "—";
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  showMessage("Example loaded. Click Calculate to simulate.");
}

function drawChart(daysArr, p1Arr, p2Arr, p3Arr) {
  if (chartInstance) {
    chartInstance.destroy();
  }
  const ctx = probChartCanvas.getContext("2d");

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: daysArr,
      datasets: [
        {
          label: "State 1",
          data: p1Arr,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 1.5,
        },
        {
          label: "State 2",
          data: p2Arr,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.1)",
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 1.5,
        },
        {
          label: "State 3",
          data: p3Arr,
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.1)",
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 1,
          ticks: {
            callback: (v) => v.toFixed(1),
          },
          title: {
            display: true,
            text: "Probability",
          },
        },
        x: {
          title: {
            display: true,
            text: "Day",
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 14,
          },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const val = ctx.parsed.y;
              return `${ctx.dataset.label}: ${val.toFixed(4)}`;
            },
          },
        },
      },
    },
  });
}

btn.addEventListener("click", () => {
  messageEl.textContent = "";
  updateLabelsFromNames();

  // Read and validate matrix
  let P = readMatrix();
  let hasNegative = false;
  for (const row of P) {
    for (const val of row) {
      if (val < 0) {
        hasNegative = true;
        break;
      }
    }
  }
  if (hasNegative) {
    showMessage("Invalid matrix: probabilities cannot be negative.", 5000);
    return;
  }

  const rowSums = P.map((r) => r.reduce((a, b) => a + b, 0));
  let normalized = false;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(rowSums[i] - 1) > 1e-6) normalized = true;
  }
  if (normalized) {
    P = normalizeMatrixRows(P);
    showMessage(
      "Note: Matrix rows were auto-normalized so each row sums to 1.",
      4000
    );
  }

  // Read initial vector
  const init = readInitialVector();

  // Read days
  let n = parseInt(inputs.days.value);
  if (!Number.isFinite(n) || n < 1) {
    n = 10;
  }
  if (n > 365) {
    showMessage("Large horizon truncated to 365 days for clarity.", 4000);
    n = 365;
  }

  // Per-state loads
  const L1 = Math.max(0, toNumber(inputs.load1.value, 0));
  const L2 = Math.max(0, toNumber(inputs.load2.value, 0));
  const L3 = Math.max(0, toNumber(inputs.load3.value, 0));

  // Clear previous table
  clearTable();

  // arrays for chart and overload stats
  const daysArr = [];
  const p1Arr = [];
  const p2Arr = [];
  const p3Arr = [];
  const riskIndex = parseInt(inputs.riskState.value) || 2;
  let overloadSum = 0;

  // Day 0
  appendRow(0, init);
  daysArr.push(0);
  p1Arr.push(init[0]);
  p2Arr.push(init[1]);
  p3Arr.push(init[2]);
  overloadSum += init[riskIndex];

  // compute day-by-day
  let current = init.slice();
  let last = current;
  for (let day = 1; day <= n; day++) {
    const next = multiplyVectorMatrix(current, P);
    const s = next.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < 3; i++) next[i] = next[i] / s;
    appendRow(day, next);
    daysArr.push(day);
    p1Arr.push(next[0]);
    p2Arr.push(next[1]);
    p3Arr.push(next[2]);
    overloadSum += next[riskIndex];
    last = next;
    current = next;
  }

  // steady state
  const steady = computeSteadyStateByPowerMethod(P, 1e-12, 5000);

  // Update result cards
  res1.textContent = formatProb(steady[0]);
  res2.textContent = formatProb(steady[1]);
  res3.textContent = formatProb(steady[2]);

  // Overload metrics
  steadyRisk.textContent = formatProb(steady[riskIndex]);
  expectedOverloadDays.textContent = formatNumber(overloadSum, 2);

  // Expected load last day using per-state loads
  const expectedMW = last[0] * L1 + last[1] * L2 + last[2] * L3;
  expectedLoadLastDay.textContent =
    L1 + L2 + L3 > 0
      ? `${formatNumber(expectedMW, 2)} MW`
      : "Per-state loads not set";

  // Draw chart
  drawChart(daysArr, p1Arr, p2Arr, p3Arr);

  // Scroll to results
  res1.scrollIntoView({ behavior: "smooth", block: "center" });
});

resetBtn.addEventListener("click", () => {
  const which = inputs.exampleSelect.value || "1";
  applyExample(which);
});

inputs.exampleSelect.addEventListener("change", () => {
  const which = inputs.exampleSelect.value || "1";
  applyExample(which);
});

// keep labels synced if user edits names
["state1Name", "state2Name", "state3Name"].forEach((id) => {
  inputs[id].addEventListener("input", updateLabelsFromNames);
});

// initialize with example 1
applyExample("1");
