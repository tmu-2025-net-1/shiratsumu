//GeminiAPIとの通信ロジック
import { env } from '$env/dynamic/private';

const geminiKey = env.GEMINI_API_KEY;

export async function getGeminiResponse(prompt: string): Promise<string> {
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  console.log('Calling Gemini API...');
  
  // モデルの優先順位: gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.5-pro
  const configs = [
    {
      apiVersion: 'v1beta',
      modelName: 'gemini-2.5-flash',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
    },
    {
      apiVersion: 'v1beta',
      modelName: 'gemini-2.5-flash-lite',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`
    },
    {
      apiVersion: 'v1beta',
      modelName: 'gemini-2.5-pro',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`
    }
  ];
  
  let lastError: Error | null = null;
  
  for (const config of configs) {
    try {
      console.log(`Trying ${config.apiVersion}/${config.modelName}`);
      
      // 最大3回リトライ（指数バックオフ）
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(config.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Success with ${config.apiVersion}/${config.modelName} on attempt ${attempt + 1}`);
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
              console.error('Unexpected Gemini API response structure:', data);
              throw new Error('Invalid response structure from Gemini API');
            }
            
            return data.candidates[0].content.parts[0].text;
          } else {
            const errorText = await response.text();
            
            // 429 (Rate Limit) または 5xx エラーの場合はリトライ
            if (response.status === 429 || response.status >= 500) {
              const delay = Math.pow(2, attempt) * 1000; // 指数バックオフ: 1s, 2s, 4s
              console.warn(`${config.modelName} failed with status ${response.status} (attempt ${attempt + 1}/3). Retrying in ${delay}ms...`);
              
              if (attempt < 2) { // 最後の試行でなければ待機
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            
            // リトライしない場合やリトライ上限に達した場合
            lastError = new Error(`${config.modelName} failed with status ${response.status}: ${errorText}`);
            break; // 次のモデルへフォールバック
          }
        } catch (networkError) {
          console.error(`Network error with ${config.modelName} (attempt ${attempt + 1}/3):`, networkError);
          
          if (attempt < 2) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          lastError = networkError instanceof Error ? networkError : new Error(String(networkError));
          break; // 次のモデルへフォールバック
        }
      }
    } catch (error) {
      console.error(`Error with ${config.modelName}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue; // 次のモデルへフォールバック
    }
  }
  
  // すべての設定で失敗した場合
  throw lastError || new Error('All Gemini API configurations failed');
}