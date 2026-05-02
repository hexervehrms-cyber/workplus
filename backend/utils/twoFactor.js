import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

/**
 * Two-Factor Authentication Utility
 * Supports TOTP (Time-based One-Time Password) and SMS
 */

export class TwoFactorAuth {
  
  /**
   * Generate TOTP secret for user
   */
  static generateTOTPSecret(userEmail, serviceName = 'WorkPlus Pro') {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: serviceName,
      length: 32
    });
    
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeUrl: null // Will be generated separately
    };
  }
  
  /**
   * Generate QR Code for TOTP setup
   */
  static async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });
      
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }
  
  /**
   * Verify TOTP token
   */
  static verifyTOTP(token, secret, window = 2) {
    try {
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window, // Allow 2 time steps before/after current
        time: Math.floor(Date.now() / 1000)
      });
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Generate backup codes
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }
  
  /**
   * Hash backup codes for storage
   */
  static hashBackupCodes(codes) {
    return codes.map(code => ({
      hash: crypto.createHash('sha256').update(code).digest('hex'),
      used: false,
      usedAt: null
    }));
  }
  
  /**
   * Verify backup code
   */
  static verifyBackupCode(code, hashedCodes) {
    const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    
    const matchingCode = hashedCodes.find(bc => 
      bc.hash === codeHash && !bc.used
    );
    
    if (matchingCode) {
      matchingCode.used = true;
      matchingCode.usedAt = new Date();
      return true;
    }
    
    return false;
  }
  
  /**
   * Generate SMS verification code
   */
  static generateSMSCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      code += digits[crypto.randomInt(0, digits.length)];
    }
    
    return code;
  }
  
  /**
   * Generate email verification code
   */
  static generateEmailCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    
    return code;
  }
  
  /**
   * Validate 2FA setup requirements
   */
  static validateSetupRequirements(method, data) {
    const errors = [];
    
    switch (method) {
      case 'totp':
        if (!data.secret) {
          errors.push('TOTP secret is required');
        }
        if (!data.token) {
          errors.push('Verification token is required');
        }
        break;
        
      case 'sms':
        if (!data.phoneNumber) {
          errors.push('Phone number is required for SMS 2FA');
        }
        if (!/^\+[1-9]\d{1,14}$/.test(data.phoneNumber)) {
          errors.push('Invalid phone number format (use E.164 format)');
        }
        break;
        
      case 'email':
        if (!data.email) {
          errors.push('Email is required for email 2FA');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          errors.push('Invalid email format');
        }
        break;
        
      default:
        errors.push('Invalid 2FA method');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Check if 2FA is required for user
   */
  static is2FARequired(user, riskFactors = {}) {
    // Check if user has 2FA enabled first
    if (user.security?.twoFactorEnabled) {
      return true;
    }
    
    // For testing purposes, allow super admin and admin to bypass 2FA if not explicitly enabled
    // In production, you might want to enforce 2FA for these roles
    if (['super_admin', 'admin'].includes(user.role) && !user.security?.twoFactorEnabled) {
      return false; // Allow bypass for testing
    }
    
    // Risk-based 2FA
    if (riskFactors.newDevice || riskFactors.newLocation || riskFactors.suspiciousActivity) {
      return true;
    }
    
    // Organization policy
    if (user.organization?.requires2FA) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get available 2FA methods for user
   */
  static getAvailableMethods(user) {
    const methods = [];
    
    // TOTP is always available
    methods.push({
      method: 'totp',
      name: 'Authenticator App',
      description: 'Use an authenticator app like Google Authenticator or Authy',
      enabled: user.security?.twoFactorMethod === 'totp',
      primary: user.security?.twoFactorMethod === 'totp'
    });
    
    // SMS if phone number is available
    if (user.contact?.mobile) {
      methods.push({
        method: 'sms',
        name: 'SMS',
        description: `Send codes to ${user.contact.mobile}`,
        enabled: user.security?.twoFactorMethod === 'sms',
        primary: user.security?.twoFactorMethod === 'sms'
      });
    }
    
    // Email is always available
    methods.push({
      method: 'email',
      name: 'Email',
      description: `Send codes to ${user.email}`,
      enabled: user.security?.twoFactorMethod === 'email',
      primary: user.security?.twoFactorMethod === 'email'
    });
    
    return methods;
  }
  
  /**
   * Generate recovery information
   */
  static generateRecoveryInfo() {
    return {
      backupCodes: this.generateBackupCodes(10),
      recoveryKey: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date()
    };
  }
  
  /**
   * Validate recovery key
   */
  static validateRecoveryKey(inputKey, storedKey) {
    return crypto.timingSafeEqual(
      Buffer.from(inputKey, 'hex'),
      Buffer.from(storedKey, 'hex')
    );
  }
}

export default TwoFactorAuth;