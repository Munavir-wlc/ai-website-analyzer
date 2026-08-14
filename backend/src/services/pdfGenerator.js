const { getPuppeteer } = require('../utils/browserLaunch');

async function generateReportPDF(reportData) {
  let browser = null;
  try {
    const puppeteer = getPuppeteer();
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    const scoreColor = (reportData.score >= 80) ? '#10B981' : (reportData.score >= 60) ? '#F59E0B' : '#EF4444';
    const findingsList = (reportData.findings || []).map(f => `
      <div style="background: #1e293b; border-left: 4px solid ${f.severity === 'critical' ? '#ef4444' : f.severity === 'high' ? '#f97316' : f.severity === 'medium' ? '#f59e0b' : '#3b82f6'}; margin-bottom: 12px; padding: 12px 16px; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #f8fafc; font-size: 15px;">${f.title}</h3>
          <span style="font-size: 11px; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #cbd5e1; font-weight: bold;">${f.severity}</span>
        </div>
        <p style="margin: 6px 0; color: #94a3b8; font-size: 13px;">${f.description || ''}</p>
        ${f.remediation ? `<div style="margin-top: 6px; font-size: 12px; color: #38bdf8;"><strong>Remediation:</strong> ${f.remediation}</div>` : ''}
      </div>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Security VAPT Report - ${reportData.scannedUrl || reportData.url}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 25px; }
          .title { font-size: 24px; font-weight: bold; color: #38bdf8; }
          .meta { font-size: 12px; color: #94a3b8; }
          .score-card { background: #1e293b; padding: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; border: 1px solid #334155; }
          .score-val { font-size: 48px; font-weight: bold; color: ${scoreColor}; }
          .score-label { font-size: 14px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }
          .section-title { font-size: 18px; color: #f8fafc; margin-top: 25px; margin-bottom: 15px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">AI Security VAPT Audit Report</div>
            <div class="meta">Target: <strong>${reportData.scannedUrl || reportData.url}</strong></div>
          </div>
          <div style="text-align: right;" class="meta">
            <div>Date: ${new Date(reportData.scanDate || Date.now()).toLocaleDateString()}</div>
            <div>Mode: ${reportData.scanMode || 'Full'}</div>
          </div>
        </div>

        <div class="score-card">
          <div>
            <div class="score-label">Security Score</div>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Overall security posture assessment rating</div>
          </div>
          <div class="score-val">${reportData.score}/100</div>
        </div>

        ${reportData.summary ? `
          <div class="section-title">Executive Summary</div>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; background: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155;">
            ${reportData.summary}
          </p>
        ` : ''}

        <div class="section-title">Discovered Vulnerabilities & Security Findings (${(reportData.findings || []).length})</div>
        ${findingsList || '<p style="color: #94a3b8;">No security vulnerabilities identified.</p>'}
      </body>
      </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    });

    await browser.close();
    return pdfBuffer;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw new Error(`PDF generation failed: ${err.message}`);
  }
}

module.exports = { generateReportPDF };
