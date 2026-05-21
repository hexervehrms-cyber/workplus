import React from 'react';
import OnboardingForm from '../../components/OnboardingForm';
import { apiPost } from '../../utils/apiHelper';
import { toast } from '../../utils/portalToast';

const EmployeeOnboarding: React.FC = () => {
  const handleFormSubmit = async (formData: FormData) => {
    try {
      // Submit to backend API with FormData for file uploads
      const data = await apiPost('/onboarding/submit', formData);

      if (data.success) {
        toast.success('Form submitted successfully');
        window.location.href = '/employee/profile';
      } else {
        toast.error(data.message || 'Error submitting form. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error submitting form. Please try again.');
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
