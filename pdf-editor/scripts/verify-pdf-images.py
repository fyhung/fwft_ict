from pathlib import Path
import numpy as np
from PIL import Image
from pypdf import PdfReader

root = Path('tmp/pdfs/layout-qa')
for rotation in (0, 90, 180, 270):
    reader = PdfReader(root / f'export-{rotation}.pdf')
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert page.get('/Rotate', 0) == rotation
    text = page.extract_text()
    assert '繁體中文' in text and 'English 123' in text, repr(text)
    fonts = [font.get_object() for font in page['/Resources']['/Font'].values()]
    assert any('PMingLiU' in str(font['/BaseFont']) for font in fonts)
    assert any('/FontFile2' in font['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object() for font in fonts)
    if rotation == 0:
        assert any('NotoSerifTC' in str(font['/BaseFont']) for font in fonts)
        assert b'3.5 Tf' in page.get_contents().get_data()
    a = np.asarray(Image.open(root / f'browser-{rotation}.png').convert('RGB'))
    b = np.asarray(Image.open(root / f'pdf-{rotation}.png').convert('RGB'))
    assert a.shape == b.shape, (a.shape, b.shape)
    for label, masks in (
        ('text', [(image[:, :, 2] > image[:, :, 0].astype(int) + 60) & (image[:, :, 2] > image[:, :, 1].astype(int) + 60) & (np.indices(image.shape[:2])[0] < 400) for image in (a, b)]),
        ('rectangle', [(image[:, :, 1] > image[:, :, 0].astype(int) + 60) & (image[:, :, 1] > image[:, :, 2].astype(int) + 60) for image in (a, b)]),
    ):
        boxes = []
        for mask in masks:
            y, x = np.where(mask)
            assert x.size
            boxes.append(np.array([x.min(), y.min(), x.max(), y.max()]))
        assert np.max(np.abs(boxes[0] - boxes[1])) <= 2, (rotation, label, boxes)
        # SVG and PDF canvas use different antialiasing. Require matching ink
        # within one pixel instead of requiring identical raster edge colors.
        def nearby(mask):
            padded = np.pad(mask, 1)
            return np.logical_or.reduce([padded[dy:dy + mask.shape[0], dx:dx + mask.shape[1]] for dy in range(3) for dx in range(3)])
        coverage = min((masks[0] & nearby(masks[1])).sum() / masks[0].sum(), (masks[1] & nearby(masks[0])).sum() / masks[1].sum())
        assert coverage > 0.95, (rotation, label, coverage)
        print(f'PASS {rotation} {label}: bounds {boxes[0].tolist()} vs {boxes[1].tolist()}, ink within 1px {coverage:.1%}')
    print(f'PASS {rotation}: searchable Traditional Chinese / English, actual embedded PMingLiU')
