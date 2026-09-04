Add-Type -AssemblyName System.Drawing

function Crop-HexagonImage ($srcPath, $destPath) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
    
    # The hexagon is centered. Let's crop the inner rectangular region.
    # Total width and height:
    $w = $bmp.Width
    $h = $bmp.Height
    
    # Calculate crop region (taking the central square/rectangle inside the hexagon)
    $cropX = [int]($w * 0.20)
    $cropY = [int]($h * 0.15)
    $cropW = [int]($w * 0.60)
    $cropH = [int]($h * 0.70)
    
    $rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $cropped = $bmp.Clone($rect, $bmp.PixelFormat)
    
    # Save the cropped image as PNG
    $cropped.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Clean up
    $bmp.Dispose()
    $cropped.Dispose()
    Write-Host "Cropped $srcPath -> $destPath"
}

# Run cropping
Crop-HexagonImage "public\New folder\success\pachamama.png" "public\latnovva-esp\success_pachamama.png"
Crop-HexagonImage "public\New folder\success\patria.png" "public\latnovva-esp\success_patria.png"
Crop-HexagonImage "public\New folder\success\yutong.png" "public\latnovva-esp\success_yutong.png"
