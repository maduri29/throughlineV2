# Diagnose the Supabase CLI credential and apply the migration.
# Tries Unicode and UTF-8 decodes of the Credential Manager blob against the
# Management API. The token itself is never printed.
$ErrorActionPreference = "Stop"

$src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredManD {
    [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern bool CredRead(string target, int type, int reserved, out IntPtr credPtr);

    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr cred);

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    private struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static byte[] ReadBlob(string target) {
        IntPtr ptr = IntPtr.Zero;
        try {
            if (!CredRead(target, 1, 0, out ptr)) return null;
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
            byte[] blob = new byte[c.CredentialBlobSize];
            Marshal.Copy(c.CredentialBlob, blob, 0, blob.Length);
            return blob;
        } finally {
            if (ptr != IntPtr.Zero) CredFree(ptr);
        }
    }
}
'@
Add-Type -TypeDefinition $src

$blob = [CredManD]::ReadBlob("Supabase CLI:supabase")
if (-not $blob) { Write-Output "TOKEN_NOT_FOUND"; exit 1 }
Write-Output ("BlobBytes=" + $blob.Length)

function Test-Token([string]$tok) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "https://api.supabase.com/v1/projects/tfybmchbbpamyksbdprs" -Method Get -Headers @{ Authorization = "Bearer $tok" }
    return $r.StatusCode
  } catch { return $null }
}

$candidates = @()
try { $candidates += ,@("unicode", [Text.Encoding]::Unicode.GetString($blob)) } catch {}
try { $candidates += ,@("utf8", [Text.Encoding]::UTF8.GetString($blob)) } catch {}

$found = $null
foreach ($c in $candidates) {
  $t = $c[1].Trim()
  $prefix = $t.Substring(0, [Math]::Min(4, $t.Length))
  Write-Output ("Candidate=" + $c[0] + " Len=" + $t.Length + " Prefix=" + $prefix)
  $code = Test-Token $t
  Write-Output ("  api status: " + $(if ($code) { $code } else { "failed" }))
  if ($code -eq 200) { $found = $t; break }
}

if (-not $found) { Write-Output "NO_WORKING_DECODE"; exit 2 }

$sql = Get-Content "C:\Users\madur\work\throughline\supabase\migrations\0001_story_graph.sql" -Raw
$body = ConvertTo-Json @{ query = $sql } -Depth 3 -Compress
Write-Output ("BodyLen=" + $body.Length)
Write-Output ("First200=" + $body.Substring(0, [Math]::Min(200, $body.Length)))
try {
  $resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/tfybmchbbpamyksbdprs/database/query" `
    -Method Post -Headers @{ Authorization = "Bearer $found" } -ContentType "application/json; charset=utf-8" -Body $body
  Write-Output ("MIGRATION OK: " + ($resp | ConvertTo-Json -Depth 5))
} catch {
  $sc = $_.Exception.Response.StatusCode.value__
  Write-Output ("MIGRATION HTTP " + $sc)
  Write-Output ("ErrorDetails: " + $(if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { "<none>" }))
  Write-Output ("Exception: " + $_.Exception.Message)
}
exit 0
