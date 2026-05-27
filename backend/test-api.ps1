
# TAG Vehicle Config Agent - API Test Suite
# Usage: cd backend && .\test-api.ps1

$BASE = "http://localhost:3001"

function Divider { Write-Host ("-" * 60) }

function Section($title) {
    Write-Host ""
    Divider
    Write-Host "  $title"
    Divider
}

function Field($label, $value) {
    Write-Host ("  {0,-26} {1}" -f $label, $value)
}

function Result($label, [bool]$ok, $detail = "") {
    $icon = if ($ok) { "[PASS]" } else { "[FAIL]" }
    Write-Host ("  {0}  {1,-30}  {2}" -f $icon, $label, $detail)
}

# ── 1. HEALTH ──────────────────────────────────────────────────────────
Section "1 / 4  HEALTH"
try {
    $h = Invoke-RestMethod "$BASE/health" -TimeoutSec 5
    Result "Database"  ($h.database -eq "connected")  $h.database
    Result "LLM"       ($h.llm -eq "openrouter")      $h.llm
    Field  "Model"     $h.model
} catch {
    Write-Host "  [FAIL]  Cannot reach $BASE - is npm run dev running?"
    exit 1
}

# ── 2. CATALOGUE ───────────────────────────────────────────────────────
Section "2 / 4  CATALOGUE"
$veh = Invoke-RestMethod "$BASE/api/vehicles?vehicle_model_id=VEH-TUV-1200"
$cli = Invoke-RestMethod "$BASE/api/clients"
Result "Vehicles"  ($veh.vehicles.Count -gt 0)  "$($veh.vehicles.Count) vehicle(s)"
Result "Options"   ($veh.options.Count  -gt 0)  "$($veh.options.Count) option(s)"
Result "Clients"   ($cli.clients.Count  -gt 0)  "$($cli.clients.Count) client(s)"

# ── 3. RECOMMEND ───────────────────────────────────────────────────────
Section "3 / 4  AGENT: recommend"
$recBody = '{"mode":"recommend","client_id":"CLI-UAE-MOD","vehicle_model_id":"VEH-TUV-1200"}'
$rec = Invoke-RestMethod -Method POST "$BASE/api/agent" -ContentType "application/json" -Body $recBody -TimeoutSec 60
$top = $rec.result.recommendations[0]
Result "Engine"        ($rec.engine -eq "langchain")      $rec.engine
Result "History found" ($rec.result.has_history -eq $true) "$($rec.result.recommendations.Count) past order(s)"
if ($top) {
    Field  "Top match"     $top.order_id
    Field  "Config"        $top.configuration_summary
    Field  "Date"          $top.date
}

# ── 3.5 SPEC ───────────────────────────────────────────────────────────
Section "3.5 / 4  AGENT: generate_spec"
$specBody = '{"mode":"generate_spec","order_id":"ORD-2026-POC","vehicle_model_id":"VEH-TUV-1200","configuration_option_ids":["opt-4wd","opt-level3"],"qty":10}'
$sp = Invoke-RestMethod -Method POST "$BASE/api/agent" -ContentType "application/json" -Body $specBody -TimeoutSec 90
$s  = $sp.result
Result "Engine"            ($sp.engine -eq "langchain")                      $sp.engine
Result "Saved to DB"       ($sp.record_id -ne $null)                         $sp.record_id
Result "Technical data"    ($s.technical_data.bom_reference -ne $null)       $s.technical_data.bom_reference
Result "Custom reqs"       ($s.custom_requirements.compliance -ne $null)     $s.custom_requirements.compliance
Field  "Vehicle"           "$($s.vehicle.model_code)  |  $($s.vehicle.type)"
Field  "BOM ref"           $s.technical_data.bom_reference
Field  "Drawing ref"       $s.technical_data.drawing_set_reference
Field  "Dimensions"        "L$($s.technical_data.length_mm) x W$($s.technical_data.width_mm) x H$($s.technical_data.height_mm) mm  |  $($s.technical_data.weight_kg) kg"
Field  "Delivery"          $s.custom_requirements.delivery
Field  "Compliance"        $s.custom_requirements.compliance

# ── 4. QUOTE ───────────────────────────────────────────────────────────
Section "4 / 4  AGENT: generate_quote"
$qtBody = '{"mode":"generate_quote","order_id":"ORD-2026-POC","vehicle_model_id":"VEH-TUV-1200","configuration_option_ids":["opt-4wd","opt-level3"],"qty":10}'
$qt = Invoke-RestMethod -Method POST "$BASE/api/agent" -ContentType "application/json" -Body $qtBody -TimeoutSec 90
$q  = $qt.result
Result "Engine"           ($qt.engine -eq "langchain")                        $qt.engine
Result "Saved to DB"      ($qt.record_id -ne $null)                           $qt.record_id
Result "Unit price"       ($q.line_items[0].unit_price_usd -eq 365000)        "USD $($q.line_items[0].unit_price_usd)  (expect 365,000)"
Result "Total correct"    ($q.total_usd -eq 3650000)                          "USD $($q.total_usd)  (expect 3,650,000)"
Field  "Reference"        $q.quote_reference
Field  "Lead time"        "$($q.lead_time_days) days"
Field  "Payment terms"    $q.payment_terms
Field  "Notes"            $q.notes

# ── SUMMARY ────────────────────────────────────────────────────────────
Divider
Write-Host ""
Write-Host "  TAG Agent PoC - all modes verified against Supabase Postgres"
Write-Host "  Engine : LangChain JS + OpenRouter"
Write-Host "  Model  : $($h.model)"
Write-Host ""
Divider
Write-Host ""
