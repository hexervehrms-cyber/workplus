import bcrypt from "bcrypt";
import crypto from "crypto";
import zxcvbn from "zxcvbn";

/**
 * Password Security Utility
 * Handles password validation, strength checking, and security policies
 */

export class PasswordSecurity {
  
  // Default password policy
  static defaultPolicy = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventUserInfo: true,
    preventReuse: 5, // Last 5 passwords
    maxAge: 90, // Days
    lockoutThreshold: 5,
    lockoutDuration: 30 // Minutes
  };
  
  /**
   * Validate password against policy
   */
  static validatePassword(password, policy = this.defaultPolicy, userInfo = {}) {
    const errors = [];
    const warnings = [];
    
    // Length validation
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }
    
    if (password.length > policy.maxLength) {
      errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }
    
    // Character requirements
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Common password check
    if (policy.preventCommonPasswords && this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
    }
    
    // User info check
    if (policy.preventUserInfo && this.containsUserInfo(password, userInfo)) {
      errors.push('Password must not contain personal information');
    }
    
    // Strength analysis using zxcvbn
    const strengthAnalysis = zxcvbn(password, this.getUserDictionary(userInfo));
    
    if (strengthAnalysis.score < 2) {
      errors.push('Password is too weak. Please choose a stronger password');
    } else if (strengthAnalysis.score < 3) {
      warnings.push('Password strength is moderate. Consider using a stronger password');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      strength: {
        score: strengthAnalysis.score,
        feedback: strengthAnalysis.feedback,
        crackTime: strengthAnalysis.crack_times_display.offline_slow_hashing_1e4_per_second
      }
    };
  }
  
  /**
   * Check if password is in common passwords list
   */
  static isCommonPassword(password) {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
      'qwerty123', 'welcome123', 'admin123', 'root', 'toor', 'pass',
      'test', 'guest', 'user', 'demo', 'sample', 'temp', 'temporary'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }
  
  /**
   * Check if password contains user information
   */
  static containsUserInfo(password, userInfo) {
    const lowerPassword = password.toLowerCase();
    
    // Check name components
    if (userInfo.name) {
      const nameParts = userInfo.name.toLowerCase().split(/\s+/);
      for (const part of nameParts) {
        if (part.length >= 3 && lowerPassword.includes(part)) {
          return true;
        }
      }
    }
    
    // Check email
    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split('@')[0];
      if (emailParts.length >= 3 && lowerPassword.includes(emailParts)) {
        return true;
      }
    }
    
    // Check phone number
    if (userInfo.phone) {
      const phoneDigits = userInfo.phone.replace(/\D/g, '');
      if (phoneDigits.length >= 4 && lowerPassword.includes(phoneDigits.slice(-4))) {
        return true;
      }
    }
    
    // Check birth date
    if (userInfo.birthDate) {
      const date = new Date(userInfo.birthDate);
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      if (lowerPassword.includes(year) || 
          lowerPassword.includes(month + day) ||
          lowerPassword.includes(day + month)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get user-specific dictionary for strength analysis
   */
  static getUserDictionary(userInfo) {
    const dictionary = [];
    
    if (userInfo.name) {
      dictionary.push(...userInfo.name.toLowerCase().split(/\s+/));
    }
    
    if (userInfo.email) {
      dictionary.push(userInfo.email.toLowerCase().split('@')[0]);
    }
    
    if (userInfo.company) {
      dictionary.push(userInfo.company.toLowerCase());
    }
    
    return dictionary.filter(word => word.length >= 3);
  }
  
  /**
   * Generate secure password
   */
  static generateSecurePassword(length = 16, options = {}) {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
      excludeSimilar: true, // Exclude similar looking characters
      excludeAmbiguous: true // Exclude ambiguous characters
    };
    
    const config = { ...defaults, ...options };
    
    let charset = '';
    
    if (config.includeLowercase) {
      charset += config.excludeSimilar ? 'abcdefghijkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    }
    
    if (config.includeUppercase) {
      charset += config.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (config.includeNumbers) {
      charset += config.excludeSimilar ? '23456789' : '0123456789';
    }
    
    if (config.includeSpecialChars) {
      charset += config.excludeAmbiguous ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\'\\';
    }
    
    if (!charset) {
      throw new Error('At least one character type must be included');
    }
    
    let password = '';
    const charsetLength = charset.length;
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charsetLength);
      password += charset[randomIndex];
    }
    
    // Ensure password meets requirements
    const validation = this.validatePassword(password, this.defaultPolicy);
    if (!validation.isValid) {
      // Regenerate if validation fails (recursive with limit)
      return this.generateSecurePassword(length, options);
    }
    
    return password;
  }
  
  /**
   * Hash password securely
   */
  static async hashPassword(password, saltRounds = 12) {
    try {
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }
  
  /**
   * Verify password against hash
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Password verification failed: ${error.message}`);
    }
  }
  
  /**
   * Check if password needs to be changed
   */
  static needsPasswordChange(lastChanged, maxAge = 90) {
    if (!lastChanged) return true;
    
    const daysSinceChange = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange >= maxAge;
  }
  
  /**
   * Check if password was recently used
   */
  static isPasswordReused(newPassword, passwordHistory, maxHistory = 5) {
    if (!passwordHistory || passwordHistory.length === 0) {
      return false;
    }
    
    // Check against recent passwords
    const recentPasswords = passwordHistory.slice(-maxHistory);
    
    for (const oldPasswordHash of recentPasswords) {
      if (bcrypt.compareSync(newPassword, oldPasswordHash.hash)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate password reset token
   */
  static generateResetToken() {
    return {
      token: crypto.randomBytes(32).toString('hex'),
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      used: false
    };
  }
  
  /**
   * Validate reset token
   */
  static validateResetToken(token, storedToken) {
    return storedToken &&
           !storedToken.used &&
           storedToken.expires > new Date() &&
           crypto.timingSafeEqual(
             Buffer.from(token, 'hex'),
             Buffer.from(storedToken.token, 'hex')
           );
  }
  
  /**
   * Calculate password entropy
   */
  static calculateEntropy(password) {
    let charsetSize = 0;
    
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/\d/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z\d]/.test(password)) charsetSize += 32; // Approximate special chars
    
    return password.length * Math.log2(charsetSize);
  }
  
  /**
   * Get password policy for organization
   */
  static getPasswordPolicy(orgId, customPolicies = {}) {
    // In a real implementation, this would fetch from database
    // For now, return default policy with any custom overrides
    return {
      ...this.defaultPolicy,
      ...customPolicies[orgId]
    };
  }
  
  /**
   * Generate password strength report
   */
  static generateStrengthReport(password, userInfo = {}) {
    const validation = this.validatePassword(password, this.defaultPolicy, userInfo);
    const entropy = this.calculateEntropy(password);
    
    return {
      ...validation,
      entropy: {
        bits: Math.round(entropy),
        rating: this.getEntropyRating(entropy)
      },
      recommendations: this.getPasswordRecommendations(password, validation)
    };
  }
  
  /**
   * Get entropy rating
   */
  static getEntropyRating(entropy) {
    if (entropy < 30) return 'Very Weak';
    if (entropy < 40) return 'Weak';
    if (entropy < 50) return 'Fair';
    if (entropy < 60) return 'Good';
    if (entropy < 70) return 'Strong';
    return 'Very Strong';
  }
  
  /**
   * Get password recommendations
   */
  static getPasswordRecommendations(password, validation) {
    const recommendations = [];
    
    if (validation.errors.length > 0) {
      recommendations.push('Fix the validation errors listed above');
    }
    
    if (password.length < 12) {
      recommendations.push('Consider using a longer password (12+ characters)');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      recommendations.push('Add special characters for better security');
    }
    
    if (validation.strength.score < 4) {
      recommendations.push('Use a mix of words, numbers, and symbols');
      recommendations.push('Avoid predictable patterns and sequences');
    }
    
    return recommendations;
  }
}

export default PasswordSecurity;