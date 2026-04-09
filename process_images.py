from PIL import Image

def remove_white_bg(input_path, output_path, tolerance=240):
    img = Image.open(input_path).convert('RGBA')
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Check if the pixel is white-ish (R, G, B > tolerance)
        if item[0] > tolerance and item[1] > tolerance and item[2] > tolerance:
            new_data.append((255, 255, 255, 0)) # Fully transparent
        else:
            new_data.append(item) # Keep original pixel
            
    img.putdata(new_data)
    img.save(output_path)

remove_white_bg('public/APROVERO_LOGO.png', 'public/APROVERO_LOGO.png')
remove_white_bg('public/cor-logo.png', 'public/cor-logo.png')
print('Images processed successfully.')
