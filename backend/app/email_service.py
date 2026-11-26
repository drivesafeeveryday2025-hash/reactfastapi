import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

# Configuration from environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "Apex Book Haven <service@apexbooks.com>").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

def send_password_reset_email(
    to_email: str,
    recipient_name: str,
    reset_token: str,
) -> dict[str, Any]:
    """
    Sends a password reset email containing a time-limited reset link.
    If SMTP server is configured, sends via real SMTP.
    Otherwise, gracefully simulates dispatch in development mode and logs the link.
    """
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    subject = "Apex Book Haven — Password Reset Instructions / 重設密碼連結"

    plain_text = f"""Hello {recipient_name},

We received a request to reset the password for your Apex Book Haven account ({to_email}).

To reset your password, please click the link below (or copy and paste it into your browser):
{reset_url}

This link is valid for 30 minutes from the time it was requested and can only be used once.

If you did not request a password reset, please ignore this email. Your current password remains secure and unchanged.

Warm regards,
Apex Book Haven Team
service@apexbooks.com
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1e3a8a; padding: 32px 40px; text-align: center;">
              <span style="font-size: 38px;">📚</span>
              <h1 style="color: #ffffff; margin: 10px 0 4px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Apex Book Haven</h1>
              <p style="color: #93c5fd; margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Customer Security & Account Services</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 40px; color: #1e293b; font-size: 15px; line-height: 1.6;">
              <h2 style="font-size: 20px; font-weight: 800; margin-top: 0; color: #0f172a;">Password Reset Request</h2>
              <p>Hello <b>{recipient_name}</b>,</p>
              <p>We received a request to reset the password associated with your account (<b>{to_email}</b>).</p>
              <p>Please click the button below to choose a new password. This link will remain active for <b>30 minutes</b> and can only be used once.</p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="{reset_url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; box-shadow: 0 3px 10px rgba(37,99,235,0.35);">
                  Reset My Password (重設密碼)
                </a>
              </div>

              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; margin: 24px 0; font-size: 13px; color: #475569; word-break: break-all;">
                <strong>Alternative link:</strong><br>
                <a href="{reset_url}" style="color: #2563eb;">{reset_url}</a>
              </div>

              <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                🔒 <strong>Security Notice:</strong> If you did not request this password reset, no action is needed. You can safely ignore this email and your password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              Apex Book Haven • 88 Literature Blvd, Culture Square<br>
              Need assistance? Contact our team at <a href="mailto:service@apexbooks.com" style="color: #64748b;">service@apexbooks.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    # If real SMTP is configured in .env, attempt sending
    if SMTP_HOST:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email

            part1 = MIMEText(plain_text, "plain", "utf-8")
            part2 = MIMEText(html_content, "html", "utf-8")
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except Exception:
                    pass  # Non-TLS SMTP fallback
                if SMTP_USER and SMTP_PASS:
                    server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())

            print(f"[EMAIL SERVICE] Successfully dispatched real password reset email to {to_email}")
            return {
                "sent": True,
                "mode": "smtp",
                "to": to_email,
                "reset_url": reset_url,
            }
        except Exception as smtp_err:
            print(f"[EMAIL SERVICE WARNING] SMTP send failed: {smtp_err}. Falling back to simulated dev mode.")

    # Development / Simulated fallback mode
    print("=================================================================")
    print(f"[EMAIL SERVICE DEV MODE] SIMULATED EMAIL DISPATCH TO: {to_email}")
    print(f"Subject: {subject}")
    print(f"Reset Link: {reset_url}")
    print("=================================================================")

    return {
        "sent": True,
        "mode": "simulated",
        "to": to_email,
        "reset_url": reset_url,
    }
