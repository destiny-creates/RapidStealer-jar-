
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing


$form = New-Object System.Windows.Forms.Form
$form.Text = ""
$form.Size = New-Object System.Drawing.Size(700, 400)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "None"
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 20, 30)
$form.TopMost = $false
$form.ShowInTaskbar = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = "Setup Assistant"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 32, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::White
$title.Size = New-Object System.Drawing.Size(700, 50)
$title.Location = New-Object System.Drawing.Point(0, 40)
$title.TextAlign = "MiddleCenter"
$form.Controls.Add($title)


$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = "This process will only take 1-2 minutes"
$subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 12)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(136, 136, 136)
$subtitle.Size = New-Object System.Drawing.Size(700, 30)
$subtitle.Location = New-Object System.Drawing.Point(0, 95)
$subtitle.TextAlign = "MiddleCenter"
$form.Controls.Add($subtitle)


$logo = New-Object System.Windows.Forms.PictureBox
$logo.Size = New-Object System.Drawing.Size(150, 150)
$logo.Location = New-Object System.Drawing.Point(275, 140)
$logo.BackColor = [System.Drawing.Color]::Transparent
$form.Controls.Add($logo)


$logoBmp = New-Object System.Drawing.Bitmap(150, 150)
$logoG = [System.Drawing.Graphics]::FromImage($logoBmp)
$logoG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$logoG.Clear([System.Drawing.Color]::Transparent)


$brush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 204, 0))
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 255, 204))


$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 255, 204), 4)
$logoG.DrawEllipse($pen, 25, 25, 100, 100)


$logoG.FillRectangle($brush1, 60, 60, 30, 30)
$logoG.FillRectangle($brush2, 50, 70, 10, 10)
$logoG.FillRectangle($brush2, 90, 70, 10, 10)
$logoG.FillRectangle($brush2, 70, 50, 10, 10)
$logoG.FillRectangle($brush2, 70, 90, 10, 10)


$glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 0, 255, 204), 8)
$logoG.DrawEllipse($glowPen, 20, 20, 110, 110)

$logo.Image = $logoBmp
$logoG.Dispose()
$pen.Dispose()
$glowPen.Dispose()
$brush1.Dispose()
$brush2.Dispose()


$spinner = New-Object System.Windows.Forms.PictureBox
$spinner.Size = New-Object System.Drawing.Size(120, 120)
$spinner.Location = New-Object System.Drawing.Point(290, 150)
$spinner.BackColor = [System.Drawing.Color]::Transparent
$spinner.Visible = $false
$form.Controls.Add($spinner)

$angle = 0
$angle2 = 180
$pulseValue = 0
$spinnerTimer = New-Object System.Windows.Forms.Timer
$spinnerTimer.Interval = 30
$spinnerTimer.Add_Tick({
    $script:angle = ($script:angle + 8) % 360
    $script:angle2 = ($script:angle2 - 12) % 360
    $script:pulseValue = ($script:pulseValue + 0.1) % 6.28
    
    $bmp = New-Object System.Drawing.Bitmap(120, 120)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $pulse = [Math]::Sin($script:pulseValue) * 3 + 3
    
    $pen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 255, 204), (7 + $pulse))
    $pen1.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($pen1, 15, 15, 90, 90, $script:angle, 280)
    
    $pen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 136, 255), 5)
    $pen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($pen2, 25, 25, 70, 70, $script:angle2, 200)
    
    $pen3 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(100, 255, 255), 3)
    $pen3.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen3.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($pen3, 35, 35, 50, 50, $script:angle, 150)
    
    $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 0, 255, 204), 15)
    $glowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $glowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($glowPen, 10, 10, 100, 100, $script:angle, 280)
    
    $spinner.Image = $bmp
    $g.Dispose()
    $pen1.Dispose()
    $pen2.Dispose()
    $pen3.Dispose()
    $glowPen.Dispose()
})


$statusText = New-Object System.Windows.Forms.Label
$statusText.Text = "Preparing installation..."
$statusText.Font = New-Object System.Drawing.Font("Consolas", 11)
$statusText.ForeColor = [System.Drawing.Color]::FromArgb(0, 255, 204)
$statusText.Size = New-Object System.Drawing.Size(700, 25)
$statusText.Location = New-Object System.Drawing.Point(0, 290)
$statusText.TextAlign = "MiddleCenter"
$statusText.Visible = $false
$form.Controls.Add($statusText)


$progressBg = New-Object System.Windows.Forms.Panel
$progressBg.Size = New-Object System.Drawing.Size(600, 12)
$progressBg.Location = New-Object System.Drawing.Point(50, 340)
$progressBg.BackColor = [System.Drawing.Color]::Black
$progressBg.Visible = $false
$form.Controls.Add($progressBg)


