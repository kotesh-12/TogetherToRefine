Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\hp\.vscode\TogetherToRefine\public\raw_logo.png"

function Create-SquareIcon {
    param (
        [string]$outputPath,
        [int]$size
    )

    try {
        $sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
        $squareImage = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($squareImage)

        # High quality settings
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        # Fill white background
        $graphics.Clear([System.Drawing.Color]::White)

        # Calculate aspect ratio
        $ratioX = ($size - 40) / $sourceImage.Width
        $ratioY = ($size - 40) / $sourceImage.Height
        $ratio = [Math]::Min($ratioX, $ratioY)

        $newWidth = [int]($sourceImage.Width * $ratio)
        $newHeight = [int]($sourceImage.Height * $ratio)

        $x = [int](($size - $newWidth) / 2)
        $y = [int](($size - $newHeight) / 2)

        $graphics.DrawImage($sourceImage, $x, $y, $newWidth, $newHeight)

        $squareImage.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        Write-Host "Created $outputPath"
    }
    catch {
        Write-Error "Failed to process $outputPath : $_"
    }
    finally {
        if ($graphics) { $graphics.Dispose() }
        if ($squareImage) { $squareImage.Dispose() }
        if ($sourceImage) { $sourceImage.Dispose() }
    }
}

Create-SquareIcon "c:\Users\hp\.vscode\TogetherToRefine\public\pwa-512x512.png" 512
Create-SquareIcon "c:\Users\hp\.vscode\TogetherToRefine\public\pwa-192x192.png" 192
