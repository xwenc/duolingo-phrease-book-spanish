from app.scoring import evaluate, normalize, words


def test_composed_and_decomposed_enye_are_the_same_letter():
    for text in ['año', 'an\u0303o', 'AÑO', 'AN\u0303O']:
        assert normalize(text) == 'año'
        assert len(words(text)) == 1
        assert evaluate('año', text)['score'] == 100
    assert evaluate('España mañana', 'Espan\u0303a man\u0303ana')['score'] == 100


def test_enye_and_n_remain_different():
    assert evaluate('año', 'ano')['score'] == 0
    assert evaluate('niño', 'nino')['score'] == 0
    assert normalize('áéíóú ü Ñ') == 'aeiou u ñ'
