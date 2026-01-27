"""OCR corrections for Danish text."""

DANISH_OCR_CORRECTIONS = {
    'abler': 'æbler',
    'ablekompot': 'æblekompot',
    'ablemost': 'æblemost',
    'zbler': 'æbler',
    'hvidlog': 'hvidløg',
    'hvidlgg': 'hvidløg',
    'smgr': 'smør',
    'smor': 'smør',
    'sennepsfro': 'sennepsfrø',
    'rode': 'røde',
    'gronne': 'grønne',
    'koldroget': 'koldrøget',
    'flode': 'fløde',
    'rodbede': 'rødbede',
    'radbede': 'rødbede',
    'croutons': 'crôutons',
    'crotitons': 'crôutons',
    'veloute': 'velouté',
    'creme brulee': 'crème brûlée',
    'a la carte': 'à la carte',
}


def apply_ocr_corrections(text: str) -> str:
    """Apply Danish OCR corrections to text."""
    corrected = text
    for wrong, right in sorted(DANISH_OCR_CORRECTIONS.items(), 
                               key=lambda x: len(x[0]), reverse=True):
        corrected = corrected.replace(wrong, right)
    return corrected
