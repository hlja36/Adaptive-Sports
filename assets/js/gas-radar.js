// CL-14-0028 體能評估五級分常模演算法（依《健康達人21》表9 及 體育署《銀髮族體適能健身寶典》表14）
// 請將下方網址替換為您部署 Google Apps Script 後取得的 Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/YOUR_DEPLOYED_SCRIPT_ID/exec";

// 儲存前後測狀態（raw: 原始測量值 [握力, 單足立, 5M步行, 30秒坐立, 30秒內收肌], scores: 1~5級分）
const assessmentState = {
  pre: { raw: [18.5, 9.5, 5.2, 13, 26], scores: [3, 2, 2, 2, 2] },
  post: { raw: null, scores: [0, 0, 0, 0, 0] }
};

// 表 14：65歲以上30秒椅子坐立分齡分性別五級分切點 [1分上限, 2分上限, 3分上限, 4分上限] (超過4分上限即為5分)
const CHAIR_STAND_NORMS = {
  M: {
    "65-69": [13, 15, 19, 24],
    "70-74": [12, 14, 18, 23],
    "75-79": [11, 14, 17, 21],
    "80-84": [10, 12, 15, 19],
    "85-89": [8, 11, 13, 18],
    "90+":   [6, 10, 13, 16]
  },
  F: {
    "65-69": [13, 15, 18, 23],
    "70-74": [12, 14, 17, 21],
    "75-79": [11, 13, 16, 20],
    "80-84": [10, 12, 14, 19],
    "85-89": [8, 10, 13, 17],
    "90+":   [5, 9, 13, 16]
  }
};

// 計算單一測量組的 1~5 級分
function computeFiveLevels(raw, gender, ageGroup) {
  const [grip, oneLeg, walk5m, chairStand, adductor] = raw;

  // 1. 最大握力 (kg)
  let sGrip = 1;
  if (gender === 'M') {
    sGrip = grip >= 37 ? 5 : grip >= 33 ? 4 : grip >= 29 ? 3 : grip >= 25 ? 2 : 1;
  } else {
    sGrip = grip >= 24 ? 5 : grip >= 21 ? 4 : grip >= 18 ? 3 : grip >= 15 ? 2 : 1;
  }

  // 2. 開眼單足立 (秒)
  let sOneLeg = 1;
  if (gender === 'M') {
    sOneLeg = oneLeg >= 60 ? 5 : oneLeg >= 30 ? 4 : oneLeg >= 13 ? 3 : oneLeg >= 5 ? 2 : 1;
  } else {
    sOneLeg = oneLeg >= 60 ? 5 : oneLeg >= 23 ? 4 : oneLeg >= 10 ? 3 : oneLeg >= 4 ? 2 : 1;
  }

  // 3. 一般步行5公尺 (秒，反向指標：秒數越短分數越高)
  let sWalk = 1;
  if (gender === 'M') {
    sWalk = walk5m < 3.6 ? 5 : walk5m < 4.0 ? 4 : walk5m < 4.4 ? 3 : walk5m < 5.0 ? 2 : 1;
  } else {
    sWalk = walk5m < 3.8 ? 5 : walk5m < 4.2 ? 4 : walk5m < 4.8 ? 3 : walk5m < 5.6 ? 2 : 1;
  }

  // 4. 30秒椅子坐立 (次)
  const thresholds = (CHAIR_STAND_NORMS[gender] && CHAIR_STAND_NORMS[gender][ageGroup]) || [11, 13, 16, 20];
  let sChair = chairStand <= thresholds[0] ? 1 :
               chairStand <= thresholds[1] ? 2 :
               chairStand <= thresholds[2] ? 3 :
               chairStand <= thresholds[3] ? 4 : 5;

  // 5. 30秒坐姿內收肌力 (次)
  let sAdductor = 1;
  if (gender === 'M') {
    sAdductor = adductor >= 50 ? 5 : adductor >= 44 ? 4 : adductor >= 31 ? 3 : adductor >= 21 ? 2 : 1;
  } else {
    sAdductor = adductor >= 42 ? 5 : adductor >= 34 ? 4 : adductor >= 29 ? 3 : adductor >= 21 ? 2 : 1;
  }

  return [sGrip, sOneLeg, sWalk, sChair, sAdductor];
}

