import React from 'react';
import { TextInput, SelectInput, FormSection } from '../FormFields';

/**
 * Personal & Lifestyle Section
 * Reusable across Register and EditProfile
 */
const PersonalLifestyle = ({
  formData,
  handleChange,
  handleBlur,
  fieldErrors = {},
  touchedFields = {}
}) => {
  return (
    <FormSection title="Personal & Lifestyle" icon="👥">
      <div className="row mb-3">
        <SelectInput
          label="Relationship Status"
          name="relationshipStatus"
          value={formData.relationshipStatus}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Single', 'Divorced', 'Widowed', 'Separated']}
          className="col-md-4"
        />
        <SelectInput
          label="Looking For"
          name="lookingFor"
          value={formData.lookingFor}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Marriage', 'Serious Relationship', 'Casual Dating', 'Friendship']}
          className="col-md-4"
        />
        <SelectInput
          label="Body Type"
          name="bodyType"
          value={formData.bodyType}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Slim', 'Athletic', 'Average', 'Curvy', 'Heavyset']}
          className="col-md-4"
        />
      </div>

      <div className="row mb-3">
        <SelectInput
          label="Drinking"
          name="drinking"
          value={formData.drinking}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Never', 'Socially', 'Regularly', 'Prefer not to say']}
          className="col-md-3"
        />
        <SelectInput
          label="Smoking"
          name="smoking"
          value={formData.smoking}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Never', 'Socially', 'Regularly', 'Prefer not to say']}
          className="col-md-3"
        />
        <SelectInput
          label="Has Children"
          name="hasChildren"
          value={formData.hasChildren}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Yes', 'No', 'Prefer not to say']}
          className="col-md-3"
        />
        <SelectInput
          label="Wants Children"
          name="wantsChildren"
          value={formData.wantsChildren}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Yes', 'No', 'Maybe', 'Prefer not to say']}
          className="col-md-3"
        />
      </div>

      <div className="row mb-3">
        <SelectInput
          label="Pets"
          name="pets"
          value={formData.pets}
          onChange={handleChange}
          onBlur={handleBlur}
          options={['Dog', 'Cat', 'Both', 'Other', 'None']}
          className="col-md-4"
        />
        <TextInput
          label="Interests & Hobbies"
          name="interests"
          value={formData.interests}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="e.g., Reading, Hiking, Cooking, Photography"
          helperText="Comma-separated list"
          className="col-md-8"
        />
      </div>
    </FormSection>
  );
};

export default PersonalLifestyle;
