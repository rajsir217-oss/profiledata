import React from 'react';
import { TextInput, SelectInput, FormSection } from '../FormFields';

/**
 * Basic Information Section
 * Reusable across Register and EditProfile
 */
const BasicInformation = ({
  formData,
  handleChange,
  handleBlur,
  fieldErrors = {},
  touchedFields = {},
  isRegistration = false
}) => {
  return (
    <FormSection title="Basic Information" icon="👤">
      {/* Name Fields - Only in Registration */}
      {isRegistration && (
        <div className="row mb-3">
          <TextInput
            label="First Name"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            error={fieldErrors.firstName}
            touched={touchedFields.firstName}
            placeholder="Enter first name"
          />
          <TextInput
            label="Last Name"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            error={fieldErrors.lastName}
            touched={touchedFields.lastName}
            placeholder="Enter last name"
          />
        </div>
      )}

      {/* Personal Details */}
      <div className="row mb-3">
        <TextInput
          label="Date of Birth"
          name="dateOfBirth"
          type="date"
          value={formData.dateOfBirth}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          error={fieldErrors.dateOfBirth}
          touched={touchedFields.dateOfBirth}
          className="col-md-3"
        />
        <TextInput
          label="Height"
          name="height"
          value={formData.height}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          error={fieldErrors.height}
          touched={touchedFields.height}
          placeholder="e.g., 5'8&quot;"
          className="col-md-3"
        />
        <SelectInput
          label="Gender"
          name={isRegistration ? "gender" : "sex"}
          value={formData.gender || formData.sex}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          error={fieldErrors.gender || fieldErrors.sex}
          touched={touchedFields.gender || touchedFields.sex}
          options={['Male', 'Female']}
          className="col-md-3"
        />
        <SelectInput
          label="Citizenship Status"
          name="citizenshipStatus"
          value={formData.citizenshipStatus}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Citizen', 'Greencard']}
          className="col-md-3"
        />
      </div>

      {/* Contact Fields - Only in Registration or Edit */}
      {!isRegistration && (
        <div className="row mb-3">
          <TextInput
            label="Contact Number"
            name="contactNumber"
            value={formData.contactNumber}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            error={fieldErrors.contactNumber}
            touched={touchedFields.contactNumber}
            placeholder="Phone number"
          />
          <TextInput
            label="Contact Email"
            name="contactEmail"
            type="email"
            value={formData.contactEmail}
            onChange={handleChange}
            onBlur={handleBlur}
            required
            error={fieldErrors.contactEmail}
            touched={touchedFields.contactEmail}
            placeholder="Email address"
          />
        </div>
      )}
    </FormSection>
  );
};

export default BasicInformation;
