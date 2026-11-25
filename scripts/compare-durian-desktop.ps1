param(
  [Parameter(Mandatory = $true)][string]$DesktopExe,
  [Parameter(Mandatory = $true)][string]$Day
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Reflection;

public static class DesktopAssembly
{
    public static Assembly Load(string executable)
    {
        var directory = Path.GetDirectoryName(executable);
        AppDomain.CurrentDomain.AssemblyResolve += (sender, request) =>
        {
            var name = new AssemblyName(request.Name).Name + ".dll";
            var path = Path.Combine(directory, "lib", name);
            return File.Exists(path) ? Assembly.LoadFrom(path) : null;
        };
        return Assembly.LoadFrom(executable);
    }
}
'@
$assembly = [DesktopAssembly]::Load((Resolve-Path -LiteralPath $DesktopExe).Path)
$reporting = $assembly.GetType('QHSWeight.Durian.DurianReporting', $true)
$ticketType = $assembly.GetType('QHSWeight.Durian.PurchaseTicket', $true)
$eventType = $assembly.GetType('QHSWeight.Durian.IntakeEvent', $true)
$filterType = $assembly.GetType('QHSWeight.Durian.DurianReportFilter', $true)
$listType = [Collections.Generic.List[object]].GetGenericTypeDefinition()
$tickets = [Activator]::CreateInstance($listType.MakeGenericType($ticketType))
$events = [Activator]::CreateInstance($listType.MakeGenericType($eventType))
$culture = [Globalization.CultureInfo]::InvariantCulture
[Console]::InputEncoding = [Text.Encoding]::UTF8
$records = [Console]::In.ReadToEnd() | ConvertFrom-Json
foreach ($record in $records) {
  $data = $record.data
  if ($record.kind -eq 'ticket') {
    $ticket = [Activator]::CreateInstance($ticketType)
    foreach ($key in @('Id','Number','Plate','GateId','GateName','Status','Supplier','IsTest')) { $ticket.$key = $data.$key }
    $ticket.Arrival = [datetime]::Parse($data.Arrival, $culture)
    $ticket.TaxAmount = [decimal]$data.TaxAmount
    foreach ($price in $data.Prices.PSObject.Properties) { $ticket.Prices[$price.Name] = [decimal]$price.Value }
    foreach ($label in $data.ItemNames.PSObject.Properties) { $ticket.ItemNames[$label.Name] = [string]$label.Value }
    $tickets.Add($ticket)
  } elseif (-not $data.IsTest) {
    $event = [Activator]::CreateInstance($eventType)
    foreach ($key in @('Id','TicketId','ItemType','Problem','Voided')) { $event.$key = $data.$key }
    $event.Weight = [decimal]$data.Weight
    $events.Add($event)
  }
}
$filter = [Activator]::CreateInstance($filterType)
$filter.From = [datetime]::ParseExact($Day, 'yyyy-MM-dd', $culture)
$filter.To = $filter.From
$filter.Status = 'Completed'
$arguments = [object[]]::new(3)
$arguments[0] = $tickets
$arguments[1] = $events
$arguments[2] = $filter
$rows = $reporting.GetMethod('Select').Invoke($null, $arguments)
[ordered]@{
  kg = ($rows | Measure-Object Weight -Sum).Sum
  trips = $rows.Count
  amount = ($rows | Measure-Object Amount -Sum).Sum
  ticketTotal = ($rows | Where-Object { $_.Ticket.Id -eq 'completed' }).Total
} | ConvertTo-Json -Compress
