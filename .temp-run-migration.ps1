# One-shot: apply supabase/migrations/0001_story_graph.sql to the linked
# Supabase project via the Management API, using the CLI access token stored
# in Windows Credential Manager. The token is never printed.
$ErrorActionPreference = "Stop"

$src = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredMan {
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

    public static string ReadSecret(string target) {
        IntPtr ptr = IntPtr.Zero;
        try {
            if (!CredRead(target, 1, 0, out ptr)) return null;
            CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
            byte[] blob = new byte[c.CredentialBlobSize];
            Marshal.Copy(c.CredentialBlob, blob, 0, blob.Length);
            return Encoding.Unicode.GetString(blob);
        } finally {
            if (ptr != IntPtr.Zero) CredFree(ptr);
        }
    }
}
'@
Add-Type -TypeDefinition $src
$token = [CredMan]::ReadSecret("Supabase CLI:supabase")
if (-not $token) { Write-Output "TOKEN_NOT_FOUND"; exit 1 }

$sql = Get-Content "C:\Users\madur\work\throughline\supabase\migrations\0001_story_graph.sql" -Raw
$body = @{ query = $sql } | ConvertTo-Json -Depth 3

try {
  $resp = Invoke-WebRequest -UseBasicParsing `
    -Uri "https://api.supabase.com/v1/projects/tfybmchbbpamyksbdprs/database/query" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $body
  Write-Output ("HTTP " + $resp.StatusCode)
} catch {
  Write-Output ("HTTP " + $_.Exception.Response.StatusCode.value__)
  $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
  Write-Output $sr.ReadToEnd()
}
