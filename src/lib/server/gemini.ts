//GeminiAPIとの通信ロジック
import { env } from '$env/dynamic/private';

const geminiKey = env.GEMINI_API_KEY;

export async function getGeminiResponse(prompt: string): Promise<string> {
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  console.log('Calling Gemini API with prompt:', prompt);
  
  // 最新の確実に動作するモデルのみを使用
  const configs = [
    {
      apiVersion: 'v1beta',
      modelName: 'gemini-1.5-flash',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
    }
  ];
  
  let lastError: Error | null = null;
  
  for (const config of configs) {
    try {
      console.log(`Trying ${config.apiVersion}/${config.modelName}`);
      
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
        console.log('Gemini API Response:', data);
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
          console.error('Unexpected Gemini API response structure:', data);
          throw new Error('Invalid response structure from Gemini API');
        }
        
        console.log(`Success with ${config.apiVersion}/${config.modelName}`);
        return data.candidates[0].content.parts[0].text;
      } else {
        const errorText = await response.text();
        console.error(`${config.apiVersion}/${config.modelName} failed with status ${response.status}:`, errorText);
        lastError = new Error(`${config.apiVersion}/${config.modelName} failed with status ${response.status}: ${errorText}`);
        continue; // 次の設定を試す
      }
    } catch (error) {
      console.error(`Error with ${config.apiVersion}/${config.modelName}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue; // 次の設定を試す
    }
  }
  
  // すべての設定で失敗した場合
  throw lastError || new Error('All Gemini API configurations failed');
}