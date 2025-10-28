import React from 'react';
import './PageHeader.css';

const PageHeader = ({ 
  icon, 
  title, 
  subtitle, 
  actions = null,
  variant = 'gradient' // 'gradient', 'flat', 'minimal'
}) => {
  return (
    <div className={`page-header page-header-${variant}`}>
      <div className="page-header-content">
        <div className="page-header-text">
          {icon && <span className="page-header-icon">{icon}</span>}
          <div>
            <h1 className="page-header-title">{title}</h1>
            {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
