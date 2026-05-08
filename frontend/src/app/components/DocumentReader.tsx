import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Download, 
  CheckCircle2,
  X,
  Eye,
  Clock,
  AlertCircle,
  BookOpen,
  FileCheck
} from 'lucide-react';

interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  content?: string;
  organizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'Published' | 'Draft' | 'Archived';
  documentUrl: string;
  fileName: string;
  fileSize: string;
  downloadCount: number;
  isPublic: boolean;
}

interface DocumentReaderProps {
  document: CompanyDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (documentId: string, accepted: boolean, ipAddress: string) => void;
  employeeId: string;
  isAlreadyAcknowledged?: boolean;
}

const DocumentReader: React.FC<DocumentReaderProps> = ({
  document,
  isOpen,
  onClose,
  onSubmit,
  employeeId,
  isAlreadyAcknowledged = false
}) => {
  const [hasRead, setHasRead] = useState(false);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acknowledgmentGenerated, setAcknowledgmentGenerated] = useState(isAlreadyAcknowledged);

  if (!isOpen || !document) return null;

  const getUserIP = async () => {
    try {
      // Try to get IP from a public API
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      // Fallback to client-side IP detection
      const rtc = new RTCPeerConnection({ iceServers: [] });
      rtc.createDataChannel('');
      rtc.createOffer()
        .then(offer => rtc.setLocalDescription(offer))
        .catch(() => {});
      
      return new Promise((resolve) => {
        rtc.onicecandidate = (ice) => {
          if (ice && ice.candidate && ice.candidate.candidate) {
            const match = ice.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (match) {
              resolve(match[1]);
              rtc.close();
            }
          }
        };
        
        // Fallback to a default IP if no method works
        setTimeout(() => {
          resolve('127.0.0.1');
          rtc.close();
        }, 2000);
      });
    }
  };

  const handleSubmit = async () => {
    if (!hasRead || !acceptsTerms) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get user IP address
      const userIP = await getUserIP();
      
      // Call the onSubmit callback to generate acknowledgment with IP
      await onSubmit(document.id, true, userIP);
      setAcknowledgmentGenerated(true);
    } catch (error) {
      console.error('Error submitting acknowledgment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setHasRead(false);
    setAcceptsTerms(false);
    setAcknowledgmentGenerated(false);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Mock document content - in real implementation, this would come from the document file
  const mockContent = {
    "Employee Handbook": `# Employee Handbook 2024

## Welcome to Our Company

This handbook serves as a guide for all employees and outlines the policies, procedures, and expectations that govern your employment with us.

## Table of Contents

1. Company Overview
2. Employment Policies
3. Code of Conduct
4. Benefits and Compensation
5. Work Environment
6. Health and Safety
7. Technology and Data Security
8. Leave and Time Off
9. Performance and Development
10. Termination of Employment

## 1. Company Overview

Our company is committed to creating a positive work environment where employees can thrive and contribute to our shared success.

### Mission Statement
To deliver exceptional value to our customers while fostering a culture of innovation, integrity, and excellence.

### Core Values
- Integrity: We act honestly and ethically in all our dealings
- Excellence: We strive for the highest quality in everything we do
- Innovation: We embrace change and seek creative solutions
- Teamwork: We collaborate to achieve common goals
- Respect: We treat everyone with dignity and respect

## 2. Employment Policies

### Equal Opportunity Employment
We are an equal opportunity employer and do not discriminate on the basis of race, color, religion, sex, national origin, age, disability, or any other protected characteristic.

### At-Will Employment
Employment with our company is at-will, meaning either the employee or the company may terminate the employment relationship at any time, with or without cause or notice.

## 3. Code of Conduct

### Professional Conduct
All employees are expected to maintain professional conduct at all times, including:

- Treating colleagues and customers with respect
- Maintaining confidentiality of company information
- Avoiding conflicts of interest
- Complying with all applicable laws and regulations

### Workplace Harassment
We have a zero-tolerance policy for harassment of any kind. All employees have the right to work in an environment free from harassment.

## 4. Benefits and Compensation

### Salary and Wages
Employees are paid on a bi-weekly basis. Salary reviews are conducted annually.

### Health Insurance
We offer comprehensive health insurance coverage for eligible employees and their dependents.

### Retirement Plan
Employees are eligible to participate in our 401(k) retirement plan after 90 days of employment.

## 5. Work Environment

### Work Hours
Standard work hours are Monday through Friday, 9:00 AM to 5:00 PM, with a one-hour lunch break.

### Remote Work
We offer flexible remote work options for eligible positions. All remote work arrangements must be approved by management.

## 6. Health and Safety

### Workplace Safety
We are committed to providing a safe and healthy work environment. All employees must follow safety procedures and report any hazards immediately.

### Emergency Procedures
In case of emergency, employees should follow established evacuation procedures and assemble at designated meeting points.

## 7. Technology and Data Security

### Acceptable Use
Company technology resources are provided for business use only. Personal use is permitted during breaks and lunch hours.

### Data Protection
All employees must protect company data and follow our data security policies at all times.

## 8. Leave and Time Off

### Paid Time Off
Employees accrue paid time off based on their length of service and position.

### Holidays
We observe the following paid holidays: New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving Day, and Christmas Day.

## 9. Performance and Development

### Performance Reviews
Performance reviews are conducted annually to discuss achievements, goals, and development opportunities.

### Training and Development
We encourage ongoing learning and provide various training opportunities to help employees develop their skills.

## 10. Termination of Employment

### Voluntary Termination
Employees who wish to resign should provide at least two weeks' notice in writing.

### Involuntary Termination
Termination may occur for various reasons, including but not limited to poor performance, misconduct, or business needs.

## Contact Information

For questions about this handbook, please contact Human Resources at hr@company.com or call (555) 123-4567.

---

*This handbook is subject to change at any time. Employees will be notified of any significant changes.*

**Last Updated: January 1, 2024**`,

    "Code of Conduct": `# Code of Conduct

## Introduction

This Code of Conduct outlines the ethical principles and standards that guide our business practices and employee behavior.

## Our Commitment

We are committed to conducting business ethically and with integrity. This commitment extends to our employees, customers, suppliers, and communities.

## Ethical Principles

### 1. Honesty and Integrity
- Be truthful in all communications and representations
- Avoid misleading or deceptive practices
- Admit mistakes and take corrective action

### 2. Respect for Others
- Treat all individuals with dignity and respect
- Value diversity and promote inclusivity
- Avoid discrimination and harassment

### 3. Professional Conduct
- Maintain high standards of professional behavior
- Dress appropriately for the workplace
- Use company resources responsibly

### 4. Confidentiality
- Protect confidential company information
- Maintain privacy of employee and customer data
- Avoid discussing confidential matters in public areas

### 5. Conflict of Interest
- Avoid situations where personal interests conflict with company interests
- Disclose potential conflicts to management
- Recuse yourself from decisions where conflicts exist

## Business Practices

### Customer Relations
- Provide accurate and truthful information to customers
- Deliver products and services as promised
- Handle customer complaints promptly and professionally

### Supplier Relations
- Deal fairly and honestly with all suppliers
- Avoid accepting gifts or favors that could influence decisions
- Pay suppliers on time according to agreed terms

### Financial Integrity
- Maintain accurate financial records
- Follow all accounting and reporting requirements
- Report any financial irregularities immediately

## Compliance with Laws

### Legal Compliance
- Comply with all applicable laws and regulations
- Seek legal advice when uncertain about requirements
- Report any legal violations to management

### Regulatory Requirements
- Follow industry-specific regulations and standards
- Maintain required licenses and certifications
- Cooperate with regulatory inspections

## Reporting Violations

### Reporting Process
- Report violations to your supervisor or HR department
- Use the anonymous hotline for sensitive matters
- All reports will be investigated promptly and confidentially

### Protection from Retaliation
- No employee will face retaliation for reporting violations
- We protect whistleblowers who report in good faith
- False or malicious reports will result in disciplinary action

## Consequences of Violations

### Disciplinary Action
Violations of this Code of Conduct may result in:
- Verbal or written warnings
- Suspension from work
- Termination of employment
- Legal action in serious cases

### Criminal Conduct
Illegal activities will be reported to law enforcement authorities and may result in criminal prosecution.

## Conclusion

This Code of Conduct reflects our commitment to ethical business practices. All employees are expected to read, understand, and follow these principles.

For questions or concerns about this Code of Conduct, please contact the Compliance Department at compliance@company.com.

---

**Effective Date: January 1, 2024**`,

    "IT Security Policy": `# IT Security Policy

## Purpose

This policy establishes the requirements for protecting company information technology resources and data.

## Scope

This policy applies to all employees, contractors, and third parties who have access to company IT systems and data.

## Information Security Principles

### 1. Confidentiality
- Protect sensitive information from unauthorized access
- Use encryption for confidential data transmission
- Limit access to information on a need-to-know basis

### 2. Integrity
- Ensure data accuracy and completeness
- Prevent unauthorized data modification
- Maintain data backup and recovery procedures

### 3. Availability
- Ensure systems are available when needed
- Implement redundancy and disaster recovery
- Monitor system performance and availability

## User Responsibilities

### Password Security
- Use strong passwords (minimum 8 characters, mixed case, numbers, symbols)
- Change passwords every 90 days
- Never share passwords with others
- Use different passwords for different systems

### Access Control
- Log out of systems when not in use
- Lock computers when stepping away
- Report lost or stolen devices immediately
- Use multi-factor authentication when available

### Email Security
- Be cautious with email attachments
- Verify sender identity before clicking links
- Report suspicious emails to IT department
- Use company email for business purposes only

### Device Security
- Keep devices updated with security patches
- Install antivirus software on all devices
- Use encrypted storage for sensitive data
- Report security incidents immediately

## Data Protection

### Data Classification
- **Public**: Information that can be freely shared
- **Internal**: Company information for internal use only
- **Confidential**: Sensitive information requiring special protection
- **Restricted**: Highly sensitive information with strict access controls

### Data Handling
- Store data according to classification level
- Use approved storage solutions for company data
- Backup important data regularly
- Securely dispose of sensitive data

### Data Transfer
- Use secure channels for data transfer
- Encrypt sensitive data during transmission
- Verify recipient identity before sharing
- Follow data retention policies

## System Security

### Network Security
- Connect only to authorized networks
- Use VPN for remote access
- Avoid public Wi-Fi for company work
- Report network security issues

### Software Security
- Use only approved software applications
- Keep software updated and patched
- Avoid pirated software
- Report software vulnerabilities

### Physical Security
- Protect physical access to IT equipment
- Secure mobile devices and laptops
- Report suspicious activities
- Follow clean desk policy

## Incident Response

### Reporting Incidents
- Report security incidents immediately
- Include details about what happened
- Preserve evidence when possible
- Cooperate with investigations

### Incident Types
- Data breaches
- Malware infections
- Phishing attacks
- Unauthorized access attempts
- Physical security breaches

## Compliance and Enforcement

### Policy Compliance
- All employees must comply with this policy
- Violations may result in disciplinary action
- Security awareness training is mandatory
- Regular policy reviews will be conducted

### Enforcement
- Security violations will be investigated
- Disciplinary action may include termination
- Legal action may be taken for serious violations
- Criminal activity will be reported to authorities

## Contact Information

For questions about this policy or to report security incidents:

**IT Security Team**
- Email: security@company.com
- Phone: (555) 123-4568
- 24/7 Security Hotline: (555) 123-4569

---

**Policy Version: 2.0**
**Last Updated: January 1, 2024**
**Next Review Date: January 1, 2025**`
  };

  const documentContent = mockContent[document.title as keyof typeof mockContent] || 
    `# ${document.title}

${document.description}

## Document Content

This is the full content of the ${document.title} document. In a real implementation, this content would be loaded from the actual document file.

## Key Points

- Important information about this document
- Policies and procedures outlined
- Employee responsibilities
- Compliance requirements

## Additional Information

For more details, please contact the HR department or your supervisor.

---

**Document ID:** ${document.id}
**Created:** ${formatDate(document.createdAt)}
**Last Updated:** ${formatDate(document.updatedAt)}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{document.title}</h2>
              <p className="text-sm text-muted-foreground">
                {document.category} · Last updated {formatDate(document.updatedAt)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {documentContent}
            </div>
          </div>
        </div>

        {/* Footer with Acknowledgment */}
        {acknowledgmentGenerated || isAlreadyAcknowledged ? (
          <div className="p-6 border-t border-border bg-green-50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">
                  {isAlreadyAcknowledged ? 'Already Acknowledged' : 'Acknowledgment Submitted'}
                </h3>
                <p className="text-sm text-green-700">
                  {isAlreadyAcknowledged 
                    ? 'You have already acknowledged this document.'
                    : 'Your acknowledgment has been recorded. You can download your acknowledgment document.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="rounded-xl"
              >
                Close
              </Button>
              {!isAlreadyAcknowledged && (
                <Button
                  onClick={() => {
                    // In real implementation, this would download the generated acknowledgment
                    alert(`Downloading ${document.title} Acknowledgment for ${employeeId}`);
                  }}
                  className="rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Acknowledgment
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 border-t border-border bg-background">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Document Acknowledgment</h3>
              <p className="text-sm text-muted-foreground">
                Please confirm that you have read and understood this document.
              </p>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasRead}
                    onChange={(e) => setHasRead(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">I have read this document / policy</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptsTerms}
                    onChange={(e) => setAcceptsTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">I accept the terms</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!hasRead || !acceptsTerms || isSubmitting}
                  className="rounded-xl"
                >
                  {isSubmitting ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-2" />
                      Submit Acknowledgment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DocumentReader;
