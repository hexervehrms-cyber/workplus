import React from 'react';
import OnboardingForm from '../../components/OnboardingForm';

const EmployeeOnboarding: React.FC = () => {
  const handleFormSubmit = async (formData: FormData) => {
    try {
      // Submit to backend API with FormData for file uploads
      const response = await fetch('/api/onboarding/submit', {
        method: 'POST',
        body: formData, // Don't set Content-Type header, let browser set it with boundary
      });

      if (response.ok) {
        alert('Form submitted successfully!');
        // Redirect to profile or success page
        window.location.href = '/employee/profile';
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Error submitting form. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };

  return (
    <OnboardingForm 
      isHRMode={false}
      onSubmit={handleFormSubmit}
    />
  );
};

export default EmployeeOnboarding;