// 自動計算 BMI 與腰臀比 WHR
function calcBodyMetrics() {
  const h = parseFloat(document.getElementById('height').value);
  const w = parseFloat(document.getElementById('weight').value);
  const waist = parseFloat(document.getElementById('waist').value);
  const hip = parseFloat(document.getElementById('hip').value);

  if (h > 0 && w > 0) {
    const bmi = w / Math.pow(h / 100, 2);
    document.getElementById('bmi').value = bmi.toFixed(1);
  } else {
    document.getElementById('bmi').value = '';
  }

  if (waist > 0 && hip > 0) {
    document.getElementById('whr').value = (waist / hip).toFixed(2);
  } else {
    document.getElementById('whr').value = '';
  }
}

// 初始化 Chart.js 雙圖層重疊雷達圖
let radarChart = null;
function initRadarChart() {
  const ctx = document.getElementById('overlapRadarChart').getContext('2d');
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: [
        '① 上肢肌力 (最大握力)',
        '② 靜態平衡 (開眼單足立)',
        '③ 步行能力 (5公尺步行)',
        '④ 下肢肌力 (30秒坐立)',
        '⑤ 骨盆骶肌力 (30秒內收)'
      ],
      datasets: [
        {
          label: '前測 (Pre-test)',
          data: assessmentState.pre.scores,
          backgroundColor: 'rgba(2, 132, 199, 0.24)',
          borderColor: 'rgba(2, 132, 199, 1)',
          pointBackgroundColor: 'rgba(2, 132, 199, 1)',
          borderWidth: 2.5,
          pointRadius: 4
        },
        {
          label: '後測 (Post-test)',
          data: assessmentState.post.scores,
          backgroundColor: 'rgba(217, 119, 6, 0.30)',
          borderColor: 'rgba(217, 119, 6, 1)',
          pointBackgroundColor: 'rgba(217, 119, 6, 1)',
          borderWidth: 2.5,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, font: { size: 12, weight: 'bold' } },
          pointLabels: { font: { size: 12, weight: 'bold' }, color: '#1e293b' }
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 13, weight: 'bold' } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              const isPre = context.datasetIndex === 0;
              const rawArr = isPre ? assessmentState.pre.raw : assessmentState.post.raw;
              const units = ['kg', '秒', '秒', '次', '次'];
              const rawText = rawArr ? `${rawArr[idx]} ${units[idx]}` : '尚未輸入';
              return `${context.dataset.label}：${context.raw} 級分（實測：${rawText}）`;
            }
          }
        }
      }
    }
  });
}

// 當表單輸入變動時，即時更新對應階段的雷達圖與評估摘要表
function recalculateAll() {
  const stage = document.getElementById('testStage').value;
  const gender = document.getElementById('gender').value;
  const ageGroup = document.getElementById('ageGroup').value;

  const rawInputs = [
    parseFloat(document.getElementById('grip').value) || 0,
    parseFloat(document.getElementById('oneLeg').value) || 0,
    parseFloat(document.getElementById('walk5m').value) || 9.9,
    parseInt(document.getElementById('chairStand').value, 10) || 0,
    parseInt(document.getElementById('adductor').value, 10) || 0
  ];

  const scores = computeFiveLevels(rawInputs, gender, ageGroup);
  assessmentState[stage].raw = rawInputs;
  assessmentState[stage].scores = scores;

  // 若目前在前測模式，同步重算已存在的後測常模（避免切換性別年齡時基準不一致）
  if (stage === 'pre' && assessmentState.post.raw) {
    assessmentState.post.scores = computeFiveLevels(assessmentState.post.raw, gender, ageGroup);
  } else if (stage === 'post' && assessmentState.pre.raw) {
    assessmentState.pre.scores = computeFiveLevels(assessmentState.pre.raw, gender, ageGroup);
  }

  radarChart.data.datasets[0].data = assessmentState.pre.scores;
  radarChart.data.datasets[1].data = assessmentState.post.scores;
  radarChart.update();

  updateSummaryTableAndAlerts(scores, rawInputs[3]);
}

