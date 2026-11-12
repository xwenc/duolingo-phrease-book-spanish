/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiffToken, EvaluationResult } from '../types';

/**
 * 西班牙语字符串归一化：
 * 1. 去除元音重音，保留 ñ 与 n 的区别，兼容组合编码
 * 2. 移除西语标点符号（¿, ?, ¡, !, ., ,, ;, :, ", ', - 等）
 * 3. 统一转为小写并去除冗余空白
 */
export function normalizeSpanish(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/n\u0303/g, 'ñ') // Preserve the Spanish letter before removing accent marks.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:"'()[\]{}—–\-_\/\\*&^%$#@~`+=]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 计算两个单词的编辑距离 (Levenshtein Distance)
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * 判断两个西语单词是否语义/发音等价（容忍西语口语微弱音节吞音或重音识别轻微抖动）
 */
function isWordMatch(standard: string, spoken: string): { isMatch: boolean; isClose: boolean } {
  const normStd = normalizeSpanish(standard);
  const normSpk = normalizeSpanish(spoken);

  if (normStd === normSpk) {
    return { isMatch: true, isClose: false };
  }

  // ñ and n are different letters; do not accept this as a fuzzy match.
  const stdSimple = normStd.replace(/ñ/g, 'n');
  const spkSimple = normSpk.replace(/ñ/g, 'n');
  if (stdSimple === spkSimple) {
    return { isMatch: false, isClose: false };
  }

  // 短词 (<= 3 字母) 必须严格匹配
  if (normStd.length <= 3) {
    return { isMatch: false, isClose: false };
  }

  const dist = levenshteinDistance(normStd, normSpk);
  // 长度 >= 4 容许 1 个编辑距离（如 gracias vs grasia, estacion vs estasion）
  if (dist === 1 && normStd.length >= 4) {
    return { isMatch: true, isClose: true };
  }

  // 长词 (>= 8 字母) 容许 2 个轻微编辑距离
  if (dist <= 2 && normStd.length >= 8) {
    return { isMatch: true, isClose: true };
  }

  return { isMatch: false, isClose: false };
}

/**
 * 逐词比对算法 (Token-level Diff Alignment)
 * 将标准西语句子与用户录音转写的句子进行对齐，精确标记每一个单词的状态：
 * - correct: 发音正确匹配
 * - missing: 遗漏未读
 * - mispronounced: 发音偏差或误读为其他词
 */
export function evaluateSpokenSpanish(
  standardSentence: string,
  userTranscript: string
): EvaluationResult {
  // 1. 分解标准句中的词汇与标点
  // 匹配西语词汇（包含重音字母和 ñ）
  const standardWordsRaw = standardSentence.match(/[\p{L}\p{M}\d]+/gu) || [];
  const spokenWordsRaw = userTranscript.match(/[\p{L}\p{M}\d]+/gu) || [];

  const n = standardWordsRaw.length;
  const m = spokenWordsRaw.length;

  if (n === 0) {
    return {
      score: 0,
      isPassed: false,
      diffTokens: [],
      rawSpoken: userTranscript,
      normalizedSpoken: normalizeSpanish(userTranscript),
      matchedCount: 0,
      totalWords: 0,
      encouragement: '未检测到题目内容',
    };
  }

  // 动态规划求解最优词汇对齐
  // dp[i][j] 表示 standardWords[0..i-1] 与 spokenWords[0..j-1] 的最大匹配得分
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const backtrack: Array<Array<'diag' | 'up' | 'left'>> = Array.from(
    { length: n + 1 },
    () => Array(m + 1).fill('up')
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const stdWord = standardWordsRaw[i - 1];
      const spkWord = spokenWordsRaw[j - 1];
      const { isMatch, isClose } = isWordMatch(stdWord, spkWord);

      let matchScore = 0;
      if (isMatch) {
        matchScore = isClose ? 8 : 10;
      } else {
        matchScore = -2;
      }

      const scoreDiag = dp[i - 1][j - 1] + matchScore;
      const scoreUp = dp[i - 1][j] - 4; // 漏词惩罚
      const scoreLeft = dp[i][j - 1] - 3; // 多词惩罚

      if (scoreDiag >= scoreUp && scoreDiag >= scoreLeft) {
        dp[i][j] = scoreDiag;
        backtrack[i][j] = 'diag';
      } else if (scoreUp >= scoreLeft) {
        dp[i][j] = scoreUp;
        backtrack[i][j] = 'up';
      } else {
        dp[i][j] = scoreLeft;
        backtrack[i][j] = 'left';
      }
    }
  }

  // 回溯构建对齐结果
  let currI = n;
  let currJ = m;
  const alignments: { stdIndex: number | null; spkIndex: number | null }[] = [];

  while (currI > 0 || currJ > 0) {
    if (currI > 0 && currJ > 0 && backtrack[currI][currJ] === 'diag') {
      alignments.unshift({ stdIndex: currI - 1, spkIndex: currJ - 1 });
      currI--;
      currJ--;
    } else if (currI > 0 && (currJ === 0 || backtrack[currI][currJ] === 'up')) {
      alignments.unshift({ stdIndex: currI - 1, spkIndex: null });
      currI--;
    } else {
      alignments.unshift({ stdIndex: null, spkIndex: currJ - 1 });
      currJ--;
    }
  }

  const diffTokens: DiffToken[] = [];
  let matchedCount = 0;

  // 将对齐映射转换为最终的 Tokens
  for (let i = 0; i < n; i++) {
    const originalText = standardWordsRaw[i];
    const alignment = alignments.find((a) => a.stdIndex === i);

    if (alignment && alignment.spkIndex !== null) {
      const userSpokenWord = spokenWordsRaw[alignment.spkIndex];
      const { isMatch } = isWordMatch(originalText, userSpokenWord);

      if (isMatch) {
        matchedCount++;
        diffTokens.push({
          text: originalText,
          originalText,
          status: 'correct',
          userWord: userSpokenWord,
        });
      } else {
        diffTokens.push({
          text: originalText,
          originalText,
          status: 'mispronounced',
          userWord: userSpokenWord,
          explanation: `识别为: "${userSpokenWord}"`,
        });
      }
    } else {
      // 未匹配到用户口述
      diffTokens.push({
        text: originalText,
        originalText,
        status: 'missing',
        explanation: '未读出该单词',
      });
    }
  }

  const rawRatio = matchedCount / n;
  const score = Math.round(rawRatio * 100);

  // 判定是否通过：命中率 >= 75%
  const isPassed = score >= 75;

  let encouragement = '';
  if (score === 100) {
    encouragement = '太棒了！发音极其地道！🎉';
  } else if (score >= 85) {
    encouragement = '非常出色！口音非常清晰自然！✨';
  } else if (score >= 75) {
    encouragement = '顺利通过！表达完整，继续保持！💪';
  } else if (score >= 50) {
    encouragement = '差一点点！注意红色标记的发音细节。';
  } else if (userTranscript.trim().length === 0) {
    encouragement = '未检测到声音，请按住麦克风大声朗读。';
  } else {
    encouragement = '别灰心！点击小喇叭或乌龟慢速再听一遍！';
  }

  return {
    score,
    isPassed,
    diffTokens,
    rawSpoken: userTranscript,
    normalizedSpoken: normalizeSpanish(userTranscript),
    matchedCount,
    totalWords: n,
    encouragement,
  };
}
