import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGeminiResponse } from '$lib/server/gemini';
import { shiritoriWords, addWordToDictionary } from '$lib/wordList';

export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('Shiritori API called');
    const { lastCharacter, usedWords = [] } = await request.json();
    console.log('Last character received:', lastCharacter);
    console.log('Used words received:', usedWords);
    const lowerLastChar = lastCharacter.toLowerCase();

    if (!lastCharacter) {
      return json({ error: 'Last character is required' }, { status: 400 });
    }

    // 1. wordList優先: ローカルの単語リストから探す（使用済み単語を除外）
    if (shiritoriWords[lowerLastChar] && shiritoriWords[lowerLastChar].length > 0) {
      const localWords = shiritoriWords[lowerLastChar];
      // 使用済み単語を除外してフィルタリング
      const availableWords = localWords.filter(word => 
        !usedWords.includes(word.toLowerCase())
      );
      
      if (availableWords.length > 0) {
        // 利用可能な単語からランダムに選択
        const answer = availableWords[Math.floor(Math.random() * availableWords.length)];
        
        console.log(`Found word in local dictionary (excluding used words): ${answer}`);
        return json({ answer: answer });
      } else {
        console.log(`All words for "${lowerLastChar}" are already used. Falling back to Gemini API.`);
      }
    } else {
      console.log(`No words found for "${lowerLastChar}" in local dictionary. Falling back to Gemini API.`);
    }

    // 2. Geminiフォールバック: ローカルに使用可能な単語がない場合、Gemini APIを呼び出す
    // 使用済み単語をプロンプトに含めて除外指示を追加
    const excludeInstruction = usedWords.length > 0 
      ? `\n- Do NOT use any of these already used words: ${usedWords.join(', ')}`
      : '';

    const prompt = `Please provide one English word that starts with the letter "${lastCharacter}".
        The word should meet the following criteria:
        - A concrete object, animal, or living thing (not emotions or abstract concepts)
        - Something that is easy to visualize when looking at an image
        - Answer in lowercase English only
        - Provide only the word, no explanations needed${excludeInstruction}

        Example: If the letter is "a" → apple, ant, airplane, etc.`;

    console.log('Calling Gemini API...');
    const response = await getGeminiResponse(prompt);
    console.log('Raw Gemini response received (length:', response.length, 'chars)');
    
    // 3. 辞書への追加: Geminiで取得した単語をクレンジング
    const cleanedResponse = response.trim()
      .replace(/[.,!?\n\r"']/g, '')  // 句読点や引用符を削除
      .toLowerCase()  // 小文字に変換
      .split(' ')[0];  // 最初の単語のみ取得

    console.log('Cleaned Gemini response:', cleanedResponse);
    
    // 使用済み単語と重複していないかチェック
    if (usedWords.includes(cleanedResponse)) {
      console.warn('Gemini returned a used word, returning it anyway:', cleanedResponse);
    }
    
    // 辞書にGeminiで取得した単語を追加（メモリ上で更新）
    if (cleanedResponse && cleanedResponse.length > 0) {
      addWordToDictionary(lowerLastChar, cleanedResponse);
    }
    
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
