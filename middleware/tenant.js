import jwt from 'jsonwebtoken';

/**
 * Tenant middleware to extract tenant information from JWT
 * Validates token and attaches tenant context to request
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    // Decode JWT token with error handling
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    // Attach tenant information to request
    req.tenantId = decoded.tenantId;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    
    console.log(`Tenant middleware: tenantId=${decoded.tenantId}, userId=${decoded.userId}, role=${decoded.role}`);
    
    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

/**
 * Subscription validation middleware
 * Checks if tenant has active subscription
 */
export const subscriptionMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    // Decode JWT token with error handling
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (jwtError) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    // Get tenant information
    const tenantId = decoded.tenantId;
    
    // Check if tenant has active subscription
    // This would typically query the database
    // For now, we'll assume subscription is valid
    const subscriptionValid = true; // This would be a DB query in production
    
    if (!subscriptionValid) {
      return res.status(403).json({ 
        success: false, 
        message: 'Subscription expired or inactive' 
      });
    }
    
    console.log(`Subscription middleware: tenantId=${tenantId}, valid=${subscriptionValid}`);
    
    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};
