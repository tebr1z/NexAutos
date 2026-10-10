Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconDir = Join-Path $root "extensions/autonex-bidcars-market/icons"
$storeDir = Join-Path $root "extensions/autonex-bidcars-market-store-assets"
$calculatorIconDir = Join-Path $root "extensions/autonex-bidcars/icons"
$calculatorStoreDir = Join-Path $root "extensions/autonex-bidcars-store-assets"
New-Item -ItemType Directory -Force -Path $iconDir, $storeDir, $calculatorIconDir, $calculatorStoreDir | Out-Null

function New-Icon([int]$size, [string]$path) {
  $bmp = [Drawing.Bitmap]::new($size, $size)
  $g = [Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
  $g.Clear([Drawing.Color]::FromArgb(7,20,38))
  $blue = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(36,99,235)); $mint = [Drawing.Pen]::new([Drawing.Color]::FromArgb(101,240,193), [Math]::Max(2,$size/24))
  $g.FillEllipse($blue, $size*.18, $size*.25, $size*.64, $size*.45)
  $g.FillRectangle($blue, $size*.16, $size*.48, $size*.68, $size*.22)
  $white = [Drawing.Pen]::new([Drawing.Color]::White, [Math]::Max(2,$size/18))
  $g.DrawEllipse($white, $size*.22, $size*.61, $size*.20, $size*.20); $g.DrawEllipse($white, $size*.58, $size*.61, $size*.20, $size*.20)
  $g.DrawLine($mint, $size*.28, $size*.30, $size*.40, $size*.16); $g.DrawLine($mint, $size*.40, $size*.16, $size*.51, $size*.30)
  $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png); $white.Dispose(); $mint.Dispose(); $blue.Dispose(); $g.Dispose(); $bmp.Dispose()
}

foreach ($size in 16,32,48,128) { New-Icon $size (Join-Path $iconDir "icon$size.png") }

function New-CalculatorIcon([int]$size, [string]$path) {
  $bmp = [Drawing.Bitmap]::new($size, $size); $g = [Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'; $g.Clear([Drawing.Color]::FromArgb(7,20,38))
  $blue=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(36,99,235)); $white=[Drawing.Pen]::new([Drawing.Color]::White,[Math]::Max(2,$size/18)); $mint=[Drawing.Pen]::new([Drawing.Color]::FromArgb(101,240,193),[Math]::Max(2,$size/20))
  $g.FillEllipse($blue,$size*.14,$size*.34,$size*.72,$size*.38); $g.FillRectangle($blue,$size*.12,$size*.52,$size*.76,$size*.18)
  $g.DrawEllipse($white,$size*.20,$size*.62,$size*.20,$size*.20); $g.DrawEllipse($white,$size*.60,$size*.62,$size*.20,$size*.20)
  $g.DrawLine($mint,$size*.61,$size*.22,$size*.88,$size*.22); $g.DrawLine($mint,$size*.745,$size*.085,$size*.745,$size*.355)
  $bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png); foreach($x in @($blue,$white,$mint,$g,$bmp)){$x.Dispose()}
}
foreach ($size in 16,32,48,128) { New-CalculatorIcon $size (Join-Path $calculatorIconDir "icon$size.png") }

function New-StoreImage([int]$width, [int]$height, [string]$path, [bool]$screenshot) {
  $bmp=[Drawing.Bitmap]::new($width,$height); $g=[Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode='AntiAlias'; $g.Clear([Drawing.Color]::FromArgb(7,20,38))
  $white=[Drawing.SolidBrush]::new([Drawing.Color]::White); $muted=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(157,183,216)); $blue=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(36,99,235)); $green=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(22,163,74))
  $title=[Drawing.Font]::new('Arial',[Math]::Max(22,$width/25),[Drawing.FontStyle]::Bold); $text=[Drawing.Font]::new('Arial',[Math]::Max(11,$width/70)); $big=[Drawing.Font]::new('Arial',[Math]::Max(20,$width/32),[Drawing.FontStyle]::Bold)
  $g.FillEllipse($blue, $width*.055, $height*.10, $height*.22, $height*.18)
  $carPen=[Drawing.Pen]::new([Drawing.Color]::White,[Math]::Max(3,$width/150)); $g.DrawArc($carPen,$width*.07,$height*.14,$height*.16,$height*.10,190,160); $g.DrawEllipse($carPen,$width*.078,$height*.21,$height*.035,$height*.035); $g.DrawEllipse($carPen,$width*.185,$height*.21,$height*.035,$height*.035)
  $g.DrawString('BidCars Market Analysis',$title,$white,$width*.055,$height*.36); $g.DrawString('Final sales - Trim - Baku delivery',$text,$muted,$width*.058,$height*.52)
  $g.FillRectangle($green,$width*.055,$height*.68,$width*.40,$height*.17); $g.DrawString('SEL - 2500 cc',$big,$white,$width*.075,$height*.70)
  $g.FillRectangle($blue,$width*.50,$height*.68,$width*.43,$height*.17); $g.DrawString('$4,250-$5,600',$big,$white,$width*.52,$height*.70)
  $bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png); foreach($x in @($title,$text,$big,$white,$muted,$blue,$green,$carPen,$g,$bmp)){$x.Dispose()}
}

New-StoreImage 440 280 (Join-Path $storeDir 'small-promo-440x280.png') $false
New-StoreImage 1280 800 (Join-Path $storeDir 'screenshot-1280x800.png') $true

function New-CalculatorStoreImage([int]$width,[int]$height,[string]$path) {
  $bmp=[Drawing.Bitmap]::new($width,$height); $g=[Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode='AntiAlias'; $g.Clear([Drawing.Color]::FromArgb(7,20,38))
  $white=[Drawing.SolidBrush]::new([Drawing.Color]::White); $muted=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(157,183,216)); $blue=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(36,99,235)); $green=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(22,163,74))
  $title=[Drawing.Font]::new('Arial',[Math]::Max(22,$width/25),[Drawing.FontStyle]::Bold); $text=[Drawing.Font]::new('Arial',[Math]::Max(11,$width/70)); $big=[Drawing.Font]::new('Arial',[Math]::Max(19,$width/34),[Drawing.FontStyle]::Bold)
  $g.FillEllipse($blue,$width*.055,$height*.10,$height*.20,$height*.20); $g.DrawString('+',$big,$white,$width*.095,$height*.10)
  $g.DrawString('BidCars Final Price',$title,$white,$width*.055,$height*.36); $g.DrawString('Auction fee - Shipping - Customs',$text,$muted,$width*.058,$height*.52)
  $g.FillRectangle($blue,$width*.055,$height*.68,$width*.40,$height*.17); $g.DrawString('$4,850 + fees',$big,$white,$width*.075,$height*.70)
  $g.FillRectangle($green,$width*.50,$height*.68,$width*.43,$height*.17); $g.DrawString('14,600 AZN',$big,$white,$width*.52,$height*.70)
  $bmp.Save($path,[Drawing.Imaging.ImageFormat]::Png); foreach($x in @($title,$text,$big,$white,$muted,$blue,$green,$g,$bmp)){$x.Dispose()}
}
New-CalculatorStoreImage 440 280 (Join-Path $calculatorStoreDir 'small-promo-440x280.png')
New-CalculatorStoreImage 1280 800 (Join-Path $calculatorStoreDir 'screenshot-1280x800.png')
