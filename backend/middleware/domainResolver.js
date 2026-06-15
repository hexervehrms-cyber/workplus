/**
 * Domain Resolver Middleware
 * Resolves custom domains to organizations
 * Blocks unverified domains with clear error
 * Attaches resolved tenant context to request
 */

import Organization from "../models/Organization.js";
import logger from "../utils/logger.js";

// Simple in-memory cache for domain lookups (short TTL)
const domainCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const UNVERIFIED_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (cache unverified too)

/**
 * Get platform default domains from environment
 */
function getPlatformDomains() {
  const platformRoot = (process.env.PLATFORM_ROOT_DOMAIN || 'workplus.hexerve.online').toLowerCase();
  const frontendUrl = (process.env.FRONTEND_URL || 'https://workplus.vercel.app').toLowerCase();
  
  // Extract domain from FRONTEND_URL
  let frontendDomain = '';
  try {
    const url = new URL(frontendUrl);
    frontendDomain = url.hostname.toLowerCase();
  } catch (e) {
    frontendDomain = frontendUrl.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  }
  
  return {
    platformRoot,
    frontendDomain,
    allPlatformDomains: [platformRoot, frontendDomain, 'localhost', '127.0.0.1'].filter(Boolean)
  };
}

/**
 * Check if domain is Vercel preview domain
 */
function isVercelPreview(host) {
  return host.includes('vercel.app') || host.includes('vercelapp.com');
}

/**
 * Extract host from request
 */
function getRequestHost(req) {
  // Priority order:
  // 1. x-forwarded-host (behind proxy/load balancer)
  // 2. host header
  // 3. hostname property
  let host = 
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    req.hostname ||
    '';
  
  // Remove port
  host = host.split(':')[0].toLowerCase().trim();
  
  return host;
}

/**
 * Check if domain is platform default
 */
function isPlatformDomain(host) {
  const { allPlatformDomains } = getPlatformDomains();
  return allPlatformDomains.some(domain => host === domain || host.endsWith(domain));
}

/**
 * Get cached domain result
 */
function getCachedDomain(domain) {
  const cached = domainCache.get(domain);
  if (!cached) return null;
  
  // Check TTL based on type
  const ttl = cached.status === 'verified' ? CACHE_TTL : UNVERIFIED_CACHE_TTL;
  if (Date.now() - cached.timestamp > ttl) {
    domainCache.delete(domain);
    return null;
  }
  
  return cached;
}

/**
 * Set domain cache
 */
function setCachedDomain(domain, status, org = null) {
  domainCache.set(domain, {
    status, // 'verified', 'unverified', 'not_found'
    org,
    timestamp: Date.now()
  });
}

/**
 * Domain Resolver Middleware
 * Must be called early, after basic middleware, before auth middleware
 * 
 * Behavior:
 * 1. Platform domain or localhost → skip (normal login)
 * 2. Verified custom domain → attach org context
 * 3. Unverified custom domain → set flag to block tenant-required endpoints
 * 4. Unknown custom domain → set flag to block tenant-required endpoints
 */
export async function domainResolver(req, res, next) {
  try {
    const host = getRequestHost(req);
    
    // Skip resolution for platform domains, localhost, or Vercel previews
    if (!host || isPlatformDomain(host) || isVercelPreview(host)) {
      req.domainResolutionStatus = 'platform_domain';
      return next();
    }
    
    // Check cache first
    let cached = getCachedDomain(host);
    if (cached) {
      if (cached.status === 'verified' && cached.org) {
        // Verified domain - attach context
        req.resolvedOrgId = cached.org._id.toString();
        req.resolvedCustomDomain = host;
        req.tenantOrg = cached.org;
        req.domainResolutionStatus = 'verified';
      } else if (cached.status === 'unverified') {
        // Unverified domain - block tenant context
        req.domainResolutionStatus = 'unverified_custom_domain';
      } else {
        // Not found - unknown custom domain
        req.domainResolutionStatus = 'unknown_custom_domain';
      }
      return next();
    }
    
    // Database lookup for custom domain organizations
    const organization = await Organization.findOne({
      customDomain: host,
      isActive: true
    }).select('_id name customDomain customDomainStatus').lean();
    
    if (organization) {
      if (organization.customDomainStatus === 'verified') {
        // Verified domain - attach context
        setCachedDomain(host, 'verified', organization);
        req.resolvedOrgId = organization._id.toString();
        req.resolvedCustomDomain = host;
        req.tenantOrg = organization;
        req.domainResolutionStatus = 'verified';
        
        logger.info('Domain resolved to organization', {
          domain: host,
          orgId: organization._id,
          orgName: organization.name,
          status: organization.customDomainStatus
        });
      } else {
        // Unverified domain - cache and block
        setCachedDomain(host, 'unverified', null);
        req.domainResolutionStatus = 'unverified_custom_domain';
        
        logger.warn('Unverified custom domain attempted', {
          domain: host,
          orgId: organization._id,
          status: organization.customDomainStatus
        });
      }
    } else {
      // Unknown custom domain - cache as not found
      setCachedDomain(host, 'not_found', null);
      req.domainResolutionStatus = 'unknown_custom_domain';
    }
    
    next();
  } catch (error) {
    logger.error('Domain resolver error:', error);
    // Don't block request on resolver error
    req.domainResolutionStatus = 'error';
    next();
  }
}

/**
 * Optionally attach resolved org to user context if authenticated
 * This is called after auth middleware
 */
export function ensureDomainTenantMatch(req, res, next) {
  // If we have both authenticated user and resolved domain
  if (req.user && req.resolvedOrgId) {
    const userOrgId = req.user.orgId || req.user.tenantId;
    
    // Verify user belongs to resolved domain organization
    if (userOrgId && userOrgId !== req.resolvedOrgId) {
      logger.warn('User org mismatch with domain', {
        userId: req.user.userId,
        userOrgId,
        resolvedOrgId: req.resolvedOrgId,
        domain: req.resolvedCustomDomain
      });
      
      // Do not allow cross-org access via domain
      return res.status(403).json({
        success: false,
        message: 'Your account does not belong to this organization domain.',
        code: 'ORG_MISMATCH'
      });
    }
  }
  
  next();
}

/**
 * Block unverified custom domain access
 * Used on tenant-scoped routes to prevent unverified domains from accessing data
 */
export function blockUnverifiedDomain(req, res, next) {
  if (req.domainResolutionStatus === 'unverified_custom_domain') {
    return res.status(403).json({
      success: false,
      message: 'This custom domain is not verified yet. Please use the default WorkPlus login.',
      code: 'DOMAIN_NOT_VERIFIED'
    });
  }
  
  if (req.domainResolutionStatus === 'unknown_custom_domain') {
    return res.status(403).json({
      success: false,
      message: 'This custom domain is not recognized. Please use the default WorkPlus login.',
      code: 'DOMAIN_NOT_RECOGNIZED'
    });
  }
  
  next();
}

export default domainResolver;
