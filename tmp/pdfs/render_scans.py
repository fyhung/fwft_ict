from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageDraw
out=Path('tmp/pdfs'); out.mkdir(parents=True,exist_ok=True)
for file in sorted(Path('DSE PR Qns').glob('*.pdf')):
    pdf=pdfium.PdfDocument(file)
    thumbs=[]
    for i,page in enumerate(pdf):
        im=page.render(scale=1.5).to_pil().convert('RGB')
        im.save(out/f'{file.stem}-{i+1}.png')
        im.thumbnail((650,900))
        tile=Image.new('RGB',(670,940),'#dddddd');tile.paste(im,((670-im.width)//2,30));ImageDraw.Draw(tile).text((10,8),f'{file.stem} PDF page {i+1}',fill='black');thumbs.append(tile)
    for start in range(0,len(thumbs),6):
        sheet=Image.new('RGB',(2010,1880),'white')
        for j,im in enumerate(thumbs[start:start+6]):sheet.paste(im,((j%3)*670,(j//3)*940))
        sheet.save(out/f'{file.stem}-sheet-{start//6+1}.png')
print('rendered all pages')
