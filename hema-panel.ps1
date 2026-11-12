Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$created=$false
$panelMutex=[System.Threading.Mutex]::new($true,'Local\HemaDesktopControlPanel',[ref]$created)
if (-not $created) { $panelMutex.Dispose(); return }
[System.Windows.Forms.Application]::EnableVisualStyles()
$script:busy=$false
$form=New-Object System.Windows.Forms.Form
$form.Text='盒马电脑端助手'
$form.Size=New-Object System.Drawing.Size(540,365)
$form.StartPosition='CenterScreen'
$form.Font=New-Object System.Drawing.Font('Microsoft YaHei UI',10)
$form.FormBorderStyle='FixedDialog'
$form.MaximizeBox=$false
$status=New-Object System.Windows.Forms.Label
$status.Location=New-Object System.Drawing.Point(20,20)
$status.Size=New-Object System.Drawing.Size(490,65)
$status.Font=New-Object System.Drawing.Font('Microsoft YaHei UI',12)
$form.Controls.Add($status)
$help=New-Object System.Windows.Forms.Label
$help.Location=New-Object System.Drawing.Point(20,95)
$help.Size=New-Object System.Drawing.Size(490,110)
$help.Text=@'
使用步骤：
1. 登录微信，进入“发现 → 小程序”列表。
2. 点击下方“启动/修复”，然后进入鲜生或 NB。
3. 若仍被挡住，点右上角“…”→“重新进入小程序”。
鲜生与 NB 一次只开一个；切换时用圆形按钮关闭。
'@
$form.Controls.Add($help)
$start=New-Object System.Windows.Forms.Button
$start.Text='启动 / 修复'
$start.Location=New-Object System.Drawing.Point(20,220)
$start.Size=New-Object System.Drawing.Size(150,40)
$stop=New-Object System.Windows.Forms.Button
$stop.Text='停止辅助'
$stop.Location=New-Object System.Drawing.Point(185,220)
$stop.Size=New-Object System.Drawing.Size(130,40)
$logs=New-Object System.Windows.Forms.Button
$logs.Text='打开日志目录'
$logs.Location=New-Object System.Drawing.Point(330,220)
$logs.Size=New-Object System.Drawing.Size(170,40)
$note=New-Object System.Windows.Forms.Label
$note.Location=New-Object System.Drawing.Point(20,275)
$note.Size=New-Object System.Drawing.Size(490,45)
$note.Text='修复可能关闭当前盒马窗口，之后重新进入即可。关闭此面板不会停止后台辅助；需要停止时点“停止辅助”。'
$form.Controls.AddRange(@($start,$stop,$logs,$note))
function Refresh-HemaStatus {
    if ($script:busy) { return }
    try {
        $s=& (Join-Path $PSScriptRoot 'get-hema-status.ps1')
        $status.ForeColor=[System.Drawing.Color]::DarkSlateGray
        switch ($s.state) {
            'stopped' { $status.Text='辅助程序未运行。请点击“启动 / 修复”。' }
            'watcher_stopped' { $status.Text='自动放行程序未运行。请点击“启动 / 修复”。' }
            'patched' { $status.Text=('已放行：'+$s.name+'。若页面仍受限，请重新进入小程序。'); $status.ForeColor=[System.Drawing.Color]::DarkGreen }
            'port_conflict' { $status.Text='端口被其他程序占用，请查看故障处理文档。';$status.ForeColor=[System.Drawing.Color]::DarkRed }
            'patch_failed' { $status.Text='本次放行失败。可尝试修复；仍失败请查看日志。';$status.ForeColor=[System.Drawing.Color]::DarkRed }
            'unsupported_module_signature' { $status.Text='小程序代码已变化，需要更新适配。';$status.ForeColor=[System.Drawing.Color]::DarkRed }
            default { $status.Text='辅助已启动，等待盒马连接。请进入盒马，必要时选“重新进入小程序”。' }
        }
    } catch { $status.Text='无法读取状态：'+$_.Exception.Message }
}
$start.Add_Click({
    $script:busy=$true;$start.Enabled=$false;$stop.Enabled=$false;$status.Text='正在启动/修复，请稍候…';[System.Windows.Forms.Application]::DoEvents()
    try { & (Join-Path $PSScriptRoot 'start-hema.ps1') -Repair | Out-Null }
    catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'启动未完成') | Out-Null }
    finally { $script:busy=$false;$start.Enabled=$true;$stop.Enabled=$true;Refresh-HemaStatus }
})
$stop.Add_Click({
    $script:busy=$true;$start.Enabled=$false;$stop.Enabled=$false
    try { & (Join-Path $PSScriptRoot 'stop-hema-debug.ps1') | Out-Null }
    catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'停止未完成') | Out-Null }
    finally { $script:busy=$false;$start.Enabled=$true;$stop.Enabled=$true;Refresh-HemaStatus }
})
$logs.Add_Click({ $p=Join-Path $PSScriptRoot 'logs'; if(Test-Path -LiteralPath $p){Start-Process explorer.exe -ArgumentList ('"'+$p+'"')} })
$timer=New-Object System.Windows.Forms.Timer
$timer.Interval=4000
$timer.Add_Tick({Refresh-HemaStatus})
$form.Add_Shown({Refresh-HemaStatus;$timer.Start()})
$form.Add_FormClosed({$timer.Stop();$timer.Dispose()})
try { [void]$form.ShowDialog() } finally { $panelMutex.ReleaseMutex(); $panelMutex.Dispose() }
