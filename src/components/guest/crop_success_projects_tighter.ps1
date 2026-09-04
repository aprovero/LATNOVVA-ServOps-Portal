Add-Type -AssemblyName System.Drawing

function Crop-HexagonImageTighter ($srcPath, $destPath) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
    
    $w = $bmp.Width
    $h = $bmp.Height
    
    # Crop a tighter area from the exact center to guarantee no green border corners are left
    $cropX = [int]($w * 0.25)
    $cropY = [int]($h * 0.22)
    $cropW = [int]($w * 0.50)
    $cropH = [int]($h * 0.56)
    
    $rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
    $cropped = $bmp.Clone($rect, $bmp.PixelFormat)
    
    $cropped.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $bmp.Dispose()
    $cropped.Dispose()
    Write-Host "Tighter cropped $srcPath -> $destPath"
}

Crop-HexagonImageTighter "public\New folder\success\pachamama.png" "public\latnovva-esp\success_pachamama.png"
Crop-HexagonImageTighter "public\New folder\success\patria.png" "public\latnovva-esp\success_patria.png"
Crop-HexagonImageTighter "public\New folder\success\yutong.png" "public\latnovva-esp\success_yutong.png"
