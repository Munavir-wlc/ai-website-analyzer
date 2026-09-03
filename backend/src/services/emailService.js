const nodemailer = require('nodemailer');

/**
 * Send Workspace Invitation Email to Team Member
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.teamName - Name of the team workspace
 * @param {string} options.inviterName - Name of the person inviting
 * @param {string} options.role - Invited role ('admin' or 'member')
 * @param {string} options.inviteLink - Full URL to accept the invitation
 */
async function sendTeamInviteEmail({ toEmail, teamName, inviterName, role, inviteLink }) {
  try {
    let transporter;

    // Check if live SMTP configuration exists
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Fallback: Create Ethereal test account for local development
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } else {
        // Fallback JSON transport
        transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 24px;">AI Website Security Analyzer</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Multi-User Team Workspace Invitation</p>
        </div>
        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">You have been invited to join ${teamName}!</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            <strong>${inviterName}</strong> has invited you to collaborate on security audits, vulnerability reports, and asset monitoring in the <strong>${teamName}</strong> workspace as a <strong>${role.toUpperCase()}</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: #ffffff; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; font-size: 14px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
              Accept Workspace Invitation
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This invitation link is valid for 7 days. If you do not have an account yet, you will be prompted to create one upon clicking the link.
          </p>
        </div>
        <div style="text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">AI Website Analyzer Security Platform</p>
          <p style="margin: 4px 0 0 0;">If you were not expecting this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"AI Website Analyzer" <noreply@vapt-analyzer.com>',
      to: toEmail,
      subject: `[Invitation] You've been invited to join ${teamName} workspace`,
      html: htmlContent
    });

    console.log(`[Email Service] Invitation email sent to ${toEmail}. MessageID: ${info.messageId}`);
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`[Email Service] Ethereal Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null
    };
  } catch (err) {
    console.error('[Email Service Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Password Reset Email
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.userName - Recipient name
 * @param {string} options.resetLink - Password reset link with token
 */
async function sendPasswordResetEmail({ toEmail, userName, resetLink }) {
  try {
    let transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 24px;">AI Website Security Analyzer</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Password Reset Request</p>
        </div>
        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Reset Your Account Password</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Hello <strong>${userName || 'Security Engineer'}</strong>, we received a request to reset the password for your account.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; font-size: 14px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
              Reset Account Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
            This password reset link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
        <div style="text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">AI Website Analyzer Security Platform</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"AI Website Analyzer" <noreply@vapt-analyzer.com>',
      to: toEmail,
      subject: '[Password Reset] Reset your AI Website Security account password',
      html: htmlContent
    });

    console.log(`[Email Service] Password reset email sent to ${toEmail}. MessageID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null
    };
  } catch (err) {
    console.error('[Email Service Reset Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Monitoring Change Intelligence Alert Email
 * @param {Object} options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.targetUrl - Scanned URL
 * @param {string} options.domain - Domain hostname
 * @param {number} options.currentScore - Latest overall score
 * @param {number} options.previousScore - Previous overall score
 * @param {number} options.scoreDelta - Score change points
 * @param {Array} options.newFindings - Newly detected vulnerability findings
 * @param {Array} options.resolvedFindings - Newly resolved findings
 * @param {string} options.alertReason - Trigger reason
 * @param {string} options.reportUrl - URL to view the report
 */
async function sendMonitoringAlertEmail({
  toEmail,
  targetUrl,
  domain,
  currentScore,
  previousScore,
  scoreDelta,
  newFindings = [],
  resolvedFindings = [],
  alertReason = 'Website Security & Performance Change Detected',
  reportUrl = 'https://ai-website-analyzer.com/monitoring'
}) {
  try {
    let transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      } else {
        transporter = nodemailer.createTransport({
          jsonTransport: true
        });
      }
    }

    const deltaSign = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
    const deltaColor = scoreDelta > 0 ? '#10b981' : scoreDelta < 0 ? '#f43f5e' : '#94a3b8';

    const newFindingsHtml = newFindings.length > 0 ? `
      <div style="margin-top: 20px;">
        <h3 style="color: #f43f5e; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">
          🚨 New Vulnerabilities (${newFindings.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${newFindings.slice(0, 5).map(f => `
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 8px 0; color: #f8fafc; font-weight: bold;">${f.title}</td>
              <td style="padding: 8px 0; text-align: right; color: ${f.severity === 'critical' ? '#f43f5e' : f.severity === 'high' ? '#fb923c' : '#fbbf24'}; text-transform: uppercase; font-size: 11px; font-weight: bold;">
                ${f.severity || 'Medium'}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const resolvedFindingsHtml = resolvedFindings.length > 0 ? `
      <div style="margin-top: 20px;">
        <h3 style="color: #10b981; font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">
          ✅ Resolved Findings (${resolvedFindings.length})
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${resolvedFindings.slice(0, 5).map(f => `
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 8px 0; color: #94a3b8; text-decoration: line-through;">${f.title}</td>
              <td style="padding: 8px 0; text-align: right; color: #10b981; font-size: 11px; font-weight: bold;">FIXED</td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f8fafc; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #818cf8; margin: 0; font-size: 22px; letter-spacing: -0.5px;">AI Website Monitoring Alert</h1>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Automated Continuous Health & Security Intelligence</p>
        </div>

        <div style="background-color: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 28px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 16px;">
            <div>
              <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold;">Monitored Target</span>
              <h2 style="color: #ffffff; font-size: 18px; margin: 2px 0 0 0;">${domain || targetUrl}</h2>
            </div>
            <div style="text-align: right;">
              <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: bold;">Score</span>
              <div style="font-size: 20px; font-weight: 800; color: #ffffff;">
                ${currentScore}/100 <span style="font-size: 13px; color: ${deltaColor}; font-weight: bold;">(${deltaSign})</span>
              </div>
            </div>
          </div>

          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
            <strong>Alert Trigger:</strong> ${alertReason}
          </p>

          ${newFindingsHtml}
          ${resolvedFindingsHtml}

          <div style="text-align: center; margin: 32px 0 12px 0;">
            <a href="${reportUrl}" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; font-size: 14px;">
              View Full "What Changed?" Report →
            </a>
          </div>
        </div>

        <div style="text-align: center; color: #64748b; font-size: 11px;">
          <p style="margin: 0;">AI Website Analyzer Continuous Monitoring</p>
          <p style="margin: 4px 0 0 0;">You received this email based on your notification preferences for ${domain}.</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"AI Website Analyzer" <alerts@vapt-analyzer.com>',
      to: toEmail,
      subject: `[Security Alert] ${domain}: Score ${currentScore}/100 (${deltaSign}) - ${alertReason}`,
      html: htmlContent
    });

    console.log(`[Email Service] Monitoring alert sent to ${toEmail}. MessageID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null
    };
  } catch (err) {
    console.error('[Email Service Alert Error]:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendTeamInviteEmail, sendPasswordResetEmail, sendMonitoringAlertEmail };

