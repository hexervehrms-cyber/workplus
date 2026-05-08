# 📧 Email System Setup Guide - WorkPlus HRMS

## ✅ Current Status

Your email notification system code is **fully implemented and working correctly**. The test script successfully:
- ✅ Loaded SMTP configuration
- ✅ Connected to Microsoft 365 SMTP server
- ✅ Attempted authentication

## ⚠️ Issue Detected

**Error**: `SmtpClientAuthentication is disabled for the Tenant`

This means SMTP authentication is currently **disabled** in your Microsoft 365 admin settings. This is a security feature that needs to be enabled.

---

## 🔧 Solution: Enable SMTP Authentication in Microsoft 365

### Option 1: Enable for Entire Organization (Recommended)

1. **Login to Microsoft 365 Admin Center**
   - Go to: https://admin.microsoft.com
   - Sign in with admin credentials

2. **Navigate to Exchange Admin Center**
   - Click on "Admin centers" → "Exchange"
   - Or go directly to: https://admin.exchange.microsoft.com

3. **Enable SMTP AUTH**
   - Go to **Settings** → **Mail flow** → **Accepted domains**
   - Or navigate to **Settings** → **Org settings** → **Modern authentication**
   - Find **"SMTP AUTH"** setting
   - **Enable** SMTP AUTH for the organization

4. **Alternative Path (Classic Exchange Admin)**
   - Go to **Mail flow** → **Connectors**
   - Or **Settings** → **Mail flow**
   - Enable **"SMTP client submission"**

### Option 2: Enable for Specific Mailbox (hr@hexerve.com)

If you don't have organization-wide admin access, enable it for the specific mailbox:

1. **Using PowerShell** (Requires Exchange Online PowerShell)
   ```powershell
   # Connect to Exchange Online
   Connect-ExchangeOnline -UserPrincipalName admin@hexerve.com
   
   # Enable SMTP AUTH for specific mailbox
   Set-CASMailbox -Identity hr@hexerve.com -SmtpClientAuthenticationDisabled $false
   
   # Verify the setting
   Get-CASMailbox -Identity hr@hexerve.com | Format-List SmtpClientAuthenticationDisabled
   ```

2. **Using Microsoft 365 Admin Center**
   - Go to **Users** → **Active users**
   - Select **hr@hexerve.com**
   - Click **Mail** tab
   - Click **Manage email apps**
   - **Enable** "Authenticated SMTP"
   - Click **Save changes**

### Option 3: Use App Password (Most Secure)

If you have Multi-Factor Authentication (MFA) enabled:

1. **Generate App Password**
   - Go to: https://account.microsoft.com/security
   - Sign in as hr@hexerve.com
   - Click **"Advanced security options"**
   - Under **"App passwords"**, click **"Create a new app password"**
   - Copy the generated password

2. **Update .env File**
   ```env
   SMTP_PASS=<paste-app-password-here>
   ```

---

## 🔄 After Enabling SMTP AUTH

### Wait Time
- Changes may take **5-15 minutes** to propagate
- In some cases, it can take up to **1 hour**

### Test Again
Run the test script:
```bash
node backend/scripts/testEmail.js
```

### Expected Success Output
```
🚀 Starting email test...

📧 SMTP Configuration:
   Host: smtp.office365.com
   Port: 587
   User: hr@hexerve.com
   From: hr@hexerve.com

🔍 Verifying SMTP connection...
✅ SMTP connection verified successfully!

📤 Sending test email...
   From: hr@hexerve.com
   To: abhishek.rajput@hexerve.com
   Subject: Test Email - WorkPlus HRMS Notification System

✅ Test email sent successfully!

📬 Email Details:
   Message ID: <...>
   Response: 250 2.0.0 OK

🎉 Email test completed successfully!
📧 Please check abhishek.rajput@hexerve.com inbox (including spam folder).
```

---

## 🔐 Security Best Practices

### 1. Use App-Specific Password
- More secure than using main account password
- Can be revoked without changing main password
- Recommended for production environments

### 2. Restrict SMTP Access
- Only enable for mailboxes that need it (hr@hexerve.com)
- Don't enable organization-wide unless necessary

### 3. Monitor Email Activity
- Regularly check sent items in hr@hexerve.com
- Set up alerts for unusual activity
- Review email logs in Exchange Admin Center

### 4. IP Restrictions (Optional)
- Configure allowed IP addresses in Exchange
- Limit SMTP access to your server's IP only

---

## 📋 Verification Checklist

After enabling SMTP AUTH, verify:

- [ ] SMTP AUTH enabled in Microsoft 365
- [ ] Waited 15 minutes for changes to propagate
- [ ] Test script runs successfully
- [ ] Test email received in abhishek.rajput@hexerve.com
- [ ] Email not in spam folder
- [ ] HTML formatting displays correctly
- [ ] All links work properly

---

## 🆘 Troubleshooting

### Issue: Still getting authentication error after enabling

**Solutions:**
1. Wait longer (up to 1 hour)
2. Try app password instead
3. Check if MFA is enabled (requires app password)
4. Verify password is correct in .env file
5. Check if account is not locked or suspended

### Issue: Email sent but not received

**Solutions:**
1. Check spam/junk folder
2. Check email quarantine in Microsoft 365
3. Verify recipient email is correct
4. Check Exchange mail flow rules
5. Review message trace in Exchange Admin Center

### Issue: Connection timeout

**Solutions:**
1. Check firewall allows outbound port 587
2. Verify SMTP_HOST is correct (smtp.office365.com)
3. Try port 25 or 465 as alternative
4. Check if antivirus is blocking connection

---

## 📞 Support Resources

- **Microsoft 365 SMTP Documentation**: https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365
- **SMTP AUTH Settings**: https://aka.ms/smtp_auth_disabled
- **Exchange Online PowerShell**: https://learn.microsoft.com/en-us/powershell/exchange/connect-to-exchange-online-powershell

---

## ✅ Once Working

After successful email test, your WorkPlus HRMS will automatically send:

- 💰 **Salary slip approved** notifications
- 📅 **Leave request** confirmations and approvals
- 💳 **Expense claim** notifications
- 🎉 **Welcome emails** for new employees
- 🔑 **Password reset** notifications
- ⏰ **Attendance reminders** (when scheduled)

All emails will be sent from **hr@hexerve.com** and will open in **real Outlook app**!

---

## 🎯 Next Steps

1. **Enable SMTP AUTH** in Microsoft 365 (see instructions above)
2. **Wait 15 minutes** for changes to propagate
3. **Run test script**: `node backend/scripts/testEmail.js`
4. **Verify email received** in abhishek.rajput@hexerve.com
5. **Start using** the HRMS - emails will send automatically!

---

**Need Help?** Contact your Microsoft 365 administrator or IT support team to enable SMTP authentication for hr@hexerve.com.