function updateSummaryTableAndAlerts(currentScores, chairCount) {
  const total = currentScores.reduce((a, b) => a + b, 0);
  const badge = document.getElementById('totalScoreBadge');
  badge.textContent = `目前階段總點數：${total} / 25 分`;

  const alertBox = document.getElementById('riskAlertBox');
  if (total <= 15 || chairCount < 8) {
    badge.className = 'badge badge-red';
    alertBox.className = 'alert alert-danger';
    alertBox.innerHTML = `⚠️ <strong>體弱／跌倒高風險警示（總點數 ${total} 分 ${total<=15?'≤ 15分':''}${chairCount<8?'；30秒坐立 < 8次':''}）</strong>：依手冊第 38–40 頁評估標準，建議納入「衰弱組」循序漸進訓練，並加強防跌與下肢肌力處方。`;
  } else {
    badge.className = 'badge badge-green';
    alertBox.className = 'alert alert-success';
    alertBox.innerHTML = `✅ <strong>體能等級評估正常（總點數 ${total} / 25 分）</strong>：圖形面積越大代表體能越佳；可繼續輸入或載入前後測數據進行重疊對比。`;
  }

  const labels = ['① 最大握力 (上肢)', '② 開眼單足立 (平衡)', '③ 5公尺步行 (速度)', '④ 30秒坐立 (下肢)', '⑤ 30秒內收 (骨盆肌)'];
  const units = ['kg', '秒', '秒', '次', '次'];
  const tbody = document.getElementById('radarSummaryBody');

  tbody.innerHTML = labels.map((name, i) => {
    const preRaw = assessmentState.pre.raw ? `${assessmentState.pre.raw[i]} ${units[i]}` : '--';
    const preSc = assessmentState.pre.raw ? `${assessmentState.pre.scores[i]} 分` : '--';
    const postRaw = assessmentState.post.raw ? `${assessmentState.post.raw[i]} ${units[i]}` : '--';
    const postSc = assessmentState.post.raw ? `${assessmentState.post.scores[i]} 分` : '--';

    let diffHtml = '<span style="color:#64748b;">待補後測</span>';
    if (assessmentState.pre.raw && assessmentState.post.raw) {
      const diff = assessmentState.post.scores[i] - assessmentState.pre.scores[i];
      if (diff > 0) diffHtml = `<span style="color:#16a34a;font-weight:700;">▲ +${diff} 級分</span>`;
      else if (diff < 0) diffHtml = `<span style="color:#dc2626;font-weight:700;">▼ ${diff} 級分</span>`;
      else diffHtml = `<span style="color:#0284c7;font-weight:700;">＝ 維持</span>`;
    }

    return `<tr>
      <td><strong>${name}</strong></td>
      <td>${preRaw} <strong>(${preSc})</strong></td>
      <td>${postRaw} <strong>(${postSc})</strong></td>
      <td>${diffHtml}</td>
    </tr>`;
  }).join('');
}

// 示範按鈕：展示前後測重疊雷達圖效果
function loadDemoOverlap() {
  document.getElementById('gender').value = 'F';
  document.getElementById('ageGroup').value = '75-79';
  assessmentState.pre.raw = [16.5, 8.2, 5.4, 12, 24];
  assessmentState.post.raw = [20.5, 19.5, 4.3, 17, 35];
  document.getElementById('testStage').value = 'post';
  document.getElementById('grip').value = 20.5;
  document.getElementById('oneLeg').value = 19.5;
  document.getElementById('walk5m').value = 4.3;
  document.getElementById('chairStand').value = 17;
  document.getElementById('adductor').value = 35;
  recalculateAll();
}

