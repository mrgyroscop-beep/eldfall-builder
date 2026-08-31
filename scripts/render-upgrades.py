import pymupdf
from PIL import Image, ImageDraw
doc=pymupdf.open('data/sources/upgrades.pdf')
sheet=Image.new('RGB',(1400,8*290),'#eeeeee')
draw=ImageDraw.Draw(sheet)
for i,p in enumerate(doc):
    pix=p.get_pixmap(matrix=pymupdf.Matrix(1,1))
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    im.thumbnail((194,264))
    x=(i%7)*200; y=(i//7)*290
    sheet.paste(im,(x,y));draw.text((x+5,y+265),str(i+1),fill='black')
sheet.save('data/sources/upgrades-contact.png')