$progressBar = New-Object System.Windows.Forms.Panel
$progressBar.Size = New-Object System.Drawing.Size(0, 12)
$progressBar.Location = New-Object System.Drawing.Point(0, 0)
$progressBar.BackColor = [System.Drawing.Color]::FromArgb(0, 255, 204)
$progressBg.Controls.Add($progressBar)


$percentage = New-Object System.Windows.Forms.Label
$percentage.Text = "0%"
$percentage.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$percentage.ForeColor = [System.Drawing.Color]::FromArgb(0, 255, 204)
$percentage.Size = New-Object System.Drawing.Size(700, 35)
$percentage.Location = New-Object System.Drawing.Point(0, 370)
$percentage.TextAlign = "MiddleCenter"
$percentage.Visible = $false
$form.Controls.Add($percentage)


$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "CONTINUE"
$btnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnInstall.Size = New-Object System.Drawing.Size(150, 40)
$btnInstall.Location = New-Object System.Drawing.Point(275, 310)
$btnInstall.FlatStyle = "Flat"
$btnInstall.FlatAppearance.BorderSize = 0
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(255, 204, 0)
$btnInstall.ForeColor = [System.Drawing.Color]::Black
$btnInstall.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnInstall)


$messages = @(
    "Preparing installation...",
    "System compatibility is being checking...",
    "Optimization is being performing...",
    "Little left for installation...",
    "Finalizing...",
    "COMPLETE!"
)


$script:progressValue = 0
$script:currentMsgIndex = 0
$script:installStartTime = $null


$progressTimer = New-Object System.Windows.Forms.Timer
$progressTimer.Interval = 100
$progressTimer.Add_Tick({
    if ($script:installStartTime -ne $null) {
        $elapsed = ([DateTime]::Now - $script:installStartTime).TotalSeconds
        $script:progressValue = [Math]::Min(100, ($elapsed / 90) * 100)
        
        $newWidth = [int](($script:progressValue / 100) * 600)
        $progressBar.Width = $newWidth
        
        $percentage.Text = [Math]::Floor($script:progressValue).ToString() + "%" # L R X
        
        $msgIndex = [Math]::Floor($script:progressValue / 20)
        if ($msgIndex -lt $messages.Length -and $msgIndex -ne $script:currentMsgIndex) {
            $script:currentMsgIndex = $msgIndex
            $statusText.Text = $messages[$msgIndex]
        }
        
        if ($script:progressValue -ge 100) {
            $progressBar.Width = 600
            $percentage.Text = "100%"
            $statusText.Text = "COMPLETE!"
            
            $btnPlay = New-Object System.Windows.Forms.Button
            $btnPlay.Text = "OK"
            $btnPlay.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
            $btnPlay.Size = New-Object System.Drawing.Size(130, 40)
            $btnPlay.Location = New-Object System.Drawing.Point(285, 430)
            $btnPlay.FlatStyle = "Flat"
            $btnPlay.FlatAppearance.BorderSize = 0
            $btnPlay.BackColor = [System.Drawing.Color]::FromArgb(255, 204, 0)
            $btnPlay.ForeColor = [System.Drawing.Color]::Black
            $btnPlay.Cursor = [System.Windows.Forms.Cursors]::Hand
            $btnPlay.Add_Click({ $form.Close() })
            $form.Controls.Add($btnPlay)
            
            $progressTimer.Stop()
            $spinnerTimer.Stop()
        }
    }
})


$btnInstall.Add_Click({
    $form.Size = New-Object System.Drawing.Size(700, 500)
    $form.Location = New-Object System.Drawing.Point(
        ($form.Location.X),
        ($form.Location.Y - 50)
    )
    
    $btnInstall.Visible = $false
    $logo.Visible = $false
    
    $spinner.Visible = $true
    $statusText.Visible = $true
    $progressBg.Visible = $true
    $percentage.Visible = $true
    
    $script:installStartTime = [DateTime]::Now
    $script:progressValue = 0
    $script:currentMsgIndex = 0
    
    $spinnerTimer.Start()
    $progressTimer.Start()
})


$isDragging = $false
$dragStartX = 0
$dragStartY = 0

$form.Add_MouseDown({
    param($sender, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
        $script:isDragging = $true
        $script:dragStartX = $e.X
        $script:dragStartY = $e.Y
    }
})

$form.Add_MouseMove({
    param($sender, $e)
    if ($script:isDragging) {
        $newX = $form.Location.X + ($e.X - $script:dragStartX)
        $newY = $form.Location.Y + ($e.Y - $script:dragStartY)
        $form.Location = New-Object System.Drawing.Point($newX, $newY)
    }
})

$form.Add_MouseUp({
    $script:isDragging = $false
})

[void]$form.ShowDialog()