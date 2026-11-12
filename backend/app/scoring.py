import re
import unicodedata
from difflib import SequenceMatcher

def words(text):
    return re.findall(r'[^\W_]+', unicodedata.normalize('NFC', text), re.UNICODE)

def normalize(text):
    # Preserve ñ: año and ano are different Spanish words.
    return ''.join(c for c in unicodedata.normalize('NFD', unicodedata.normalize('NFC', text).lower().replace('ñ', '\ue000'))
                   if unicodedata.category(c) != 'Mn').replace('\ue000', 'ñ')

def evaluate(reference, transcript):
    expected, spoken = words(reference), words(transcript)
    a, b = list(map(normalize, expected)), list(map(normalize, spoken))
    tokens = [dict(text=w, originalText=w, status='missing', explanation='未读出该单词') for w in expected]
    matched = 0
    for tag, i, j, k, l in SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal':
            for offset in range(j-i):
                tokens[i+offset] = dict(text=expected[i+offset], originalText=expected[i+offset], status='correct', userWord=spoken[k+offset])
                matched += 1
        elif tag == 'replace':
            for x, y in zip(range(i, j), range(k, l)):
                tokens[x].update(status='mispronounced', userWord=spoken[y], explanation='识别词与目标词不同')
    score = round(100 * matched / max(len(a), len(b), 1))
    return dict(score=score, isPassed=score >= 75, diffTokens=tokens, rawSpoken=transcript,
                normalizedSpoken=' '.join(b), matchedCount=matched, totalWords=len(a),
                encouragement='表达完整，继续保持！' if score >= 75 else '请参考标记，再试一次。')
