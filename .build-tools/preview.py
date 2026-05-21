from PIL import Image
img = Image.open(r'D:\momentum-creation-system-v1\apps\com\public\og\all-things-glp-three.png')
img.thumbnail((600, 315), Image.LANCZOS)
img.save(r'D:\momentum-creation-system-v1\.build-tools\og-preview.png', 'PNG')
import base64
with open(r'D:\momentum-creation-system-v1\.build-tools\og-preview.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')
print('SIZE', len(b64))
# Print in chunks
for i in range(0, len(b64), 1000):
    print('CHUNK', i//1000, b64[i:i+1000])
