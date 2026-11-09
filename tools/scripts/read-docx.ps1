Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-DocxText($filePath) {
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($filePath)
        $entry = $zip.GetEntry('word/document.xml')
        if ($entry) {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $xml = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            $zip.Dispose()
            $clean = $xml -replace '<w:p[ >]', "`n" -replace '<[^>]+>', ''
            return $clean
        }
        $zip.Dispose()
    } catch {
        return "Erro ao ler: " + $_.Exception.Message
    }
    return ''
}

$files = @(
    'D:\TalesMods\鬼谷八荒MOD使用指南基础版 1.0\鬼谷八荒MOD使用指南基础版 1.0.docx',
    'D:\TalesMods\配置修改教程\配置修改教程.docx',
    'D:\TalesMods\资源修改教程\资源修改教程.docx',
    'D:\TalesMods\代码编写教程\代码编写教程.docx'
)

foreach ($f in $files) {
    Write-Host "====================================================="
    Write-Host $f
    Write-Host "====================================================="
    $text = Get-DocxText $f
    if ($text.Length -gt 1500) {
        Write-Host $text.Substring(0, 1500)
    } else {
        Write-Host $text
    }
}
