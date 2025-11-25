import React from 'react';
import { TextInput, SelectInput, FormSection } from '../FormFields';

/**
 * Regional & Cultural Information Section
 * Reusable across Register and EditProfile
 */
const RegionalCultural = ({
  formData,
  handleChange,
  handleBlur,
  fieldErrors = {},
  touchedFields = {}
}) => {
  return (
    <FormSection title="Regional & Cultural Information" icon="🌍">
      <div className="row mb-3">
        <TextInput
          label="Religion"
          name="religion"
          value={formData.religion}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldErrors.religion}
          touched={touchedFields.religion}
          placeholder="e.g., Hindu, Christian, Muslim"
          className="col-md-4"
        />
        <SelectInput
          label="Country of Origin"
          name="countryOfOrigin"
          value={formData.countryOfOrigin}
          onChange={handleChange}
          onBlur={handleBlur}
          options={[
            { value: 'IN', label: '🇮🇳 INDIA' },
            { value: 'US', label: '🇺🇸 UNITED STATES' }
          ]}
          className="col-md-4"
        />
        <SelectInput
          label="Residence"
          name="countryOfResidence"
          value={formData.countryOfResidence}
          onChange={handleChange}
          onBlur={handleBlur}
          options={[
            { value: 'IN', label: '🇮🇳 INDIA' },
            { value: 'US', label: '🇺🇸 UNITED STATES' }
          ]}
          className="col-md-4"
        />
      </div>

      <div className="row mb-3">
        <TextInput
          label="State"
          name="state"
          value={formData.state}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldErrors.state}
          touched={touchedFields.state}
          placeholder="e.g., California, Tamil Nadu"
          className="col-md-4"
        />
        <TextInput
          label="Caste"
          name="caste"
          value={formData.caste}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldErrors.caste}
          touched={touchedFields.caste}
          placeholder="India-specific"
          className="col-md-4"
        />
        <TextInput
          label="Mother Tongue"
          name="motherTongue"
          value={formData.motherTongue}
          onChange={handleChange}
          onBlur={handleBlur}
          error={fieldErrors.motherTongue}
          touched={touchedFields.motherTongue}
          placeholder="e.g., Tamil, Hindi"
          className="col-md-4"
        />
      </div>

      <div className="row mb-3">
        <SelectInput
          label="Family Type"
          name="familyType"
          value={formData.familyType}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Nuclear Family', 'Joint Family']}
          className="col-md-4"
        />
        <SelectInput
          label="Family Values"
          name="familyValues"
          value={formData.familyValues}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Traditional', 'Moderate', 'Liberal']}
          className="col-md-4"
        />
        <TextInput
          label="Location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          onBlur={handleBlur}
          required
          error={fieldErrors.location}
          touched={touchedFields.location}
          placeholder="City"
          className="col-md-4"
        />
      </div>
    </FormSection>
  );
};

export default RegionalCultural;
