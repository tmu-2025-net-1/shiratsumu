import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGeminiResponse } from '$lib/server/gemini';
import { shiritoriWords } from '$lib/wordList'; // 作成した単語リストをインポート

export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('Shiritori API called');
    const { lastCharacter } = await request.json();
    console.log('Last character received:', lastCharacter);
    const lowerLastChar = lastCharacter.toLowerCase();

    if (!lastCharacter) {
      return json({ error: 'Last character is required' }, { status: 400 });
    }


    // 1. まずローカルの単語リストから探す
    if (shiritoriWords[lowerLastChar] && shiritoriWords[lowerLastChar].length > 0) {
      const localWords = shiritoriWords[lowerLastChar];
      // リストからランダムに単語を一つ選ぶ
      const answer = localWords[Math.floor(Math.random() * localWords.length)];
      
      console.log('Found word in local list:', answer);
      return json({ answer: answer });
    }

    // しりとりプロンプトを作成
    const prompt = `Please provide one English word that starts with the letter "${lastCharacter}".
        The word should meet the following criteria:
        - A concrete object, animal, or living thing (not emotions or abstract concepts)
        - Something that is easy to visualize when looking at an image
        - Answer in lowercase English only
        - Provide only the word, no explanations needed

        Example: If the letter is "a" → apple, ant, airplane, etc.`;

    console.log('Calling Gemini API...');
    const response = await getGeminiResponse(prompt);
    console.log('Raw Gemini response:', response);
    
    // レスポンスをクリーンアップ（余分な文字や改行を削除し、小文字に変換）
    const cleanedResponse = response.trim()
      .replace(/[.,!?\n\r"']/g, '')  // 句読点や引用符を削除
      .toLowerCase()  // 小文字に変換
      .split(' ')[0];  // 最初の単語のみ取得

    console.log('Cleaned response:', cleanedResponse);
    return json({ answer: cleanedResponse });

  } catch (error) {
    console.error('Shiritori API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return json({ 
      error: 'Failed to generate shiritori response', 
      details: errorMessage 
    }, { status: 500 });
  }
};
