import React from 'react';
import OnboardingForm from '../../components/OnboardingForm';
import { apiPost } from '../../utils/apiHelper';

const EmployeeOnboarding: React.FC = () => {
  const handleFormSubmit = async (formData: FormData) => {
    try {
      // Submit to backend API with FormData for file uploads
      const data = await apiPost('/onboarding/submit', formData);

      if (data.success) {
        alert('Form submitted successfully!');
        // Redirect to profile or success page
        window.location.href = '/employee/profile';
      } else {
        alert(data.message || 'Error submitting form. Please try again.');
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
