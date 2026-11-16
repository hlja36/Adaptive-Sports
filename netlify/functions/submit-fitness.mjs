
const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse(
      { success: false, message: '不允許的請求方式' },
      405
    );
  }

  const contentType =
    request.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return jsonResponse(
      { success: false, message: '資料格式錯誤' },
      415
    );
  }

  const gasUrl = Netlify.env.get('GAS_WEB_APP_URL');

  if (!gasUrl) {
    return jsonResponse(
      { success: false, message: '伺服器尚未完成設定' },
      500
    );
  }

  try {
    const raw = await request.text();

    if (raw.length > 20000) {
      return jsonResponse(
        { success: false, message: '資料量超過限制' },
        413
      );
    }

    const data = JSON.parse(raw);

    if (
      data.action !== 'officialForm' ||
      data.formId !== 'CL-14-0028-1'
    ) {
      return jsonResponse(
        { success: false, message: '表單識別錯誤' },
        400
      );
    }

    if (
      !data.siteName ||
      !data.testStage ||
      !data.participantName ||
      !data.gender ||
      !data.testDate ||
      !data.birthYearRoc ||
      !data.birthMonth ||
      !data.body ||
      !data.fitness
    ) {
      return jsonResponse(
        { success: false, message: '必要資料不完整' },
        400
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(), 20000
    );

    let response;

    try {
      response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(data),
        redirect: 'follow',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return jsonResponse(
        {
          success: false,
          message: 'Google Apps Script 回傳連線錯誤'
        },
        502
      );
    }

    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        {
          success: false,
          message: 'Apps Script 未回傳有效的 JSON 結果'
        },
        502
      );
    }

    if (result.success !== true) {
      return jsonResponse(
        {
          success: false,
          message: result.message || '寫入未獲確認'
        },
        502
      );
    }

    return jsonResponse({
      success: true,
      message: 'Google Sheets 已確認寫入成功'
    });

  } catch (error) {
    console.error('Submission failed:', error.name);

    return jsonResponse(
      {
        success: false,
        message: '連線或處理失敗，請檢查是否已寫入'
      },
      502
    );
  }
}
