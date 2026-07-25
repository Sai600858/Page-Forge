import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { fileURLToPath } from 'url';

// pdf-parse is a CommonJS module; use createRequire to guarantee a callable default
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs an external process, capturing stdout + stderr.
 * Uses spawn (not exec) so arguments are passed directly — no cmd.exe
 * quoting layer and no 1 MB buffer limit.
 * Rejects with an error that includes the captured stderr so callers
 * can surface the real failure message.
 * @param {string}   command    - Executable name / path
 * @param {string[]} args       - Argument array (spaces in paths are safe)
 * @param {number}   timeoutMs  - Kill the child after this many ms (default 90s)
 */
const spawnPromise = (command, args, timeoutMs = 90000) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    let settled = false;

    // Timeout guard — kills a hung Word process and rejects clearly
    const timer = setTimeout(() => {
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      reject(new Error(
        `Process "${command}" timed out after ${timeoutMs / 1000}s. ` +
        'Microsoft Word may be waiting for user input (license activation, ' +
        'macro warning, or document recovery prompt). ' +
        'Please open Word manually, dismiss any dialogs, then retry.'
      ));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        // Include the actual stderr/stdout so the caller can log and re-throw
        const msg = (stderr || stdout || '').trim();
        const err = new Error(
          `Process exited with code ${code}` + (msg ? `:\n${msg}` : '')
        );
        err.stderr = stderr;
        err.stdout = stdout;
        err.exitCode = code;
        reject(err);
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // e.g. ENOENT when powershell.exe is not found on PATH
      err.stderr = stderr;
      err.stdout = stdout;
      reject(err);
    });
  });

