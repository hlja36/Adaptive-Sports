/**
 * CL-14-0028 長者適性運動-增力穩行尿防漏、健康老化快樂過
 * Google Apps Script 後端接收與前後測查詢 API (Code.gs)
 * 
 * 部署步驟：
 * 1. 開啟一個新的 Google Sheets 試算表，將工作表命名為「體能檢測資料庫」
 * 2. 點選「擴充功能」>「Apps Script」，將本程式碼貼上並儲存
 * 3. 點選右上角「部署」>「新增部署」> 類型選「網頁應用程式」
 * 4. 執行身分選「我」，誰可以存取選「所有人 (Anyone)」
 * 5. 複製產生的網頁應用程式網址，貼入網站 assets/js/gas-radar.js 的 GAS_WEB_APP_URL 變數中
 */

const SHEET_NAME = "體能檢測資料庫";

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "填報時間戳記", "據點名稱", "受試者編號/姓名", "測驗階段", "性別", "年齡層",
      "身高(cm)", "體重(kg)", "BMI", "腰圍(cm)", "臀圍(cm)", "腰臀比(WHR)",
      "收縮壓", "舒張壓", "心跳率",
      "最大握力(kg)", "開眼單足立(秒)", "5公尺步行(秒)", "30秒椅子坐立(次)", "30秒坐姿內收(次)",
      "握力級分", "單足立級分", "步行級分", "坐立級分", "內收級分", "五大要素總點數",
      "高危險群篩檢標記(JSON)", "施測指導員"
    ]);
    sheet.getRange(1, 1, 1, 28).setFontWeight("bold").setBackground("#e8f3ee");
  }
  return sheet;
}

// 接收前端網頁送出之體型體能檢測資料 (POST)
function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    const d = JSON.parse(e.postData.contents);
    const raw = d.rawMetrics || [0, 0, 0, 0, 0];
    const sc = d.levelScores || [0, 0, 0, 0, 0];

    sheet.appendRow([
      new Date(),
      d.siteName,
      d.studentId,
      d.testStage,
      d.gender,
      d.ageGroup,
      d.height,
      d.weight,
      d.bmi,
      d.waist,
      d.hip,
      d.whr,
      d.sbp,
      d.dbp,
      d.hr,
      raw[0], raw[1], raw[2], raw[3], raw[4],
      sc[0], sc[1], sc[2], sc[3], sc[4],
      d.totalScore,
      JSON.stringify(d.riskFlags || {}),
      d.instructorName
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 查詢特定受試者的前測與後測數據，供前端繪製重疊雷達圖 (GET)
function doGet(e) {
  const studentId = (e.parameter.studentId || "").trim();
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();

  let result = { studentId: studentId, gender: null, ageGroup: null, pre: null, post: null };

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2]).trim() === studentId) {
      const stage = rows[i][3]; // 'pre' 或 'post'
      result.gender = rows[i][4];
      result.ageGroup = rows[i][5];
      const metrics = [
        Number(rows[i][15]),
        Number(rows[i][16]),
        Number(rows[i][17]),
        Number(rows[i][18]),
        Number(rows[i][19])
      ];
      if (stage === "pre") result.pre = metrics;
      if (stage === "post") result.post = metrics;
    }
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