// 串接 GAS：從雲端載入該學員前測資料 (GET)
async function loadStudentFromGAS() {
  const studentId = document.getElementById('studentId').value.trim();
  const statusEl = document.getElementById('gasStatusMsg');
  if (!studentId) {
    alert("請先輸入「受試者編號 / 姓名」再查詢！");
    return;
  }
  if (GAS_WEB_APP_URL.includes("YOUR_DEPLOYED_SCRIPT_ID")) {
    statusEl.style.color = "#d97706";
    statusEl.textContent = "⚠️ 尚未設定您的 GAS 部署網址（請於 assets/js/gas-radar.js 填入 Web App URL）。";
    return;
  }
  statusEl.style.color = "#0284c7";
  statusEl.textContent = "⏳ 正在從 Google Sheets 查詢學員歷史檢測資料...";
  try {
    const res = await fetch(`${GAS_WEB_APP_URL}?studentId=${encodeURIComponent(studentId)}`);
    const data = await res.json();
    if (data.pre) {
      assessmentState.pre.raw = data.pre;
      if (data.gender) document.getElementById('gender').value = data.gender;
      if (data.ageGroup) document.getElementById('ageGroup').value = data.ageGroup;
      if (data.post) assessmentState.post.raw = data.post;
      document.getElementById('testStage').value = 'post';
      recalculateAll();
      statusEl.style.color = "#16a34a";
      statusEl.textContent = `✅ 已成功載入「${studentId}」之前測基準資料，您現在可直接輸入後測數據進行重疊比對！`;
    } else {
      statusEl.style.color = "#d97706";
      statusEl.textContent = `查無「${studentId}」之前測紀錄，請先選擇「前測」並送出建檔。`;
    }
  } catch (err) {
    statusEl.style.color = "#dc2626";
    statusEl.textContent = "❌ 連線失敗，請確認 GAS 權限已設為「所有人（Anyone）」存取。";
  }
}

// 串接 GAS：送出填報資料至 Google Sheets (POST)
async function submitToGAS(e) {
  e.preventDefault();
  const statusEl = document.getElementById('gasStatusMsg');
  const btn = document.getElementById('gasSubmitBtn');

  const stage = document.getElementById('testStage').value;
  const payload = {
    siteName: document.getElementById('siteName').value,
    studentId: document.getElementById('studentId').value.trim(),
    testStage: stage,
    gender: document.getElementById('gender').value,
    ageGroup: document.getElementById('ageGroup').value,
    height: document.getElementById('height').value,
    weight: document.getElementById('weight').value,
    bmi: document.getElementById('bmi').value,
    waist: document.getElementById('waist').value,
    hip: document.getElementById('hip').value,
    whr: document.getElementById('whr').value,
    sbp: document.getElementById('sbp').value,
    dbp: document.getElementById('dbp').value,
    hr: document.getElementById('hr').value,
    rawMetrics: assessmentState[stage].raw,
    levelScores: assessmentState[stage].scores,
    totalScore: assessmentState[stage].scores.reduce((a, b) => a + b, 0),
    riskFlags: {
      frailty: document.getElementById('flagFrailty').checked,
      fall: document.getElementById('flagFall').checked,
      urine: document.getElementById('flagUrine').checked,
      nutrition: document.getElementById('flagNutrition').checked,
      cognition: document.getElementById('flagCog').checked
    },
    instructorName: document.getElementById('instructorName').value.trim()
  };

  if (GAS_WEB_APP_URL.includes("YOUR_DEPLOYED_SCRIPT_ID")) {
    statusEl.style.color = "#16a34a";
    statusEl.textContent = "✅ 前端檢核與雷達圖計算完成！（提示：部署 gas/Code.gs 並貼上網址後即可自動寫入 Google Sheets）";
    return;
  }

  btn.disabled = true;
  statusEl.style.color = "#0284c7";
  statusEl.textContent = "⏳ 正在寫入 Google Sheets 雲端資料庫...";

  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    statusEl.style.color = "#16a34a";
    statusEl.textContent = `✅ 資料已成功傳送至雲端資料庫！（據點：${payload.siteName}｜學員：${payload.studentId}｜階段：${stage === 'pre' ? '前測' : '後測'}）`;
  } catch (err) {
    statusEl.style.color = "#dc2626";
    statusEl.textContent = "❌ 傳送過程發生錯誤，請檢查網路連線後重試。";
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRadarChart();
  recalculateAll();
});