export const wordToPdf = async (inputWordPath) => {
  const isWindows = process.platform === 'win32';
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const uploadsDir = path.resolve(path.join(__dirname, '../../uploads'));
  const absoluteInputPath = path.resolve(inputWordPath);

  if (isWindows) {
    const tempPdfPath = path.join(uploadsDir, `temp_${uniqueId}.pdf`);
    const psScriptPath = path.join(uploadsDir, `convert_${uniqueId}.ps1`);
    const absoluteOutputPath = path.resolve(tempPdfPath);

    const escapedInputPath = absoluteInputPath.replace(/'/g, "''");
    const escapedOutputPath = absoluteOutputPath.replace(/'/g, "''");

    const psScriptContent = `
$ErrorActionPreference = 'Stop'
$before = Get-Process -Name WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id
$word = $null
$doc = $null
$wordPid = $null

try {
    $word = New-Object -ComObject Word.Application

    # Capture the PID of the Word instance we just created
    $after = Get-Process -Name WINWORD -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id
    $wordPid = $after | Where-Object { $_ -notin $before } | Select-Object -First 1

    # Suppress all alerts and hide the window immediately
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false

    # Open the document — single-argument form avoids COM parameter-binding
    # issues that occur when empty strings are passed for password fields
    $doc = $word.Documents.Open('${escapedInputPath}')

    # Export as PDF (wdExportFormatPDF = 17)
    $doc.ExportAsFixedFormat('${escapedOutputPath}', 17)

    $doc.Close($false)
    $word.Quit()
    Write-Host "Success"
} catch {
    # Write-Host goes to stdout; write the error there too so Node can capture it
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Error $_.Exception.Message
    exit 1
} finally {
    if ($doc -ne $null) {
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {}
    }
    if ($word -ne $null) {
        try { $word.Quit() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    if ($wordPid) {
        Stop-Process -Id $wordPid -Force -ErrorAction SilentlyContinue
    }
}
`;
    try {
      // Write with UTF-8 BOM — PowerShell 5.1 (Windows default) reads PS1
      // files as ANSI/Windows-1252 without a BOM, corrupting non-ASCII chars.
      fs.writeFileSync(psScriptPath, '\ufeff' + psScriptContent, 'utf-8');

      // Use spawn so psScriptPath (which may contain spaces) is passed as a
      // plain argument — no cmd.exe quoting layer required
      await spawnPromise('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', psScriptPath
      ]);

      if (!fs.existsSync(tempPdfPath)) {
        throw new Error(
          'PowerShell script completed but no PDF was produced. ' +
          'Ensure Microsoft Word is installed and the .docx file is not corrupted.'
        );
      }

      const pdfBytes = fs.readFileSync(tempPdfPath);
      return pdfBytes;
    } catch (err) {
      // Surface the actual PowerShell error text in both the log and the response
      const detail = (err.stderr || err.stdout || err.message || '').trim();
      console.error('[wordToPdf] PowerShell error:\n', detail);
      throw new Error(
        detail
          ? `Word to PDF conversion failed:\n${detail}`
          : 'Word to PDF conversion failed. Ensure Microsoft Word is installed and the document is valid.'
      );
    } finally {
      if (fs.existsSync(psScriptPath)) {
        try { fs.unlinkSync(psScriptPath); } catch (_) {}
      }
      if (fs.existsSync(tempPdfPath)) {
        try { fs.unlinkSync(tempPdfPath); } catch (_) {}
      }
    }

  } else {
    // Linux/Docker - Use LibreOffice/soffice
    const tempInputName = `temp_${uniqueId}.docx`;
    const tempInputPath = path.join(uploadsDir, tempInputName);
    const tempPdfName = `temp_${uniqueId}.pdf`;
    const tempPdfPath = path.join(uploadsDir, tempPdfName);

    try {
      // Copy the input file so LibreOffice names the output predictably
      fs.copyFileSync(absoluteInputPath, tempInputPath);

      // Use spawn with an arg array — immune to path-with-spaces quoting issues
      await spawnPromise('soffice', [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', uploadsDir,
        tempInputPath
      ]);

      if (!fs.existsSync(tempPdfPath)) {
        throw new Error(
          'LibreOffice completed but no PDF was produced. ' +
          'Ensure LibreOffice is installed and the .docx file is not corrupted.'
        );
      }

      const pdfBytes = fs.readFileSync(tempPdfPath);
      return pdfBytes;
    } catch (err) {
      const detail = (err.stderr || err.stdout || err.message || '').trim();
      console.error('[wordToPdf] LibreOffice error:\n', detail);
      throw new Error(
        detail
          ? `Word to PDF conversion failed:\n${detail}`
          : 'Word to PDF conversion failed. Ensure LibreOffice is installed and the document is valid.'
      );
    } finally {
      if (fs.existsSync(tempInputPath)) {
        try { fs.unlinkSync(tempInputPath); } catch (_) {}
      }
      if (fs.existsSync(tempPdfPath)) {
        try { fs.unlinkSync(tempPdfPath); } catch (_) {}
      }
    }
  }
};


/**
 * Converts a PDF to a Word Document by extracting text and packaging it.
 */
export const pdfToWord = async (pdfPath) => {
  const pdfBytes = fs.readFileSync(pdfPath);

  // Extract text — wrap in try/catch so encrypted or image-only PDFs
  // surface a clear, user-facing error rather than a cryptic crash.
  let text = '';
  try {
    const parseResult = await pdfParse(pdfBytes);
    text = parseResult.text || '';
  } catch (err) {
    console.error('pdf-parse extraction error:', err);
    throw new Error(
      'Could not extract text from this PDF. ' +
      'The file may be encrypted or contain only scanned images with no text layer.'
    );
  }

  if (!text.trim()) {
    throw new Error(
      'No readable text was found in this PDF. ' +
      'Scanned image-only PDFs cannot be converted to Word without OCR.'
    );
  }

  // Split on newlines, preserving blank lines as empty paragraphs
  const lines = text.split(/\r?\n/);

  const paragraphs = lines.map(line =>
    new Paragraph({
      children: [
        new TextRun({
          text: line,
          font: 'Calibri',
          size: 24 // 12pt
        })
      ],
      spacing: { after: 120 } // 6pt spacing after each paragraph
    })
  );

  // docx requires at least one paragraph — guard against edge cases
  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  // Assemble the Word document
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });

  const docxBuffer = await Packer.toBuffer(doc);
  return docxBuffer;
};
