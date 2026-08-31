from pathlib import Path
from pypdf import PdfReader
import sys
for path in Path('data/sources').glob('*.pdf'):
    try:
        pages=PdfReader(str(path)).pages
        text='\n\n'.join(f'=== PDF PAGE {i+1} ===\n{p.extract_text()}' for i,p in enumerate(pages))
        path.with_suffix('.txt').write_text(text, encoding='utf8')
        print(path.name, len(pages), 'pages')
    except Exception as e: print(path.name,str(e))
