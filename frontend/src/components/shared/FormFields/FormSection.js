import React from 'react';

/**
 * Reusable Form Section Wrapper
 * Provides consistent section styling and organization
 */
const FormSection = ({
  title,
  icon = '',
  children,
  className = 'mb-4'
}) => {
  return (
    <div className={className}>
      {title && (
        <h5 className="mt-4 mb-3 text-primary">
          {icon && <span>{icon} </span>}
          {title}
        </h5>
      )}
      {children}
    </div>
  );
};

export default FormSection;
