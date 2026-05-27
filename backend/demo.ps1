param([string]$BaseUrl="http://localhost:3001",[switch]$StressOnly)
$ErrorActionPreference="Stop"
$L="-"*60;$D="="*60
function c($t,$col){Write-Host $t -ForegroundColor $col -NoNewline}
function nl{Write-Host ""}
function header($t){nl;Write-Host $L -ForegroundColor DarkGray;c "  $t" "Cyan";nl;Write-Host $L -ForegroundColor DarkGray}
function pass($t){c "  [PASS] " "Green";c $t "White";nl}
function fail($t){c "  [FAIL] " "Red";c $t "Yellow";nl}
function info($t){c "  [ .. ] " "DarkGray";c $t "Gray";nl}
function kv($k,$v){c "    $($k.PadRight(14))" "DarkGray";c $v "White";nl}
function od($val,$def){if($null -eq $val -or "$val" -eq ""){$def}else{$val}}
function el($sw){"$([math]::Round($sw.Elapsed.TotalSeconds,1))s"}
function GET($p){Invoke-RestMethod -Uri "$BaseUrl$p" -Method GET -TimeoutSec 30}
function POST($p,$b){Invoke-RestMethod -Uri "$BaseUrl$p" -Method POST -ContentType "application/json" -Body ($b|ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 120}
$PASS=0;$FAIL=0
function assert($c,$l){if($c){pass $l;$script:PASS++}else{fail $l;$script:FAIL++}}
Clear-Host;nl
c "  ============================================" "Cyan";nl
c "   TAG VEHICLE CONFIG AGENT -- TEAM DEMO      " "White";nl
c "  ============================================" "Cyan";nl;nl
info "Target : $BaseUrl"
info "Time   : $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
if(-not $StressOnly){
  header "1/6  HEALTH CHECK"
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try{
    $h=GET "/health";$sw.Stop()
    kv "database" $h.database;kv "llm" $h.llm;kv "model" (od $h.model "stub");kv "latency" (el $sw)
    assert ($h.ok -eq $true) "API is healthy"
    assert ($h.database -ne "error") "Database connected"
  }catch{fail "Health unreachable -- is server running?";exit 1}
  header "2/6  CATALOGUE"
  $sw=[Diagnostics.Stopwatch]::StartNew();$vehicles=GET "/api/vehicles";$sw.Stop()
  assert ($vehicles.vehicles.Count -gt 0) "Vehicles loaded ($($vehicles.vehicles.Count) models, $(el $sw))"
  $modelList=($vehicles.vehicles|ForEach-Object{$_.model_code})-join", "
  kv "models" $modelList
  $sw=[Diagnostics.Stopwatch]::StartNew();$opts=GET "/api/vehicles?vehicle_model_id=VEH-TUV-1200";$sw.Stop()
  assert ($opts.options.Count -gt 0) "Options for TUV-1200 ($($opts.options.Count) options, $(el $sw))"
  $sw=[Diagnostics.Stopwatch]::StartNew();$clients=GET "/api/clients";$sw.Stop()
  assert ($clients.clients.Count -gt 0) "Clients loaded ($($clients.clients.Count) clients, $(el $sw))"
  $sw=[Diagnostics.Stopwatch]::StartNew();$orders=GET "/api/orders";$sw.Stop()
  assert ($orders.orders.Count -gt 0) "Orders loaded ($($orders.orders.Count) orders, $(el $sw))"
  header "3/6  ACCOUNT MANAGER: recommend starting configuration"
  info "Client asks for vehicles in natural language; agent recommends vehicle + starting configuration...";nl
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try{
    $r=POST "/api/agent" @{mode="recommend";client_id="CLI-UAE-001";user_text="Client needs 10 tactical utility vehicles for Abu Dhabi desert operations with Level III protection and military compliance."}
    $sw.Stop()
    kv "engine" $r.engine;kv "latency" (el $sw);kv "record_id" (od $r.record_id "n/a")
    assert ($r.mode -eq "recommend") "Mode echoed correctly"
    assert ($null -ne $r.result) "Result payload present"
    $props=$r.result.PSObject.Properties.Name
    assert ($props -contains "recommended_vehicle") "recommended_vehicle present"
    assert ($props -contains "recommended_configuration") "recommended_configuration present"
    assert ($props -contains "has_history") "has_history field present"
    assert ($props -contains "recommendations") "recommendations array present"
    if($r.result.recommended_vehicle){
      kv "vehicle" "$($r.result.recommended_vehicle.model_code) - $($r.result.recommended_vehicle.type)"
      kv "reason" $r.result.recommended_vehicle.reason
    }
    if($r.result.recommended_configuration){
      kv "baseline" (od $r.result.recommended_configuration.source_order_id "catalogue match")
      kv "match" $r.result.recommended_configuration.match_reason
    }
    if($r.result.recommendations -and $r.result.recommendations.Count -gt 0){
      $rec=$r.result.recommendations[0]
      $vm=if($rec.vehicle_model){$rec.vehicle_model}elseif($rec.model_code){$rec.model_code}else{"n/a"}
      $sc=if($rec.confidence_score){"$($rec.confidence_score)"}elseif($rec.score){"$($rec.score)"}else{"n/a"}
      kv "top rec" $vm;kv "confidence" $sc
    }
  }catch{fail "recommend failed: $_";$script:FAIL++}
  header "4/6  CLIENT: generate approval spec"
  info "Generating vehicle specification document...";nl
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try{
    $s=POST "/api/agent" @{mode="generate_spec";order_id="ORD-2026-POC";vehicle_model_id="VEH-TUV-1200";configuration_option_ids=@("opt-4wd","opt-level3");qty=10}
    $sw.Stop()
    kv "engine" $s.engine;kv "latency" (el $sw);kv "record_id" (od $s.record_id "n/a")
    assert ($s.mode -eq "generate_spec") "Mode echoed correctly"
    assert ($null -ne $s.result.vehicle) "vehicle block present"
    assert ($null -ne $s.result.technical_data) "technical_data block present"
    assert ($null -ne $s.result.custom_requirements) "custom_requirements block present"
    $cfgCount=if($s.result.configuration){$s.result.configuration.Count}else{0}
    assert ($cfgCount -gt 0) "configuration options present ($cfgCount)"
    $v=$s.result.vehicle;$td=$s.result.technical_data
    kv "model" $v.model_code;kv "type" $v.type;kv "BOM ref" $td.bom_reference
    kv "weight" "$($td.weight_kg) kg";kv "dims" "$($td.length_mm) x $($td.width_mm) x $($td.height_mm) mm";nl
    info "Spec saved -- open http://localhost:3001/spec.html"
  }catch{fail "generate_spec failed: $_";$script:FAIL++}
  header "5/6  CLIENT: generate commercial quote"
  info "Generating commercial quote with deterministic pricing...";nl
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try{
    $q=POST "/api/agent" @{mode="generate_quote";order_id="ORD-2026-POC";vehicle_model_id="VEH-TUV-1200";configuration_option_ids=@("opt-4wd","opt-level3");qty=10}
    $sw.Stop()
    kv "engine" $q.engine;kv "latency" (el $sw);kv "record_id" (od $q.record_id "n/a")
    assert ($q.mode -eq "generate_quote") "Mode echoed correctly"
    assert ($null -ne $q.result.total_usd) "total_usd present"
    assert ([double]$q.result.total_usd -gt 0) "total_usd is non-zero"
    assert ($null -ne $q.result.line_items) "line_items present"
    assert ($null -ne $q.result.lead_time_days) "lead_time_days present"
    assert ($null -ne $q.result.payment_terms) "payment_terms present";nl
    if($q.result.line_items -and $q.result.line_items.Count -gt 0){
      $li=$q.result.line_items[0]
      kv "quote ref" (od $q.result.quote_reference "n/a")
      kv "unit price" "USD $($li.unit_price_usd)"
      kv "qty" "$($li.qty)"
      kv "subtotal" "USD $($q.result.subtotal_usd)"
      kv "TOTAL" "USD $($q.result.total_usd)"
      kv "lead time" "$($q.result.lead_time_days) days"
      kv "payment" $q.result.payment_terms
    }
  }catch{fail "generate_quote failed: $_";$script:FAIL++}
  header "6/6  ENGINEERING: generate handover output"
  info "Generating structured engineering package after client approval...";nl
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try{
    $e=POST "/api/agent" @{mode="generate_engineering_output";order_id="ORD-2026-POC";vehicle_model_id="VEH-TUV-1200";configuration_option_ids=@("opt-4wd","opt-level3");qty=10}
    $sw.Stop()
    kv "engine" $e.engine;kv "latency" (el $sw);kv "record_id" (od $e.record_id "n/a")
    $pkg=$e.result.engineering_package
    assert ($e.mode -eq "generate_engineering_output") "Mode echoed correctly"
    assert ($null -ne $pkg) "engineering_package present"
    assert ($pkg.order_id -eq "ORD-2026-POC") "order_id present"
    assert ($pkg.vehicle_model -eq "TUV-1200") "vehicle_model present"
    assert ($null -ne $pkg.bom_reference) "BOM reference present"
    assert ($null -ne $pkg.drawing_set_reference) "drawing set reference present"
    assert ($pkg.configuration_requirements.Count -gt 0) "configuration requirements present"
    assert ($pkg.handover_status -eq "ready_for_engineering") "handover ready for engineering"
    nl
    kv "BOM ref" $pkg.bom_reference
    kv "drawing" $pkg.drawing_set_reference
    kv "status" $pkg.handover_status
  }catch{fail "generate_engineering_output failed: $_";$script:FAIL++}
}
header "STRESS TEST  (4 concurrent agent calls)"
info "Firing recommend + generate_spec + generate_quote + engineering simultaneously...";nl
$jobs=@("recommend","generate_spec","generate_quote","generate_engineering_output")|ForEach-Object{
  $mode=$_
  $b=@{mode=$mode;order_id="ORD-2026-POC";vehicle_model_id="VEH-TUV-1200";configuration_option_ids=@("opt-4wd","opt-level3");qty=10;client_id="CLI-UAE-001"}
  Start-Job -ScriptBlock{
    param($url,$jb)
    $sw=[Diagnostics.Stopwatch]::StartNew()
    try{
      $r=Invoke-RestMethod -Uri "$url/api/agent" -Method POST -ContentType "application/json" -Body ($jb|ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 180
      $sw.Stop()
      [pscustomobject]@{mode=$jb.mode;ok=$true;elapsed=[math]::Round($sw.Elapsed.TotalSeconds,1);engine=$r.engine;err=""}
    }catch{
      $sw.Stop()
      $msg=$_.ToString();if($msg.Length -gt 100){$msg=$msg.Substring(0,100)}
      [pscustomobject]@{mode=$jb.mode;ok=$false;elapsed=[math]::Round($sw.Elapsed.TotalSeconds,1);engine="error";err=$msg}
    }
  } -ArgumentList $BaseUrl,$b
}
$sw=[Diagnostics.Stopwatch]::StartNew()
$results=$jobs|Wait-Job|Receive-Job;$jobs|Remove-Job;$sw.Stop()
foreach($res in $results){
  if($res.ok){pass "$($res.mode.PadRight(22)) engine=$($res.engine.PadRight(12)) time=$($res.elapsed)s";$script:PASS++}
  else{fail "$($res.mode.PadRight(22)) FAILED in $($res.elapsed)s -- $($res.err)";$script:FAIL++}
}
kv "wall-clock (all 4)" (el $sw)
header "EDGE CASES  (error handling)"
try{$null=Invoke-WebRequest -Uri "$BaseUrl/api/orders/ORD-NOTEXIST" -UseBasicParsing -ErrorAction Stop
  fail "Expected 404";$script:FAIL++}catch{$code=$_.Exception.Response.StatusCode.value__;assert ($code -eq 404) "Missing order returns 404 (got $code)"}
try{$null=Invoke-WebRequest -Uri "$BaseUrl/api/agent" -Method POST -ContentType "application/json" -Body '{"mode":"generate_quote"}' -UseBasicParsing -ErrorAction Stop
  fail "Expected 400";$script:FAIL++}catch{$code=$_.Exception.Response.StatusCode.value__;assert ($code -eq 400) "Incomplete body returns 400 (got $code)"}
try{$null=Invoke-WebRequest -Uri "$BaseUrl/api/agent" -Method POST -ContentType "application/json" -Body '{"mode":"make_coffee","vehicle_model_id":"VEH-TUV-1200","configuration_option_ids":[],"qty":1}' -UseBasicParsing -ErrorAction Stop
  fail "Expected 400";$script:FAIL++}catch{$code=$_.Exception.Response.StatusCode.value__;assert ($code -eq 400) "Unknown mode returns 400 (got $code)"}
nl;Write-Host $D -ForegroundColor DarkGray
$total=$PASS+$FAIL;$pct=if($total -gt 0){[math]::Round($PASS/$total*100)}else{0}
if($FAIL -eq 0){c "  ALL $total TESTS PASSED  ($pct pct)" "Green"}
else{c "  $PASS / $total PASSED ($pct pct)  --  $FAIL FAILED" "Yellow"}
nl;Write-Host $D -ForegroundColor DarkGray;nl
if($FAIL -eq 0){info "Spec viewer --> http://localhost:3001/spec.html";info "Health --> http://localhost:3001/health"}
nl
